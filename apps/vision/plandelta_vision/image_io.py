from __future__ import annotations

import ipaddress
import socket
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path
from typing import cast

import cv2
import numpy as np
import pymupdf
from numpy.typing import NDArray
from PIL import Image, ImageOps, UnidentifiedImageError

from plandelta_vision.config import VisionSettings
from plandelta_vision.errors import VisionError
from plandelta_vision.models import HttpsReadReference, LocalReadReference, ReadReference

GrayImage = NDArray[np.uint8]
ColorImage = NDArray[np.uint8]


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: object,
        code: int,
        msg: str,
        headers: object,
        newurl: str,
    ) -> urllib.request.Request | None:
        return None


def _safe_local_path(reference: LocalReadReference, root: Path) -> Path:
    supplied = Path(reference.path)
    target = supplied.resolve() if supplied.is_absolute() else (root / supplied).resolve()
    try:
        target.relative_to(root)
    except ValueError as error:
        raise VisionError(
            "INPUT_PATH_UNSAFE", "The local input path escapes shared storage."
        ) from error
    if not target.is_file():
        raise VisionError("INPUT_NOT_FOUND", "The referenced drawing does not exist.", 404)
    return target


def _validate_public_host(reference: HttpsReadReference) -> None:
    host = reference.url.host
    if not host:
        raise VisionError("SIGNED_URL_INVALID", "The signed URL has no host.")
    try:
        addresses = socket.getaddrinfo(host, reference.url.port or 443, type=socket.SOCK_STREAM)
    except socket.gaierror as error:
        raise VisionError(
            "SIGNED_URL_UNRESOLVED", "The signed URL host could not be resolved."
        ) from error
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise VisionError(
                "SIGNED_URL_PRIVATE_NETWORK", "Private network URLs are not accepted."
            )


def _download(reference: HttpsReadReference, settings: VisionSettings) -> bytes:
    _validate_public_host(reference)
    request = urllib.request.Request(
        str(reference.url),
        method="GET",
        headers={
            "Accept": "application/pdf,image/png,image/jpeg",
            "User-Agent": "PlanDeltaVision/1",
        },
    )
    opener = urllib.request.build_opener(_NoRedirectHandler())
    try:
        with opener.open(request, timeout=settings.signed_url_timeout_seconds) as response:
            content_length = response.headers.get("Content-Length")
            if content_length and int(content_length) > settings.max_upload_bytes:
                raise VisionError("INPUT_TOO_LARGE", "The signed drawing exceeds the byte limit.")
            chunks: list[bytes] = []
            total = 0
            while chunk := response.read(min(1024 * 1024, settings.max_upload_bytes + 1 - total)):
                total += len(chunk)
                if total > settings.max_upload_bytes:
                    raise VisionError(
                        "INPUT_TOO_LARGE", "The signed drawing exceeds the byte limit."
                    )
                chunks.append(chunk)
            return b"".join(chunks)
    except urllib.error.HTTPError as error:
        if 300 <= error.code < 400:
            raise VisionError(
                "SIGNED_URL_REDIRECT", "Signed URL redirects are not accepted."
            ) from error
        raise VisionError(
            "SIGNED_URL_FETCH_FAILED", "The signed drawing could not be fetched.", 502
        ) from error
    except urllib.error.URLError as error:
        raise VisionError(
            "SIGNED_URL_FETCH_FAILED", "The signed drawing could not be fetched.", 502
        ) from error


def read_reference(reference: ReadReference, settings: VisionSettings) -> bytes:
    if isinstance(reference, LocalReadReference):
        path = _safe_local_path(reference, settings.shared_root)
        size = path.stat().st_size
        if size <= 0 or size > settings.max_upload_bytes:
            raise VisionError(
                "INPUT_SIZE_INVALID", "The drawing is empty or exceeds the byte limit."
            )
        return path.read_bytes()
    return _download(reference, settings)


def _decode_pdf(data: bytes, selected_page: int, settings: VisionSettings) -> ColorImage:
    try:
        document = pymupdf.open(stream=data, filetype="pdf")
    except Exception as error:
        raise VisionError("PDF_INVALID", "The PDF could not be opened.") from error
    try:
        if document.needs_pass:
            raise VisionError("PDF_ENCRYPTED", "Encrypted PDFs are not accepted.")
        if document.page_count < 1 or document.page_count > settings.max_pdf_pages:
            raise VisionError(
                "PDF_PAGE_LIMIT", "The PDF page count is outside the configured limit."
            )
        if selected_page > document.page_count:
            raise VisionError("SELECTED_PAGE_INVALID", "The selected page does not exist.")
        page = document.load_page(selected_page - 1)
        scale = settings.render_dpi / 72
        pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), colorspace=pymupdf.csRGB)
        if pixmap.width * pixmap.height > settings.max_image_pixels:
            raise VisionError("IMAGE_PIXEL_LIMIT", "The rendered page exceeds the pixel limit.")
        pixels = np.frombuffer(pixmap.samples, dtype=np.uint8)
        rgb = pixels.reshape(pixmap.height, pixmap.width, pixmap.n)[..., :3]
        return cast(ColorImage, cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    finally:
        document.close()


def _decode_image(data: bytes, settings: VisionSettings) -> ColorImage:
    Image.MAX_IMAGE_PIXELS = settings.max_image_pixels
    try:
        with Image.open(BytesIO(data)) as source:
            if source.format not in {"PNG", "JPEG"}:
                raise VisionError(
                    "INPUT_TYPE_UNSUPPORTED", "Only PDF, PNG, JPG, and JPEG are accepted."
                )
            if source.width * source.height > settings.max_image_pixels:
                raise VisionError("IMAGE_PIXEL_LIMIT", "The drawing exceeds the pixel limit.")
            rgb = ImageOps.exif_transpose(source).convert("RGB")
            return cast(ColorImage, cv2.cvtColor(np.asarray(rgb), cv2.COLOR_RGB2BGR))
    except (UnidentifiedImageError, OSError) as error:
        raise VisionError("IMAGE_INVALID", "The image could not be decoded.") from error


def decode_drawing(data: bytes, selected_page: int, settings: VisionSettings) -> ColorImage:
    if data.startswith(b"%PDF-"):
        return _decode_pdf(data, selected_page, settings)
    if data.startswith(b"\x89PNG\r\n\x1a\n") or data.startswith(b"\xff\xd8\xff"):
        if selected_page != 1:
            raise VisionError("SELECTED_PAGE_INVALID", "Raster drawings contain only one page.")
        return _decode_image(data, settings)
    raise VisionError("INPUT_TYPE_UNSUPPORTED", "The drawing signature is not PDF, PNG, or JPEG.")


def normalize_image(image: ColorImage) -> tuple[ColorImage, GrayImage]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8)).apply(gray)
    gray = cv2.medianBlur(gray, 3)
    return cast(ColorImage, cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)), cast(GrayImage, gray)


def resize_to_baseline(candidate: ColorImage, baseline: ColorImage) -> ColorImage:
    height, width = baseline.shape[:2]
    if candidate.shape[:2] == (height, width):
        return candidate
    interpolation = cv2.INTER_AREA if candidate.shape[0] > height else cv2.INTER_CUBIC
    return cast(ColorImage, cv2.resize(candidate, (width, height), interpolation=interpolation))
