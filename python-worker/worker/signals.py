# POS, CHROM, AND GREEN ESTIMATORS FOR A FACE COLOR SIGNAL.
"""Estimate pulse rate from forehead and cheek color, then apply quality gates.

POS follows Wang et al., Algorithmic Principles of Remote PPG (2017).
CHROM follows de Haan and Jeanne, Robust Pulse Rate From Chrominance-Based rPPG (2013).
GREEN is a diagnostic baseline. It cannot accept a result by itself.
"""

from __future__ import annotations

import numpy as np
from scipy import signal

from worker.quality import (
    BAND_HIGH_HZ,
    BAND_LOW_HZ,
    CHROM_VERSION,
    GREEN_VERSION,
    MIN_HALF_SECONDS,
    POS_VERSION,
    Decision,
    MethodPeak,
    SeriesContext,
    decide,
)


def _as_matrix(rgb: np.ndarray) -> np.ndarray:
    matrix = np.asarray(rgb, dtype=np.float64)
    if matrix.ndim != 2 or matrix.shape[1] != 3:
        raise ValueError("expected an N by 3 array of red, green, and blue values")
    if not np.isfinite(matrix).all():
        raise ValueError("color values must be finite")
    return np.maximum(matrix, 1e-6)


def _center(values: np.ndarray) -> np.ndarray:
    return values - values.mean()


def pos_signal(rgb: np.ndarray) -> np.ndarray:
    colors = _as_matrix(rgb)
    normalized = colors / colors.mean(axis=0, keepdims=True) - 1.0
    first = normalized[:, 1] - normalized[:, 2]
    second = normalized[:, 1] + normalized[:, 2] - 2.0 * normalized[:, 0]
    scale = float(np.std(first) / (np.std(second) + 1e-9))
    return _center(first + scale * second)


def chrom_signal(rgb: np.ndarray) -> np.ndarray:
    colors = _as_matrix(rgb)
    normalized = colors / colors.mean(axis=0, keepdims=True) - 1.0
    first = 3.0 * normalized[:, 0] - 2.0 * normalized[:, 1]
    second = 1.5 * normalized[:, 0] + normalized[:, 1] - 1.5 * normalized[:, 2]
    scale = float(np.std(first) / (np.std(second) + 1e-9))
    return _center(first - scale * second)


def green_signal(rgb: np.ndarray) -> np.ndarray:
    colors = _as_matrix(rgb)
    green = colors[:, 1]
    return _center(green / max(float(green.mean()), 1e-6))


def bandpass(values: np.ndarray, sample_rate: float) -> np.ndarray:
    nyquist = sample_rate / 2.0
    high = min(BAND_HIGH_HZ, nyquist * 0.95)
    if high <= BAND_LOW_HZ or len(values) < 32:
        return _center(values)
    sos = signal.butter(3, [BAND_LOW_HZ / nyquist, high / nyquist], btype="band", output="sos")
    return signal.sosfiltfilt(sos, values)


def spectrum_peak(values: np.ndarray, sample_rate: float) -> tuple[float, float]:
    count = len(values)
    window = np.hanning(count)
    frequencies = np.fft.rfftfreq(count, d=1.0 / sample_rate)
    power = np.abs(np.fft.rfft(values * window)) ** 2
    band = (frequencies >= BAND_LOW_HZ) & (frequencies <= BAND_HIGH_HZ)
    if not np.any(band):
        return 0.0, 0.0
    local_index = int(np.argmax(power[band]))
    band_indexes = np.flatnonzero(band)
    peak_index = int(band_indexes[local_index])
    peak_frequency = float(frequencies[peak_index])
    if 0 < peak_index < len(frequencies) - 1:
        left, center, right = power[peak_index - 1], power[peak_index], power[peak_index + 1]
        denominator = left - 2.0 * center + right
        if abs(denominator) > 1e-12:
            delta = 0.5 * (left - right) / denominator
            refined = peak_frequency + delta * float(frequencies[1] - frequencies[0])
            if BAND_LOW_HZ <= refined <= BAND_HIGH_HZ:
                peak_frequency = float(refined)
    return peak_frequency, float(power[peak_index])


