# CAMERA LOOP AND MEASUREMENT SESSION FOR THE LOCAL WORKER.
"""Own the camera on this computer. Frames stay in memory for the session."""

from __future__ import annotations

import base64
import queue
import threading
import time
from datetime import datetime, timezone

import cv2
import numpy as np

from worker.face import FaceTracker
from worker.format import fourcc_to_text
from worker.protocol import WORKER_VERSION, event
from worker.roi import draw_regions, mean_rgb_regions, regions_from_box, regions_from_landmarks, scale_regions
from worker.signals import evaluate_recording

MOTION_LIMIT = 8.0
PREVIEW_SECONDS = 1.0 / 60.0
PROGRESS_SECONDS = 0.25
DETECT_SECONDS = 0.05
PREVIEW_WIDTH = 640
CHECK_SECONDS = 30.0

# A camera can be busy for a moment while another program is releasing it.
CAMERA_RETRY_ATTEMPTS = 3
CAMERA_RETRY_DELAY_SECONDS = 0.35
CAMERA_BACKENDS = (
    ("CAP_DSHOW", cv2.CAP_DSHOW),
    ("CAP_MSMF", cv2.CAP_MSMF),
    ("CAP_ANY", cv2.CAP_ANY),
)


def camera_open_error(index: int) -> str:
    """Busy, unplugged, and privacy-blocked cameras all fail the same way."""
    return (
        f"Camera {index} did not open. It may be used by another program, "
        "unplugged, or blocked by Windows camera privacy settings."
    )


def camera_frame_error(index: int) -> str:
    return (
        f"Camera {index} opened but delivered no frames. "
        "Close other programs that use the camera and try again."
    )



