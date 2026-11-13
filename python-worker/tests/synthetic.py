# SYNTHETIC SKIN COLOR FOR ESTIMATOR TESTS.
"""A known pulse mixed into red, green, and blue. Green carries most of it."""

from __future__ import annotations

import numpy as np


def synthetic_rgb(
    bpm: float = 72.0,
    seconds: float = 20.0,
    sample_rate: float = 30.0,
    noise: float = 0.01,
    seed: int = 7,
) -> tuple[np.ndarray, np.ndarray]:
    generator = np.random.default_rng(seed)
    count = int(seconds * sample_rate)
    timestamps = np.arange(count, dtype=np.float64) / sample_rate
    pulse = np.sin(2.0 * np.pi * (bpm / 60.0) * timestamps)
    base = np.array([140.0, 95.0, 80.0])
    gain = np.array([0.6, 2.2, 0.4])
    colors = base[None, :] + gain[None, :] * pulse[:, None]
    colors += generator.normal(0.0, noise * 100.0, size=colors.shape)
    return np.clip(colors, 1.0, 255.0), timestamps
