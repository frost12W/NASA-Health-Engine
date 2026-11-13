# CAMERA FOURCC TEXT FOR HONEST CAPTURE REPORTING.
"""Turns a driver format code into text without claiming a mode was granted."""

from __future__ import annotations


def fourcc_to_text(value: float | int) -> str:
    code = int(value) & 0xFFFFFFFF
    chars: list[str] = []
    for shift in range(4):
        byte = (code >> (8 * shift)) & 0xFF
        if 32 <= byte <= 126:
            chars.append(chr(byte))
        else:
            return f"0x{code:08X}"
    text = "".join(chars).strip()
    return text or f"0x{code:08X}"
