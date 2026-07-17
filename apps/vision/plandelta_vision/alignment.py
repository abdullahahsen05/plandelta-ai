from __future__ import annotations

from dataclasses import dataclass
from typing import cast

import cv2
import numpy as np
from numpy.typing import NDArray

from plandelta_vision.errors import UnsafeAlignmentError
from plandelta_vision.image_io import ColorImage, GrayImage
from plandelta_vision.models import AlignmentResult


@dataclass(frozen=True)
class AlignedImage:
    image: ColorImage
    gray: GrayImage
    valid_mask: GrayImage
    result: AlignmentResult


def _ink_iou(baseline: GrayImage, candidate: GrayImage, valid: GrayImage) -> float:
    baseline_ink = (baseline < 205) & (valid > 0)
    candidate_ink = (candidate < 205) & (valid > 0)
    union = np.count_nonzero(baseline_ink | candidate_ink)
    if union == 0:
        return 1.0
    return float(np.count_nonzero(baseline_ink & candidate_ink) / union)


def _identity(
    candidate: ColorImage, candidate_gray: GrayImage, confidence: float = 1.0
) -> AlignedImage:
    valid = np.full(candidate_gray.shape, 255, dtype=np.uint8)
    return AlignedImage(
        image=candidate,
        gray=candidate_gray,
        valid_mask=valid,
        result=AlignmentResult(
            method="IDENTITY", confidence=round(confidence, 4), reprojection_error=0.0
        ),
    )


def _orb_alignment(
    baseline_gray: GrayImage,
    candidate: ColorImage,
    candidate_gray: GrayImage,
) -> AlignedImage | None:
    orb = cv2.ORB_create(  # type: ignore[attr-defined]
        nfeatures=5000, scaleFactor=1.2, nlevels=8, fastThreshold=10
    )
    keypoints_candidate, descriptors_candidate = orb.detectAndCompute(candidate_gray, None)
    keypoints_baseline, descriptors_baseline = orb.detectAndCompute(baseline_gray, None)
    if descriptors_candidate is None or descriptors_baseline is None:
        return None
    if len(keypoints_candidate) < 12 or len(keypoints_baseline) < 12:
        return None

    matcher = cv2.BFMatcher(cv2.NORM_HAMMING)
    pairs = matcher.knnMatch(descriptors_candidate, descriptors_baseline, k=2)
    good = [first for first, second in pairs if first.distance < 0.76 * second.distance]
    if len(good) < 12:
        return None
    candidate_points = np.asarray(
        [keypoints_candidate[match.queryIdx].pt for match in good], dtype=np.float32
    )
    baseline_points = np.asarray(
        [keypoints_baseline[match.trainIdx].pt for match in good], dtype=np.float32
    )
    raw_homography, raw_inliers = cv2.findHomography(
        candidate_points,
        baseline_points,
        method=cv2.RANSAC,
        ransacReprojThreshold=4.0,
    )
    if raw_homography is None or raw_inliers is None:
        return None
    homography = cast(NDArray[np.float64], raw_homography)
    inliers = cast(NDArray[np.uint8], raw_inliers)
    inlier_mask = inliers.ravel().astype(bool)
    inlier_count = int(np.count_nonzero(inlier_mask))
    inlier_ratio = inlier_count / len(good)
    if inlier_count < 10 or inlier_ratio < 0.42:
        return None

    projected = cv2.perspectiveTransform(candidate_points[inlier_mask, None, :], homography)[
        :, 0, :
    ]
    errors = np.linalg.norm(projected - baseline_points[inlier_mask], axis=1)
    reprojection_error = float(np.median(errors))
    if not np.isfinite(reprojection_error) or reprojection_error > 5.0:
        return None

    height, width = baseline_gray.shape
    aligned_color = cv2.warpPerspective(
        candidate,
        homography,
        (width, height),
        flags=cv2.INTER_LINEAR,
        borderValue=(255, 255, 255),
    )
    aligned_color = cast(ColorImage, aligned_color)
    aligned_gray = cast(GrayImage, cv2.cvtColor(aligned_color, cv2.COLOR_BGR2GRAY))
    source_mask = np.ones_like(candidate_gray, dtype=np.uint8)
    source_mask *= 255
    valid = cast(
        GrayImage,
        cv2.warpPerspective(
            source_mask,
            homography,
            (width, height),
            flags=cv2.INTER_NEAREST,
            borderValue=(0,),
        ),
    )
    overlap = _ink_iou(baseline_gray, aligned_gray, valid)
    confidence = min(1.0, max(0.0, 0.55 * inlier_ratio + 0.45 * overlap))
    if confidence < 0.5:
        return None
    return AlignedImage(
        image=aligned_color,
        gray=aligned_gray,
        valid_mask=valid,
        result=AlignmentResult(
            method="ORB_HOMOGRAPHY",
            confidence=round(confidence, 4),
            reprojection_error=round(reprojection_error, 4),
        ),
    )


