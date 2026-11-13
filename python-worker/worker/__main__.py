# STDIN COMMAND LOOP FOR THE LOCAL VISION WORKER.
"""Read one JSON command per line and write one JSON message per line."""

from __future__ import annotations

import json
import sys
import threading

from worker.protocol import WORKER_VERSION, emit_line, response


def write(body: dict) -> None:
    emit_line(body)


def fail_closed(message: str) -> None:
    for line in sys.stdin:
        text = line.strip()
        if not text:
            continue
        try:
            incoming = json.loads(text)
        except json.JSONDecodeError:
            write(response(None, False, error="the command was not valid JSON"))
            continue
        request_id = incoming.get("request_id")
        command = incoming.get("command")
        if command == "health":
            write(response(request_id, True, {"ready": False, "worker_version": WORKER_VERSION, "import_error": message}))
        elif command == "shutdown":
            write(response(request_id, True, {}))
            return
        else:
            write(response(request_id, False, error=message))


def list_cameras(max_index: int = 5) -> list[dict]:
    import cv2

    found = []
    for index in range(max_index):
        capture = cv2.VideoCapture(index, cv2.CAP_DSHOW)
        opened = capture.isOpened()
        capture.release()
        if opened:
            found.append({"device_index": index, "device_id": f"index:{index}", "label": f"Camera {index}"})
    return found


def serve() -> None:
    from worker.engine import Engine
    from worker.face import MODEL_PATH

    engine = Engine()

    def pump() -> None:
        while True:
            body = engine.outbound.get()
            if body is None:
                return
            write(body)

    threading.Thread(target=pump, name="health-engine-writer", daemon=True).start()
    try:
        for line in sys.stdin:
            text = line.strip()
            if not text:
                continue
            if len(text) > 1_000_000:
                write(response(None, False, error="the command is too large"))
                continue
            try:
                incoming = json.loads(text)
            except json.JSONDecodeError:
                write(response(None, False, error="the command was not valid JSON"))
                continue
            request_id = incoming.get("request_id") if isinstance(incoming.get("request_id"), str) else None
            if incoming.get("protocol_version") != 1 or request_id is None:
                write(response(request_id, False, error="protocol_version 1 and request_id are required"))
                continue
            command = incoming.get("command")
            if command == "health":
                tracker_ready = MODEL_PATH.exists()
                write(
                    response(
                        request_id,
                        True,
                        {
                            "ready": True,
                            "worker_version": WORKER_VERSION,
                            "protocol_version": 1,
                            "model_present": tracker_ready,
                            "opencv": True,
                        },
                    )
                )
            elif command == "list_cameras":
                if engine.camera_open.is_set():
                    write(response(request_id, False, error="Close the camera before scanning for devices."))
                else:
                    write(response(request_id, True, {"cameras": list_cameras()}))
            elif command == "open_camera":
                result = engine.wait("open", incoming.get("device_index", 0), 10)
                write(response(request_id, result.get("ok", False), result, None if result.get("ok") else result.get("error")))
            elif command == "close_camera":
                result = engine.wait("close", None, 5)
                write(response(request_id, result.get("ok", False), result, result.get("error")))
            elif command == "start_measurement":
                result = engine.wait("start", incoming, 5)
                write(response(request_id, result.get("ok", False), result, None if result.get("ok") else result.get("error")))
            elif command == "stop_measurement":
                result = engine.wait("stop", None, 5)
                write(response(request_id, result.get("ok", False), result, result.get("error")))
            elif command == "shutdown":
                engine.close()
                write(response(request_id, True, {}))
                return
            else:
                write(response(request_id, False, error="unknown command"))
    finally:
        engine.close()


def main() -> None:
    try:
        serve()
    except Exception as error:  # noqa: BLE001 — report a broken runtime instead of exiting silently
        fail_closed(f"The vision worker could not start: {error}")


if __name__ == "__main__":
    main()
