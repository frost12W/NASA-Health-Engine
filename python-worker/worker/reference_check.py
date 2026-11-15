# COMPARE THE ONBOARD PULSE METHOD WITH AN OPEN REFERENCE RECORDING.
"""SCAMPS clips stay on disk D. They are not saved as this astronaut's check.

The same POS and CHROM gates used for the camera decide whether a number is kept.
A synthetic face can exercise the method. It does not prove the live camera.
"""

from __future__ import annotations

import json
import sys
import tarfile
from pathlib import Path

import numpy as np

from worker.engine import MOTION_LIMIT
from worker.signals import bandpass, evaluate_recording, spectrum_peak

DATASET_ROOT = Path(r"D:\HealthEngine-datasets")
SCAMPS_DIR = DATASET_ROOT / "scamps"
VIDEO_ARCHIVE = SCAMPS_DIR / "scamps_videos_example.tar.gz"
LABEL_ARCHIVE = SCAMPS_DIR / "scamps_waveforms_csv.tar.gz"
VIDEO_BYTES = 1_228_897_063
LABEL_BYTES = 61_824_513
REPORT_PATH = SCAMPS_DIR / "reference_report.json"
# SCAMPS renders each clip at 30 frames per second. The example archive does not store a time base.
SCAMPS_FPS = 30.0
EXPOSURE_DARK = 25.0
EXPOSURE_BRIGHT = 240.0

SOURCE = {
    "name": "SCAMPS example",
    "url": "https://facesyntheticspubwedata.z6.web.core.windows.net/neurips-2022/scamps_videos_example.tar.gz",
    "labels_url": "https://facesyntheticspubwedata.z6.web.core.windows.net/neurips-2022/scamps_waveforms_csv.tar.gz",
    "paper": "https://arxiv.org/abs/2206.04197",
    "kind": "synthetic face video with an aligned PPG waveform",
    "limit": "The authors state that a good result on these synthetic faces does not show that the method works on a real person.",
}


def archive_state(path: Path, expected: int | None) -> dict:
    if not path.exists():
        return {"present": False, "bytes": 0, "complete": False}
    size = path.stat().st_size
    complete = expected is None or size == expected
    return {"present": True, "bytes": size, "complete": complete}


def status() -> dict:
    return {
        "root": str(DATASET_ROOT),
        "source": SOURCE,
        "videos": archive_state(VIDEO_ARCHIVE, VIDEO_BYTES),
        "labels": archive_state(LABEL_ARCHIVE, LABEL_BYTES),
        "report": str(REPORT_PATH) if REPORT_PATH.exists() else None,
    }


def _orient_color(array: np.ndarray) -> np.ndarray:
    values = np.asarray(array)
    if values.ndim != 4:
        raise ValueError("a SCAMPS color clip must have four dimensions")
    if values.shape[0] == 3:
        values = np.moveaxis(values, 0, -1)
    elif values.shape[1] == 3:
        values = np.moveaxis(values, 1, -1)
    if values.shape[-1] != 3:
        raise ValueError("a SCAMPS color clip must end in red, green, and blue")
    return values


def _orient_mask(array: np.ndarray, frames: int) -> np.ndarray:
    mask = np.asarray(array)
    if mask.ndim == 2:
        return np.repeat(mask[:, :, None], frames, axis=2)
    if mask.shape[-1] == frames:
        return mask
    if mask.shape[0] == frames:
        return np.moveaxis(mask, 0, -1)
    raise ValueError("the skin mask does not match the clip length")


def _usable_series(color: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray, float, float, float]:
    frames = color.shape[0]
    small_h, small_w = 90, 160
    previous = None
    samples: list[tuple[float, float, float]] = []
    times: list[float] = []
    face_frames = 0
    motion_frames = 0
    exposure_frames = 0
    for index in range(frames):
        frame = color[index]
        gray = frame.mean(axis=2)
        brightness = float(gray.mean())
        exposure_bad = brightness < EXPOSURE_DARK or brightness > EXPOSURE_BRIGHT
        small = _resize_gray(gray, small_w, small_h)
        motion = 0.0 if previous is None else float(np.mean(np.abs(small - previous)))
        previous = small
        motion_bad = motion > MOTION_LIMIT
        skin = mask[:, :, index] > 0
        if exposure_bad:
            exposure_frames += 1
        if motion_bad:
            motion_frames += 1
        if int(skin.sum()) >= 20 and not exposure_bad and not motion_bad:
            face_frames += 1
            pixel = frame[skin].mean(axis=0)
            samples.append((float(pixel[0]), float(pixel[1]), float(pixel[2])))
            times.append(index / SCAMPS_FPS)
    count = max(frames, 1)
    colors = np.asarray(samples, dtype=np.float64) if samples else np.zeros((0, 3))
    timestamps = np.asarray(times, dtype=np.float64)
    return colors, timestamps, face_frames / count, motion_frames / count, exposure_frames / count


