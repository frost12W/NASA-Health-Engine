# QUALITY GATE TESTS THAT DO NOT NEED A CAMERA.
from __future__ import annotations

from worker.quality import (
    CHROM_VERSION,
    GREEN_VERSION,
    POS_VERSION,
    MethodPeak,
    SeriesContext,
    decide,
)


def _context() -> SeriesContext:
    return SeriesContext(20.0, 30.0, 0.01, 1.0, 0.0, 0.0)


def test_disagreeing_methods_do_not_publish_a_number() -> None:
    decision = decide(
        _context(),
        MethodPeak("POS", POS_VERSION, 70.0, 10.0),
        MethodPeak("CHROM", CHROM_VERSION, 100.0, 10.0),
        MethodPeak("GREEN", GREEN_VERSION, 70.0, 10.0),
        (70.0, 70.0),
        (100.0, 100.0),
    )
    assert decision.validity_status == "INCONCLUSIVE"
    assert decision.value_bpm is None


def test_agreeing_methods_can_publish_the_stronger_estimate() -> None:
    decision = decide(
        _context(),
        MethodPeak("POS", POS_VERSION, 72.0, 8.0),
        MethodPeak("CHROM", CHROM_VERSION, 73.0, 5.0),
        MethodPeak("GREEN", GREEN_VERSION, 71.0, 4.0),
        (72.0, 73.0),
        (73.0, 72.0),
    )
    assert decision.validity_status == "VALID"
    assert decision.value_bpm == 72.0


def test_weak_signal_stays_hidden() -> None:
    decision = decide(
        _context(),
        MethodPeak("POS", POS_VERSION, 72.0, -2.0),
        MethodPeak("CHROM", CHROM_VERSION, 73.0, -2.5),
        MethodPeak("GREEN", GREEN_VERSION, 74.0, -3.0),
        (72.0, 72.0),
        (73.0, 73.0),
    )
    assert decision.value_bpm is None
    assert any("too weak" in reason for reason in decision.rejection_reasons)