def _ecc_alignment(
    baseline_gray: GrayImage,
    candidate: ColorImage,
    candidate_gray: GrayImage,
) -> AlignedImage | None:
    height, width = baseline_gray.shape
    warp = np.eye(2, 3, dtype=np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 150, 1e-6)
    baseline_float = baseline_gray.astype(np.float32)
    baseline_float *= 1 / 255
    candidate_float = candidate_gray.astype(np.float32)
    candidate_float *= 1 / 255
    try:
        correlation, raw_warp = cv2.findTransformECC(
            baseline_float,
            candidate_float,
            warp,
            cv2.MOTION_EUCLIDEAN,
            criteria,
            None,
        )
    except cv2.error:
        return None
    warp = cast(NDArray[np.float32], raw_warp)
    aligned_color = cv2.warpAffine(
        candidate,
        warp,
        (width, height),
        flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
        borderValue=(255, 255, 255),
    )
    aligned_color = cast(ColorImage, aligned_color)
    aligned_gray = cast(GrayImage, cv2.cvtColor(aligned_color, cv2.COLOR_BGR2GRAY))
    source_mask = np.ones_like(candidate_gray, dtype=np.uint8)
    source_mask *= 255
    valid = cast(
        GrayImage,
        cv2.warpAffine(
            source_mask,
            warp,
            (width, height),
            flags=cv2.INTER_NEAREST | cv2.WARP_INVERSE_MAP,
            borderValue=(0,),
        ),
    )
    overlap = _ink_iou(baseline_gray, aligned_gray, valid)
    confidence = min(1.0, max(0.0, 0.7 * float(correlation) + 0.3 * overlap))
    if correlation < 0.72 or overlap < 0.34 or confidence < 0.62:
        return None
    displacement = float(np.hypot(warp[0, 2], warp[1, 2]))
    return AlignedImage(
        image=aligned_color,
        gray=aligned_gray,
        valid_mask=valid,
        result=AlignmentResult(
            method="ECC_EUCLIDEAN",
            confidence=round(confidence, 4),
            reprojection_error=round(displacement, 4),
        ),
    )


def align_candidate(
    baseline_gray: GrayImage,
    candidate: ColorImage,
    candidate_gray: GrayImage,
) -> AlignedImage:
    if baseline_gray.shape != candidate_gray.shape:
        raise UnsafeAlignmentError("Normalized drawing dimensions do not match.")
    if float(np.mean(cv2.absdiff(baseline_gray, candidate_gray))) < 0.35:
        return _identity(candidate, candidate_gray)
    direct_valid = np.ones_like(baseline_gray, dtype=np.uint8)
    direct_valid *= 255
    direct_overlap = _ink_iou(baseline_gray, candidate_gray, direct_valid)
    if direct_overlap >= 0.82:
        return _identity(candidate, candidate_gray, direct_overlap)
    aligned = _orb_alignment(baseline_gray, candidate, candidate_gray)
    if aligned is not None:
        return aligned
    aligned = _ecc_alignment(baseline_gray, candidate, candidate_gray)
    if aligned is not None:
        return aligned
    raise UnsafeAlignmentError(
        "The drawings could not be aligned with sufficient confidence; "
        "verify page, scale, and sheet selection."
    )
