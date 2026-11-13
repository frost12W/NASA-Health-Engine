# ESTIMATOR TESTS AGAINST A KNOWN SYNTHETIC PULSE.
from __future__ import annotations

import numpy as np

from tests.synthetic import synthetic_rgb
from worker.signals import chrom_signal, evaluate_recording, green_signal, pos_signal


def test_known_rates_pass_only_when_the_signal_is_clean() -> None:
    for bpm in (54.0, 72.0, 96.0):
        colors, timestamps = synthetic_rgb(bpm=bpm, seconds=20.0, noise=0.005)
        decision = evaluate_recording(colors, timestamps, 1.0, 0.0, 0.0)
        assert decision.validity_status == "VALID", decision.rejection_reasons
        assert decision.value_bpm is not None
        assert abs(decision.value_bpm - bpm) <= 3.0


def test_noise_does_not_become_a_pulse_value() -> None:
    generator = np.random.default_rng(1)
    colors = np.clip(120.0 + generator.normal(0.0, 4.0, size=(600, 3)), 1, 255)
    timestamps = np.arange(600, dtype=np.float64) / 30.0
    decision = evaluate_recording(colors, timestamps, 1.0, 0.0, 0.0)
    assert decision.validity_status == "INCONCLUSIVE"
    assert decision.value_bpm is None


def test_low_frame_rate_hides_the_number_even_if_a_peak_exists() -> None:
    colors, timestamps = synthetic_rgb(bpm=72.0, seconds=20.0, sample_rate=8.0, noise=0.005)
    decision = evaluate_recording(colors, timestamps, 1.0, 0.0, 0.0)
    assert decision.value_bpm is None
    assert any("frames per second" in reason for reason in decision.rejection_reasons)


def test_short_recording_is_rejected() -> None:
    colors, timestamps = synthetic_rgb(seconds=5.0)
    decision = evaluate_recording(colors, timestamps, 1.0, 0.0, 0.0)
    assert decision.value_bpm is None
    assert decision.validity_status == "INCONCLUSIVE"


def test_projectors_are_finite_and_centered() -> None:
    colors, _timestamps = synthetic_rgb(seconds=10.0)
    for projector in (pos_signal, chrom_signal, green_signal):
        values = projector(colors)
        assert np.isfinite(values).all()
        assert abs(float(values.mean())) < 1e-8
