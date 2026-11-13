# FOURCC REPORTING TESTS.
from __future__ import annotations

from worker.format import fourcc_to_text
from worker.roi import build_mask, regions_from_box


def test_known_camera_codes_stay_readable() -> None:
    yuy2 = ord("Y") | (ord("U") << 8) | (ord("Y") << 16) | (ord("2") << 24)
    mjpg = ord("M") | (ord("J") << 8) | (ord("P") << 16) | (ord("G") << 24)
    assert fourcc_to_text(yuy2) == "YUY2"
    assert fourcc_to_text(mjpg) == "MJPG"


def test_box_regions_cover_skin_pixels() -> None:
    regions = regions_from_box((10, 10, 180, 220))
    mask = build_mask(regions, 220, 260)
    assert int(mask.sum()) > 40
