# JSON LINES PROTOCOL FOR THE LOCAL VISION WORKER.
"""Versioned messages between the desktop core and this worker."""

from __future__ import annotations

import json
import sys
import threading
from typing import Any

_STDOUT_LOCK = threading.Lock()

PROTOCOL_VERSION = 1
WORKER_VERSION = "0.1.0"


def response(request_id: str | None, ok: bool, payload: dict | None = None, error: str | None = None) -> dict:
    return {
        "protocol_version": PROTOCOL_VERSION,
        "type": "response",
        "request_id": request_id,
        "ok": bool(ok),
        "payload": payload or {},
        "error": error,
    }


def event(name: str, payload: dict[str, Any]) -> dict:
    body = {
        "protocol_version": PROTOCOL_VERSION,
        "type": "event",
        "event": name,
        "worker_version": WORKER_VERSION,
    }
    body.update(payload)
    return body


def dumps(body: dict) -> str:
    return json.dumps(body, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


def emit_line(body: dict) -> None:
    text = dumps(body) + "\n"
    with _STDOUT_LOCK:
        sys.stdout.write(text)
        sys.stdout.flush()