def signal_to_noise_db(values: np.ndarray, sample_rate: float, peak_hz: float) -> float:
    if peak_hz <= 0 or len(values) < 16:
        return -99.0
    segment = min(len(values), 256)
    frequencies, density = signal.welch(values, fs=sample_rate, nperseg=segment)
    band = (frequencies >= BAND_LOW_HZ) & (frequencies <= BAND_HIGH_HZ)
    around_peak = (frequencies >= peak_hz - 0.2) & (frequencies <= peak_hz + 0.2)
    signal_power = float(density[around_peak].sum())
    noise_power = float(density[band].sum()) - signal_power
    return float(10.0 * np.log10(max(signal_power, 1e-12) / max(noise_power, 1e-12)))


def _timing(timestamps: np.ndarray) -> tuple[float, float, float]:
    if len(timestamps) < 2:
        return 0.0, 0.0, 1.0
    intervals = np.diff(np.asarray(timestamps, dtype=np.float64))
    intervals = intervals[np.isfinite(intervals) & (intervals > 0)]
    if len(intervals) == 0:
        return 0.0, 0.0, 1.0
    median = float(np.median(intervals))
    if median <= 0:
        return 0.0, 0.0, 1.0
    sample_rate = 1.0 / median
    variation = float(np.std(intervals) / median)
    usable = float(timestamps[-1] - timestamps[0])
    return sample_rate, max(usable, 0.0), variation


def _peak(rgb: np.ndarray, sample_rate: float, method: str) -> MethodPeak:
    versions = {"POS": POS_VERSION, "CHROM": CHROM_VERSION, "GREEN": GREEN_VERSION}
    builders = {"POS": pos_signal, "CHROM": chrom_signal, "GREEN": green_signal}
    seconds = (len(rgb) / sample_rate) if sample_rate > 0 else 0.0
    if seconds < 3.0:
        return MethodPeak(method, versions[method], None, None)
    try:
        filtered = bandpass(builders[method](rgb), sample_rate)
        peak_hz, peak_power = spectrum_peak(filtered, sample_rate)
    except ValueError:
        return MethodPeak(method, versions[method], None, None)
    if peak_hz <= 0 or peak_power <= 0 or not np.isfinite(peak_hz):
        return MethodPeak(method, versions[method], None, None)
    bpm = 60.0 * peak_hz
    if not np.isfinite(bpm):
        return MethodPeak(method, versions[method], None, None)
    snr = signal_to_noise_db(filtered, sample_rate, peak_hz)
    return MethodPeak(method, versions[method], float(bpm), float(snr))


def _half_bpm(rgb: np.ndarray, sample_rate: float, method: str) -> float | None:
    seconds = (len(rgb) / sample_rate) if sample_rate > 0 else 0.0
    if seconds < MIN_HALF_SECONDS:
        return None
    return _peak(rgb, sample_rate, method).bpm


def evaluate_recording(
    rgb: np.ndarray,
    timestamps: np.ndarray,
    face_presence: float,
    motion_ratio: float,
    exposure_fail_ratio: float,
) -> Decision:
    matrix = _as_matrix(rgb) if len(rgb) else np.zeros((0, 3))
    sample_rate, usable, variation = _timing(np.asarray(timestamps, dtype=np.float64))
    if len(matrix) < 2 or sample_rate <= 0:
        empty = MethodPeak("POS", POS_VERSION, None, None)
        return decide(
            SeriesContext(usable, sample_rate, variation, face_presence, motion_ratio, exposure_fail_ratio),
            empty,
            MethodPeak("CHROM", CHROM_VERSION, None, None),
            MethodPeak("GREEN", GREEN_VERSION, None, None),
            (None, None),
            (None, None),
        )
    midpoint = len(matrix) // 2
    return decide(
        SeriesContext(usable, sample_rate, variation, face_presence, motion_ratio, exposure_fail_ratio),
        _peak(matrix, sample_rate, "POS"),
        _peak(matrix, sample_rate, "CHROM"),
        _peak(matrix, sample_rate, "GREEN"),
        (_half_bpm(matrix[:midpoint], sample_rate, "POS"), _half_bpm(matrix[midpoint:], sample_rate, "POS")),
        (
            _half_bpm(matrix[:midpoint], sample_rate, "CHROM"),
            _half_bpm(matrix[midpoint:], sample_rate, "CHROM"),
        ),
    )
