# THE REFERENCE CHECK USES THE SAME PULSE GATES AS THE CAMERA.
from worker.reference_check import score_clip
from tests.synthetic import synthetic_rgb

import numpy as np


def test_reference_clip_keeps_a_known_pulse() -> None:
    colors, timestamps = synthetic_rgb(bpm=72.0, seconds=12.0, sample_rate=30.0, noise=0.002)
    frames = np.zeros((len(colors), 16, 16, 3), dtype=np.float64)
    frames[:] = colors[:, None, None, :]
    mask = np.ones((16, 16, len(colors)), dtype=np.uint8)
    ppg = np.sin(2.0 * np.pi * (72.0 / 60.0) * timestamps)
    clip = score_clip("synthetic", frames, mask, ppg)
    assert clip["validity_status"] == "VALID", clip["rejection_reasons"]
    assert clip["method_bpm"] is not None and abs(clip["method_bpm"] - 72.0) <= 1.0
    assert clip["reference_bpm"] is not None and abs(clip["reference_bpm"] - 72.0) <= 1.0
    assert clip["difference_bpm"] is not None and clip["difference_bpm"] <= 1.0
