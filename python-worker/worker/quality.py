# EXPERIMENTAL QUALITY GATES FOR A FACE PULSE ESTIMATE.
"""Decide whether a pulse number may be shown.

The numbers below are demonstration settings for this program.
They are not a medical standard, and the score is not the probability
that a pulse value is correct.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Experimental band reported by the first camera trial: 42–132 bpm.
# It is configurable here and is not an approved physiological limit.
BAND_LOW_HZ = 0.7
BAND_HIGH_HZ = 2.2

MIN_USABLE_SECONDS = 8.0
MIN_EFFECTIVE_FPS = 12.0
MAX_INTERVAL_CV = 0.35
MIN_FACE_PRESENCE = 0.80
MAX_MOTION_RATIO = 0.40
MAX_EXPOSURE_FAIL_RATIO = 0.40
MAX_METHOD_DISAGREEMENT_BPM = 6.0
MIN_SNR_DB = 0.0
MAX_HALF_DISAGREEMENT_BPM = 8.0
MIN_HALF_SECONDS = 4.0

POS_VERSION = "pos-wang-2017-v1"
CHROM_VERSION = "chrom-dehaan-2013-v1"
GREEN_VERSION = "green-channel-v1"


@dataclass
class SeriesContext:
    usable_seconds: float
    effective_fps: float
    interval_cv: float
    face_presence: float
    motion_ratio: float
    exposure_fail_ratio: float


@dataclass
class MethodPeak:
    name: str
    version: str
    bpm: float | None
    snr_db: float | None


@dataclass
class Decision:
    validity_status: str
    value_bpm: float | None
    quality_score: float
    quality_components: dict
    rejection_reasons: list[str] = field(default_factory=list)
    selected_method: str | None = None
    selected_version: str | None = None


def _round_optional(value: float | None, digits: int = 2) -> float | None:
    if value is None:
        return None
    return round(float(value), digits)


def decide(
    context: SeriesContext,
    pos: MethodPeak,
    chrom: MethodPeak,
    green: MethodPeak,
    pos_halves: tuple[float | None, float | None],
    chrom_halves: tuple[float | None, float | None],
) -> Decision:
    reasons: list[str] = []
    gates: list[tuple[str, bool]] = []

    duration_ok = context.usable_seconds >= MIN_USABLE_SECONDS
    gates.append(("usable_duration", duration_ok))
    if not duration_ok:
        reasons.append(
            f"The usable face signal is shorter than {MIN_USABLE_SECONDS:.0f} seconds."
        )

    fps_ok = context.effective_fps >= MIN_EFFECTIVE_FPS
    gates.append(("effective_fps", fps_ok))
    if not fps_ok:
        reasons.append(
            f"The camera delivered {context.effective_fps:.1f} frames per second. "
            f"This experimental check needs at least {MIN_EFFECTIVE_FPS:.0f}."
        )

    regular_ok = context.interval_cv <= MAX_INTERVAL_CV
    gates.append(("frame_timing", regular_ok))
    if not regular_ok:
        reasons.append("Frames did not arrive at a steady rate.")

    face_ok = context.face_presence >= MIN_FACE_PRESENCE
    gates.append(("face_presence", face_ok))
    if not face_ok:
        reasons.append("The face was not visible for enough of the recording.")

    motion_ok = context.motion_ratio <= MAX_MOTION_RATIO
    gates.append(("motion", motion_ok))
    if not motion_ok:
        reasons.append("Movement interrupted too much of the recording.")

    exposure_ok = context.exposure_fail_ratio <= MAX_EXPOSURE_FAIL_RATIO
    gates.append(("exposure", exposure_ok))
    if not exposure_ok:
        reasons.append("The image was too dark or too bright for too much of the recording.")

    both_peaks = pos.bpm is not None and chrom.bpm is not None
    gates.append(("both_methods", both_peaks))
    if not both_peaks:
        reasons.append("The two color methods did not both find a pulse-frequency peak.")

    disagreement = None
    agree = False
    if both_peaks and pos.bpm is not None and chrom.bpm is not None:
        disagreement = abs(pos.bpm - chrom.bpm)
        agree = disagreement <= MAX_METHOD_DISAGREEMENT_BPM
    gates.append(("method_agreement", agree))
    if both_peaks and not agree:
        reasons.append("The two color methods did not agree with each other.")

    selected = pos if (pos.snr_db or -999.0) >= (chrom.snr_db or -999.0) else chrom
    snr_ok = bool(agree and selected.snr_db is not None and selected.snr_db >= MIN_SNR_DB)
    gates.append(("snr", snr_ok))
    if agree and not snr_ok:
        reasons.append("The signal is too weak to trust as a pulse estimate.")

    halves = pos_halves if selected.name == "POS" else chrom_halves
    half_gap = None
    half_ok = False
    if selected.bpm is not None and halves[0] is not None and halves[1] is not None:
        half_gap = abs(halves[0] - halves[1])
        half_ok = half_gap <= MAX_HALF_DISAGREEMENT_BPM
    gates.append(("half_window", half_ok))
    if not half_ok:
        reasons.append("The estimate was not stable across the recording.")

    passed = sum(1 for _, ok in gates if ok)
    score = passed / len(gates)
    components = {
        "score_meaning": (
            "Fraction of experimental quality checks that passed. "
            "Not a probability that the pulse is correct."
        ),
        "gates": {name: ok for name, ok in gates},
        "usable_seconds": round(context.usable_seconds, 3),
        "effective_fps": round(context.effective_fps, 3),
        "interval_cv": round(context.interval_cv, 3),
        "face_presence": round(context.face_presence, 3),
        "motion_ratio": round(context.motion_ratio, 3),
        "exposure_fail_ratio": round(context.exposure_fail_ratio, 3),
        "pos_bpm_diagnostic": _round_optional(pos.bpm, 1),
        "chrom_bpm_diagnostic": _round_optional(chrom.bpm, 1),
        "green_bpm_diagnostic": _round_optional(green.bpm, 1),
        "pos_snr_db": _round_optional(pos.snr_db, 2),
        "chrom_snr_db": _round_optional(chrom.snr_db, 2),
        "green_snr_db": _round_optional(green.snr_db, 2),
        "method_disagreement_bpm": _round_optional(disagreement, 2),
        "half_disagreement_bpm": _round_optional(half_gap, 2),
        "band_hz": [BAND_LOW_HZ, BAND_HIGH_HZ],
        "thresholds_are_experimental": True,
    }

    if passed == len(gates) and selected.bpm is not None:
        return Decision(
            validity_status="VALID",
            value_bpm=round(float(selected.bpm), 1),
            quality_score=round(score, 3),
            quality_components=components,
            rejection_reasons=[],
            selected_method=selected.name,
            selected_version=selected.version,
        )

    return Decision(
        validity_status="INCONCLUSIVE",
        value_bpm=None,
        quality_score=round(score, 3),
        quality_components=components,
        rejection_reasons=reasons or ["No reliable estimate was obtained."],
        selected_method=None,
        selected_version=None,
    )