def _resize_gray(gray: np.ndarray, width: int, height: int) -> np.ndarray:
    y_index = np.linspace(0, gray.shape[0] - 1, height).astype(int)
    x_index = np.linspace(0, gray.shape[1] - 1, width).astype(int)
    return gray[np.ix_(y_index, x_index)].astype(np.float32)


def reference_bpm(ppg: np.ndarray) -> float | None:
    wave = np.asarray(ppg, dtype=np.float64).reshape(-1)
    if len(wave) < 32:
        return None
    filtered = bandpass(wave - float(wave.mean()), SCAMPS_FPS)
    peak_hz, peak_power = spectrum_peak(filtered, SCAMPS_FPS)
    if peak_hz <= 0 or peak_power <= 0:
        return None
    return round(60.0 * peak_hz, 1)


def score_clip(name: str, color: np.ndarray, mask: np.ndarray, ppg: np.ndarray) -> dict:
    colors, timestamps, face_presence, motion_ratio, exposure_ratio = _usable_series(color, mask)
    decision = evaluate_recording(colors, timestamps, face_presence, motion_ratio, exposure_ratio)
    reference = reference_bpm(ppg)
    ours = decision.value_bpm
    return {
        "clip": name,
        "frames": int(color.shape[0]),
        "reference_bpm": reference,
        "method_bpm": ours,
        "validity_status": decision.validity_status,
        "difference_bpm": None if ours is None or reference is None else round(abs(ours - reference), 1),
        "quality_score": decision.quality_score,
        "rejection_reasons": decision.rejection_reasons,
    }


def _member(archive: tarfile.TarFile, name: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    try:
        import h5py
    except ImportError as error:
        raise RuntimeError("h5py is required to read SCAMPS clips") from error
    extracted = SCAMPS_DIR / "clips"
    extracted.mkdir(parents=True, exist_ok=True)
    target = extracted / name
    if not target.exists():
        archive.extract(name, extracted)
    with h5py.File(target, "r") as handle:
        if "Xsub" not in handle or "d_ppg" not in handle:
            raise ValueError(f"{name} is missing the face crop or the PPG waveform")
        color = _orient_color(handle["Xsub"][()])
        ppg = np.asarray(handle["d_ppg"][()]).reshape(-1)
        if "skin_mask" in handle:
            mask = _orient_mask(handle["skin_mask"][()], color.shape[0])
        else:
            mask = np.ones((color.shape[1], color.shape[2], color.shape[0]), dtype=np.uint8)
    return color, mask, ppg


def compare() -> dict:
    body = status()
    if not body["videos"]["complete"]:
        body["clips"] = []
        body["note"] = "The SCAMPS example archive is not complete on this computer yet."
        return body
    clips = []
    with tarfile.open(VIDEO_ARCHIVE, "r:gz") as archive:
        names = [name for name in archive.getnames() if name.lower().endswith(".mat")]
        for name in names:
            color, mask, ppg = _member(archive, name)
            clips.append(score_clip(Path(name).stem, color, mask, ppg))
    body["clips"] = clips
    accepted = [clip for clip in clips if clip["validity_status"] == "VALID" and clip["difference_bpm"] is not None]
    body["accepted_count"] = len(accepted)
    body["clip_count"] = len(clips)
    if accepted:
        body["mean_abs_difference_bpm"] = round(sum(clip["difference_bpm"] for clip in accepted) / len(accepted), 1)
    else:
        body["mean_abs_difference_bpm"] = None
    body["note"] = "These clips are synthetic reference recordings. They are not this astronaut's check and not a diagnosis."
    REPORT_PATH.write_text(json.dumps(body, indent=2), encoding="utf-8")
    return body


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "status"
    payload = compare() if mode == "compare" else status()
    json.dump(payload, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001 — the desktop command needs one JSON error
        json.dump({"ok": False, "error": str(error)}, sys.stdout)
        sys.stdout.write("\n")
        raise SystemExit(1)
