# FACE LANDMARKS FOR REGION PLACEMENT.
"""Find a face so the pulse check can sample skin. This is not identification."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "face_landmarker.task"


@dataclass
class Faces:
    count: int = 0
    landmarks: list = field(default_factory=list)
    boxes: list[tuple[int, int, int, int]] = field(default_factory=list)
    backend: str = "none"


class FaceTracker:
    def __init__(self, model_path: Path | None = None) -> None:
        self._landmarker = None
        self._image_module = None
        self._haar = None
        self.backend = "none"
        self._timestamp_ms = 0
        path = model_path or MODEL_PATH
        self.model_present = path.exists()
        if self.model_present:
            try:
                import mediapipe as mp
                from mediapipe.tasks import python as mp_python
                from mediapipe.tasks.python import vision

                options = vision.FaceLandmarkerOptions(
                    base_options=mp_python.BaseOptions(
                        model_asset_path=str(path),
                        delegate=mp_python.BaseOptions.Delegate.CPU,
                    ),
                    running_mode=vision.RunningMode.VIDEO,
                    num_faces=2,
                    min_face_detection_confidence=0.5,
                    min_face_presence_confidence=0.5,
                    min_tracking_confidence=0.5,
                )
                self._image_module = mp
                self._landmarker = vision.FaceLandmarker.create_from_options(options)
                self.backend = "mediapipe"
            except Exception as error:  # noqa: BLE001 — the camera loop must keep running
                self._landmarker = None
                self.import_error = str(error)
            else:
                self.import_error = ""
        else:
            self.import_error = "face landmark model file is missing"
        if self._landmarker is None:
            cascade = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
            self._haar = cv2.CascadeClassifier(str(cascade))
            self.backend = "haar" if not self._haar.empty() else "none"

    def detect(self, frame_bgr: np.ndarray) -> Faces:
        if self._landmarker is not None and self._image_module is not None:
            rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            image = self._image_module.Image(image_format=self._image_module.ImageFormat.SRGB, data=rgb)
            self._timestamp_ms += 33
            result = self._landmarker.detect_for_video(image, self._timestamp_ms)
            landmarks = result.face_landmarks or []
            return Faces(count=len(landmarks), landmarks=landmarks, backend="mediapipe")
        if self._haar is not None and not self._haar.empty():
            gray = cv2.equalizeHist(cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY))
            boxes = self._haar.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(80, 80))
            converted = [tuple(int(value) for value in box) for box in boxes]
            return Faces(count=len(converted), boxes=converted, backend="haar")
        return Faces(backend="none")

    def close(self) -> None:
        if self._landmarker is not None:
            self._landmarker.close()
            self._landmarker = None