def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class Engine:
    def __init__(self) -> None:
        self.control: queue.Queue = queue.Queue()
        self.outbound: queue.Queue = queue.Queue()
        self.stop = threading.Event()
        self.closed = threading.Event()
        self.camera_open = threading.Event()
        self.cap = None
        self.tracker: FaceTracker | None = None
        self.meta: dict = {}
        self.measure: dict | None = None
        self.prev_small = None
        self.last_preview = 0.0
        self.last_progress = 0.0
        self.last_faces = None
        self.last_regions = None
        self.last_detect = 0.0
        self.frame_times: list[float] = []
        self.thread = threading.Thread(target=self._run, name="health-engine-camera", daemon=True)
        self.thread.start()

    def close(self) -> None:
        if self.closed.is_set():
            return
        self.closed.set()
        done: queue.Queue = queue.Queue(1)
        self.control.put(("shutdown", None, done))
        try:
            done.get(timeout=2)
        except queue.Empty:
            pass
        self.stop.set()
        self.thread.join(timeout=2)

    def wait(self, kind: str, payload, timeout: float) -> dict:
        done: queue.Queue = queue.Queue(1)
        self.control.put((kind, payload, done))
        try:
            return done.get(timeout=timeout)
        except queue.Empty:
            return {"ok": False, "error": f"{kind} timed out"}

    def _emit(self, name: str, payload: dict) -> None:
        self.outbound.put(event(name, payload))

    def _run(self) -> None:
        while not self.stop.is_set():
            self._drain()
            if self.cap is None:
                time.sleep(0.05)
                continue
            ok, frame = self.cap.read()
            if not ok or frame is None:
                self._fail_device("The camera stopped delivering frames.")
                continue
            try:
                self._on_frame(frame)
            except Exception as error:  # noqa: BLE001 — keep the worker alive and report the fault
                self._fail_device(f"The camera loop failed: {error}")

    def _drain(self) -> None:
        while True:
            try:
                kind, payload, done = self.control.get_nowait()
            except queue.Empty:
                return
            try:
                if kind == "shutdown":
                    self._release()
                    self.stop.set()
                    done.put({"ok": True})
                    return
                if kind == "open":
                    done.put(self._open(int(payload)))
                elif kind == "close":
                    self._release()
                    done.put({"ok": True})
                elif kind == "start":
                    done.put(self._start(payload))
                elif kind == "stop":
                    self._finish("ABORTED")
                    done.put({"ok": True})
                else:
                    done.put({"ok": False, "error": f"unknown camera command {kind}"})
            except Exception as error:  # noqa: BLE001 — reply to the waiting command
                done.put({"ok": False, "error": str(error)})

    def _release(self) -> None:
        self._finish("ABORTED")
        if self.tracker is not None:
            self.tracker.close()
            self.tracker = None
        if self.cap is not None:
            self.cap.release()
            self.cap = None
        self.camera_open.clear()
        self.meta = {}
        self.prev_small = None
        self.last_faces = None
        self.last_regions = None
        self.last_detect = 0.0
        self.frame_times = []

    def _open_backend(self, index: int, request_yuy2: bool):
        """Try every backend, then retry: a busy camera often frees up in a moment."""
        backend = "CAP_ANY"
        for attempt in range(CAMERA_RETRY_ATTEMPTS):
            for name, flags in CAMERA_BACKENDS:
                cap = cv2.VideoCapture(index, flags)
                if cap is not None and cap.isOpened():
                    backend = name
                    return self._configure(cap, request_yuy2), backend
                if cap is not None:
                    cap.release()
            if attempt + 1 < CAMERA_RETRY_ATTEMPTS:
                time.sleep(CAMERA_RETRY_DELAY_SECONDS)
        return None, backend

    def _configure(self, cap, request_yuy2: bool):
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        if request_yuy2:
            cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"YUY2"))
        # The driver is not pinned at 30. The highest rate it grants for this size is kept.
        prefer_fastest_rate(cap)
        try:
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            pass
        return cap

    def _read_meta(self, cap, backend: str, index: int, requested_yuy2: bool) -> dict:
        pixel_format = fourcc_to_text(cap.get(cv2.CAP_PROP_FOURCC))
        return {
            "device_index": index,
            "device_id": f"index:{index}",
            "backend": backend,
            "pixel_format": pixel_format,
            "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            "nominal_fps": float(cap.get(cv2.CAP_PROP_FPS)),
            "measured_fps": None,
            "yuy2_requested": requested_yuy2,
            "yuy2_active": pixel_format == "YUY2",
        }

    def _open(self, index: int) -> dict:
        self._release()
        cap, backend = self._open_backend(index, True)
        if cap is None:
            return {"ok": False, "error": camera_open_error(index)}
        ok, frame = cap.read()
        if not ok or frame is None:
            cap.release()
            cap, backend = self._open_backend(index, False)
            if cap is None:
                return {"ok": False, "error": camera_open_error(index)}
            ok, frame = cap.read()
            if not ok or frame is None:
                cap.release()
                return {"ok": False, "error": camera_frame_error(index)}
            requested = False
        else:
            requested = True
        self.cap = cap
        self.tracker = FaceTracker()
        self.meta = self._read_meta(cap, backend, index, requested)
        self.camera_open.set()
        self._on_frame(frame)
        return {"ok": True, "capture": self.meta, "detector": self.tracker.backend}

    def _start(self, payload: dict) -> dict:
        if self.cap is None:
            return {"ok": False, "error": "Open a camera before starting a measurement."}
        if self.measure is not None:
            return {"ok": False, "error": "A measurement is already running."}
        duration = float(payload.get("duration_seconds", CHECK_SECONDS))
        duration = min(60.0, max(8.0, duration))
        self.measure = {
            "session_id": str(payload.get("session_id") or ""),
            "astronaut_id": str(payload.get("astronaut_id") or ""),
            "duration": duration,
            "started_perf": time.perf_counter(),
            "started_utc": utc_now(),
            "samples": [],
            "frames": 0,
            "face_frames": 0,
            "motion_frames": 0,
            "exposure_frames": 0,
        }
        self._emit("progress", self._progress_payload(0.0))
        return {"ok": True, "session_id": self.measure["session_id"], "duration_seconds": duration}

    def _progress_payload(self, elapsed: float) -> dict:
        measure = self.measure or {}
        return {
            "session_id": measure.get("session_id"),
            "elapsed_seconds": round(elapsed, 2),
            "duration_seconds": measure.get("duration", 0),
            "status": "COLLECTING",
            "usable_frames": len(measure.get("samples", [])),
        }

    def _on_frame(self, frame: np.ndarray) -> None:
        assert self.tracker is not None
        now = time.perf_counter()
        self._note_frame_rate(now)
        if self.last_faces is None or now - self.last_detect >= DETECT_SECONDS:
            faces = self._detect_scaled(frame)
            self.last_faces = faces
            self.last_detect = now
            regions = None
            if faces.count == 1 and faces.landmarks:
                regions = regions_from_landmarks(faces.landmarks[0], frame.shape[1], frame.shape[0])
            elif faces.count == 1 and faces.boxes:
                regions = regions_from_box(faces.boxes[0])
            self.last_regions = regions
        else:
            faces = self.last_faces
            regions = self.last_regions
        color = mean_rgb_regions(frame, regions) if regions is not None else None

        small = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (160, 90))
        brightness = float(small.mean())
        exposure_bad = brightness < 25.0 or brightness > 240.0
        motion = 0.0
        if self.prev_small is not None:
            motion = float(np.mean(np.abs(small.astype(np.float32) - self.prev_small)))
        self.prev_small = small
        motion_bad = motion > MOTION_LIMIT

        if self.measure is not None:
            self.measure["frames"] += 1
            if exposure_bad:
                self.measure["exposure_frames"] += 1
            if motion_bad:
                self.measure["motion_frames"] += 1
            if faces.count == 1 and color is not None and not exposure_bad and not motion_bad:
                self.measure["face_frames"] += 1
                self.measure["samples"].append((time.perf_counter(), float(color[0]), float(color[1]), float(color[2])))
            elapsed = time.perf_counter() - self.measure["started_perf"]
            now = time.perf_counter()
            if now - self.last_progress >= PROGRESS_SECONDS:
                self.last_progress = now
                self._emit("progress", self._progress_payload(elapsed))
            if elapsed >= self.measure["duration"]:
                self._finish("COMPLETE")

        if now - self.last_preview >= PREVIEW_SECONDS:
            self.last_preview = now
            self._emit("preview", self._preview_payload(frame, regions, faces, exposure_bad, motion_bad))

    def _note_frame_rate(self, now: float) -> None:
        self.frame_times.append(now)
        cutoff = now - 1.0
        while len(self.frame_times) > 2 and self.frame_times[0] < cutoff:
            self.frame_times.pop(0)
        if len(self.frame_times) >= 2:
            span = self.frame_times[-1] - self.frame_times[0]
            if span > 0:
                self.meta["measured_fps"] = round((len(self.frame_times) - 1) / span, 1)

    def _detect_scaled(self, frame: np.ndarray):
        assert self.tracker is not None
        height, width = frame.shape[:2]
        detect_frame = frame
        scale = 1.0
        if width > 360:
            scale = 360.0 / width
            detect_frame = cv2.resize(frame, (360, max(1, int(round(height * scale)))), interpolation=cv2.INTER_AREA)
        faces = self.tracker.detect(detect_frame)
        if scale != 1.0 and faces.boxes:
            inverse = 1.0 / scale
            faces.boxes = [tuple(int(round(value * inverse)) for value in box) for box in faces.boxes]
        return faces

    def _preview_payload(self, frame, regions, faces, exposure_bad: bool, motion_bad: bool) -> dict:
        message, can_start = readiness_message(faces, regions is not None, exposure_bad, motion_bad, self.tracker)
        height, width = frame.shape[:2]
        scale = 1.0
        if width > PREVIEW_WIDTH:
            scale = PREVIEW_WIDTH / width
            view = cv2.resize(frame, (PREVIEW_WIDTH, max(1, int(height * scale))), interpolation=cv2.INTER_LINEAR)
        else:
            view = frame.copy()
        if regions is not None:
            draw_regions(view, scale_regions(regions, scale) if scale != 1.0 else regions)
        cv2.putText(view, message[:70], (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (240, 240, 240), 2, cv2.LINE_AA)
        ok, encoded = cv2.imencode(".jpg", view, [int(cv2.IMWRITE_JPEG_QUALITY), 72])
        jpeg = base64.b64encode(encoded.tobytes()).decode("ascii") if ok else ""
        return {
            "jpeg_base64": jpeg,
            "readiness": {
                "can_start": can_start and self.measure is None,
                "message": message,
                "face_count": faces.count,
                "detector": faces.backend,
            },
            "capture": dict(self.meta),
        }

    def _finish(self, status: str) -> None:
        measure = self.measure
        if measure is None:
            return
        self.measure = None
        if status == "ABORTED":
            payload = result_payload(
                measure,
                validity="INVALID",
                status_name="ABORTED",
                reasons=["The measurement was stopped. Nothing was saved."],
            )
            payload["capture"] = dict(self.meta)
            self._emit("result", payload)
            return
        samples = measure["samples"]
        frames = max(int(measure["frames"]), 1)
        if len(samples) < 2:
            payload = result_payload(
                measure,
                validity="INCONCLUSIVE",
                status_name="INCONCLUSIVE",
                reasons=["No usable face signal was collected."],
            )
            payload["capture"] = dict(self.meta)
            self._emit("result", payload)
            return
        timestamps = np.array([sample[0] - samples[0][0] for sample in samples], dtype=np.float64)
        colors = np.array([[sample[1], sample[2], sample[3]] for sample in samples], dtype=np.float64)
        decision = evaluate_recording(
            colors,
            timestamps,
            face_presence=measure["face_frames"] / frames,
            motion_ratio=measure["motion_frames"] / frames,
            exposure_fail_ratio=measure["exposure_frames"] / frames,
        )
        payload = result_payload(
            measure,
            validity=decision.validity_status,
            status_name="VALID_ESTIMATE" if decision.validity_status == "VALID" else "INCONCLUSIVE",
            reasons=decision.rejection_reasons,
            value_bpm=decision.value_bpm,
            quality_score=decision.quality_score,
            quality_components=decision.quality_components,
            algorithm_name=decision.selected_method,
            algorithm_version=decision.selected_version,
        )
        if decision.quality_components:
            payload["effective_fps"] = decision.quality_components.get("effective_fps", payload["effective_fps"])
            payload["usable_duration_seconds"] = decision.quality_components.get(
                "usable_seconds", payload["usable_duration_seconds"]
            )
        payload["capture"] = dict(self.meta)
        self._emit("result", payload)

    def _fail_device(self, message: str) -> None:
        measure = self.measure
        meta = dict(self.meta)
        self.measure = None
        self._release()
        payload = {
            "session_id": None if measure is None else measure.get("session_id"),
            "astronaut_id": None if measure is None else measure.get("astronaut_id"),
            "status": "DEVICE_ERROR",
            "metric_type": "pulse_rate",
            "value_bpm": None,
            "validity_status": "INVALID",
            "quality_score": None,
            "quality_components": {},
            "rejection_reasons": [message],
            "algorithm_name": None,
            "algorithm_version": None,
            "capture": meta,
            "started_at_utc": None if measure is None else measure.get("started_utc"),
            "ended_at_utc": utc_now(),
            "usable_duration_seconds": 0,
            "effective_fps": 0,
            "diagnostic_summary": message,
            "worker_version": WORKER_VERSION,
        }
        self._emit("result", payload)


def prefer_fastest_rate(cap) -> None:
    """Keep the fastest rate the driver reports. The old 30 fps pin is not reapplied."""
    baseline = float(cap.get(cv2.CAP_PROP_FPS) or 0)
    chosen = baseline
    chosen_request = baseline
    for requested in (120, 90, 60):
        cap.set(cv2.CAP_PROP_FPS, float(requested))
        granted = float(cap.get(cv2.CAP_PROP_FPS) or 0)
        if granted > chosen + 0.5:
            chosen = granted
            chosen_request = granted
    if chosen_request > 0:
        cap.set(cv2.CAP_PROP_FPS, chosen_request)


def readiness_message(faces, has_region: bool, exposure_bad: bool, motion_bad: bool, tracker: FaceTracker | None) -> tuple[str, bool]:
    if tracker is None or tracker.backend != "mediapipe":
        return "Face landmarks are unavailable, so a face pulse check cannot start.", False
    if exposure_bad:
        return "Change the light so the face is neither dark nor washed out.", False
    if motion_bad:
        return "Hold still and look toward the camera.", False
    if faces.count == 0:
        return "Place one face in the frame.", False
    if faces.count > 1:
        return "Leave only one person in the frame.", False
    if not has_region:
        return "The forehead and cheeks are not clear enough.", False
    return "Hold still. The face check can start.", True


def result_payload(
    measure: dict,
    validity: str,
    status_name: str,
    reasons: list[str],
    value_bpm: float | None = None,
    quality_score: float | None = None,
    quality_components: dict | None = None,
    algorithm_name: str | None = None,
    algorithm_version: str | None = None,
) -> dict:
    samples = measure.get("samples", [])
    usable = 0.0
    fps = 0.0
    if len(samples) >= 2:
        usable = float(samples[-1][0] - samples[0][0])
        fps = (len(samples) - 1) / usable if usable > 0 else 0.0
    summary = reasons[0] if reasons else "Both color methods agreed on a pulse estimate. This is not a diagnosis."
    if validity == "VALID":
        summary = "Both color methods agreed on a pulse estimate. This is not a diagnosis."
    return {
        "session_id": measure.get("session_id"),
        "astronaut_id": measure.get("astronaut_id"),
        "status": status_name,
        "metric_type": "pulse_rate",
        "value_bpm": value_bpm if validity == "VALID" else None,
        "validity_status": validity if validity != "INVALID" else "INVALID",
        "quality_score": quality_score,
        "quality_components": quality_components or {},
        "rejection_reasons": reasons,
        "algorithm_name": algorithm_name,
        "algorithm_version": algorithm_version,
        "capture": {},
        "started_at_utc": measure.get("started_utc"),
        "ended_at_utc": utc_now(),
        "usable_duration_seconds": round(usable, 3),
        "effective_fps": round(fps, 3),
        "diagnostic_summary": summary,
        "worker_version": WORKER_VERSION,
    }
