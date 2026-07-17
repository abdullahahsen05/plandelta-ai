from __future__ import annotations

import hashlib
import os
from pathlib import Path
from uuid import uuid4

import cv2

from plandelta_vision.errors import VisionError
from plandelta_vision.image_io import ColorImage, GrayImage
from plandelta_vision.models import ArtifactResult


class ArtifactStore:
    def __init__(self, root: Path, prefix: str) -> None:
        if (
            Path(prefix).is_absolute()
            or "\\" in prefix
            or any(part in {"", ".", ".."} for part in prefix.split("/"))
        ):
            raise VisionError("ARTIFACT_PATH_UNSAFE", "The artifact output prefix is unsafe.")
        self.root = root.resolve()
        self.prefix = prefix
        self.directory = (self.root / Path(*prefix.split("/"))).resolve()
        try:
            self.directory.relative_to(self.root)
        except ValueError as error:
            raise VisionError(
                "ARTIFACT_PATH_UNSAFE", "The artifact output escapes storage."
            ) from error
        self.directory.mkdir(parents=True, exist_ok=True)

    def write_png(
        self,
        kind: str,
        filename: str,
        image: ColorImage | GrayImage,
        metadata: dict[str, str | int | float | bool | None] | None = None,
    ) -> ArtifactResult:
        success, encoded = cv2.imencode(".png", image, [cv2.IMWRITE_PNG_COMPRESSION, 6])
        if not success:
            raise VisionError(
                "ARTIFACT_ENCODING_FAILED", "A vision artifact could not be encoded.", 500
            )
        bytes_value = encoded.tobytes()
        target = self.directory / filename
        temporary = target.with_name(f".{target.name}.{uuid4().hex}.tmp")
        try:
            temporary.write_bytes(bytes_value)
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)
        height, width = image.shape[:2]
        storage_key = f"{self.prefix}/{filename}"
        return ArtifactResult(
            kind=kind,  # type: ignore[arg-type]
            storage_key=storage_key,
            mime_type="image/png",
            width_px=width,
            height_px=height,
            byte_size=len(bytes_value),
            checksum_sha256=hashlib.sha256(bytes_value).hexdigest(),
            metadata=metadata or {},
        )
