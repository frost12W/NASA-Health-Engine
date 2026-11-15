# CAMERA OPENING: BUSY DEVICE, RETRY, AND ERROR MESSAGES WITHOUT REAL HARDWARE.
from __future__ import annotations

import numpy as np
import pytest

from worker import engine


class FakeCapture:
    """Stands in for cv2.VideoCapture. `script` decides how each open behaves."""

    def __init__(self, script, state):
        self.state = state
        self.opened = script(state["opens"])
        self.state["opens"] += 1
        self.released = False
        self.has_frame = self.state.get("has_frame", True)

    def isOpened(self) -> bool:
        return bool(self.opened)

    def release(self) -> None:
        self.released = True
        self.state["released"].append(self)

    def set(self, *_args) -> bool:
        return True

    def get(self, prop) -> float:
        return 30.0

    def read(self):
        if not self.has_frame:
            return False, None
        return True, np.zeros((4, 4, 3), dtype=np.uint8)


def _patch(monkeypatch, script, **state):
    state.setdefault("opens", 0)
    state.setdefault("released", [])
    monkeypatch.setattr(
        engine.cv2,
        "VideoCapture",
        lambda index, flags=None: FakeCapture(script, state),
    )
    return state


def test_busy_camera_is_retried_and_then_opens(monkeypatch) -> None:
    # First round fails on every backend, the retry opens on the first one.
    state = _patch(monkeypatch, lambda opened: opened >= 3)

    cap, backend = engine.Engine()._open_backend(0, request_yuy2=False)

    assert cap is not None
    assert backend == "CAP_DSHOW"
    assert state["opens"] == 4
    assert len(state["released"]) == 3


def test_every_attempted_open_is_released_when_nothing_opens(monkeypatch) -> None:
    state = _patch(monkeypatch, lambda opened: False)

    cap, backend = engine.Engine()._open_backend(0, request_yuy2=False)

    assert cap is None
    assert backend == "CAP_ANY"
    assert state["opens"] == engine.CAMERA_RETRY_ATTEMPTS * len(engine.CAMERA_BACKENDS)
    assert len(state["released"]) == state["opens"]


def test_messages_name_the_likely_cause() -> None:
    assert "used by another program" in engine.camera_open_error(2)
    assert "Camera 2" in engine.camera_open_error(2)
    assert "delivered no frames" in engine.camera_frame_error(1)


def test_open_reports_no_frames_without_a_second_retry_loop(monkeypatch) -> None:
    # Every open succeeds but the camera never delivers a frame.
    state = _patch(monkeypatch, lambda opened: True, has_frame=False)

    result = engine.Engine()._open(0)

    assert result["ok"] is False
    assert "delivered no frames" in result["error"]
    # Two configuration rounds: with YUY2 requested, then without it.
    assert state["opens"] == 2
