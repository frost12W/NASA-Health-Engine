# FOREHEAD AND CHEEK REGIONS FOR A FACE PULSE CHECK.
"""Place skin regions from face landmarks or from a plain face box."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

# MediaPipe Face Mesh indexes used by the first camera trial.
# Landmarks place regions. They are not an identity record.
FOREHEAD = (68, 10, 298, 151)
CHEEK_LEFT = (123, 205)
CHEEK_RIGHT = (352, 425)
FACE_LEFT = 234
FACE_RIGHT = 454
EYE_LEFT = 33
EYE_RIGHT = 263


@dataclass
class Ellipse:
    cx: float
    cy: float
    rx: float
    ry: float
    angle: float


@dataclass
class Regions:
    forehead: list[tuple[float, float]]
    cheeks: list[Ellipse]
    face_width: float


def _point(landmarks, index: int, width: int, height: int) -> tuple[float, float]:
    point = landmarks[index]
    return float(point.x) * width, float(point.y) * height


def regions_from_landmarks(landmarks, width: int, height: int) -> Regions:
    forehead = [_point(landmarks, index, width, height) for index in FOREHEAD]
    left = _point(landmarks, FACE_LEFT, width, height)
    right = _point(landmarks, FACE_RIGHT, width, height)
    face_width = math.hypot(right[0] - left[0], right[1] - left[1])
    eye_left = _point(landmarks, EYE_LEFT, width, height)
    eye_right = _point(landmarks, EYE_RIGHT, width, height)
    angle = math.atan2(eye_right[1] - eye_left[1], eye_right[0] - eye_left[0])

    def center(indexes: tuple[int, ...]) -> tuple[float, float]:
        points = [_point(landmarks, index, width, height) for index in indexes]
        return (
            sum(point[0] for point in points) / len(points),
            sum(point[1] for point in points) / len(points),
        )

    radius_x = face_width * 0.09
    radius_y = face_width * 0.11
    cheeks = [
        Ellipse(*center(CHEEK_LEFT), radius_x, radius_y, angle),
        Ellipse(*center(CHEEK_RIGHT), radius_x, radius_y, angle),
    ]
    return Regions(forehead, cheeks, face_width)


def regions_from_box(box: tuple[int, int, int, int]) -> Regions:
    x, y, width, height = box
    forehead = [
        (x + width * 0.30, y + height * 0.16),
        (x + width * 0.70, y + height * 0.16),
        (x + width * 0.62, y + height * 0.32),
        (x + width * 0.38, y + height * 0.32),
    ]
    radius_x = width * 0.10
    radius_y = width * 0.12
    cheeks = [
        Ellipse(x + width * 0.32, y + height * 0.58, radius_x, radius_y, 0.0),
        Ellipse(x + width * 0.68, y + height * 0.58, radius_x, radius_y, 0.0),
    ]
    return Regions(forehead, cheeks, float(width))


def build_mask(regions: Regions, width: int, height: int) -> np.ndarray:
    columns, rows = np.meshgrid(np.arange(width), np.arange(height))
    xs = columns + 0.5
    ys = rows + 0.5
    mask = np.zeros((height, width), dtype=bool)
    polygon = np.asarray(regions.forehead, dtype=np.float64)
    if len(polygon) >= 3:
        inside = np.zeros((height, width), dtype=bool)
        origin_x, origin_y = polygon[0]
        for index in range(1, len(polygon) - 1):
            x1, y1 = polygon[index]
            x2, y2 = polygon[index + 1]
            determinant = (y1 - y2) * (origin_x - x2) + (x2 - x1) * (origin_y - y2)
            if abs(determinant) < 1e-9:
                continue
            first = ((y1 - y2) * (xs - x2) + (x2 - x1) * (ys - y2)) / determinant
            second = ((y2 - origin_y) * (xs - x2) + (origin_x - x2) * (ys - y2)) / determinant
            inside |= (first >= 0) & (second >= 0) & (first + second <= 1)
        mask |= inside
    for ellipse in regions.cheeks:
        if ellipse.rx <= 0 or ellipse.ry <= 0:
            continue
        cosine = math.cos(-ellipse.angle)
        sine = math.sin(-ellipse.angle)
        dx = xs - ellipse.cx
        dy = ys - ellipse.cy
        local_x = dx * cosine - dy * sine
        local_y = dx * sine + dy * cosine
        mask |= (local_x * local_x) / (ellipse.rx * ellipse.rx) + (local_y * local_y) / (ellipse.ry * ellipse.ry) <= 1.0
    return mask


def scale_regions(regions: Regions, scale: float) -> Regions:
    return Regions(
        [(point[0] * scale, point[1] * scale) for point in regions.forehead],
        [
            Ellipse(ellipse.cx * scale, ellipse.cy * scale, ellipse.rx * scale, ellipse.ry * scale, ellipse.angle)
            for ellipse in regions.cheeks
        ],
        regions.face_width * scale,
    )


def mean_rgb_regions(frame_bgr: np.ndarray, regions: Regions, min_pixels: int = 40) -> np.ndarray | None:
    """Average skin color from a crop around the forehead and cheeks."""
    height, width = frame_bgr.shape[:2]
    xs = [point[0] for point in regions.forehead]
    ys = [point[1] for point in regions.forehead]
    for ellipse in regions.cheeks:
        xs.extend((ellipse.cx - ellipse.rx, ellipse.cx + ellipse.rx))
        ys.extend((ellipse.cy - ellipse.ry, ellipse.cy + ellipse.ry))
    if not xs:
        return None
    x0 = max(0, int(math.floor(min(xs))) - 2)
    y0 = max(0, int(math.floor(min(ys))) - 2)
    x1 = min(width, int(math.ceil(max(xs))) + 3)
    y1 = min(height, int(math.ceil(max(ys))) + 3)
    if x1 - x0 < 2 or y1 - y0 < 2:
        return None
    crop = frame_bgr[y0:y1, x0:x1]
    shifted = Regions(
        [(point[0] - x0, point[1] - y0) for point in regions.forehead],
        [Ellipse(ellipse.cx - x0, ellipse.cy - y0, ellipse.rx, ellipse.ry, ellipse.angle) for ellipse in regions.cheeks],
        regions.face_width,
    )
    return mean_rgb(crop, build_mask(shifted, crop.shape[1], crop.shape[0]), min_pixels)


def mean_rgb(frame_bgr: np.ndarray, mask: np.ndarray, min_pixels: int = 40) -> np.ndarray | None:
    if frame_bgr.shape[:2] != mask.shape:
        raise ValueError("the skin mask size does not match the frame")
    count = int(mask.sum())
    if count < min_pixels:
        return None
    pixels = frame_bgr[mask]
    mean_bgr = pixels.mean(axis=0)
    return np.array([mean_bgr[2], mean_bgr[1], mean_bgr[0]], dtype=np.float64)


def draw_regions(frame_bgr: np.ndarray, regions: Regions) -> None:
    """Draw on a preview copy only. Callers must not sample color from that copy."""
    import cv2

    overlay = frame_bgr.copy()
    polygon = np.array(regions.forehead, dtype=np.int32)
    cv2.fillPoly(overlay, [polygon], (80, 200, 120))
    for ellipse in regions.cheeks:
        cv2.ellipse(
            overlay,
            (int(ellipse.cx), int(ellipse.cy)),
            (max(1, int(ellipse.rx)), max(1, int(ellipse.ry))),
            math.degrees(ellipse.angle),
            0,
            360,
            (200, 170, 70),
            -1,
        )
    cv2.addWeighted(overlay, 0.28, frame_bgr, 0.72, 0, frame_bgr)
    cv2.polylines(frame_bgr, [polygon], True, (80, 200, 120), 2)
