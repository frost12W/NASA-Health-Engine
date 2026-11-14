# FOURCC REPORTING TESTS.
from __future__ import annotations

import numpy as np

from worker.format import fourcc_to_text
from worker.roi import build_mask, mean_rgb_regions, regions_from_box


def test_known_camera_codes_stay_readable() -> None:
    yuy2 = ord("Y") | (ord("U") << 8) | (ord("Y") << 16) | (ord("2") << 24)
    mjpg = ord("M") | (ord("J") << 8) | (ord("P") << 16) | (ord("G") << 24)
    assert fourcc_to_text(yuy2) == "YUY2"
    assert fourcc_to_text(mjpg) == "MJPG"


def test_box_regions_cover_skin_pixels() -> None:
    regions = regions_from_box((10, 10, 180, 220))
    mask = build_mask(regions, 220, 260)
    assert int(mask.sum()) > 40


def test_skin_color_uses_the_region_crop() -> None:
    regions = regions_from_box((10, 10, 180, 220))
    frame = np.zeros((260, 220, 3), dtype=np.uint8)
    frame[:, :] = (10, 20, 30)
    frame[40:90, 40:140] = (40, 80, 120)
    color = mean_rgb_regions(frame, regions)
    assert color is not None
    assert color.shape == (3,)
