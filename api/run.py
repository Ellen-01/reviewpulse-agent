from __future__ import annotations

import os

import uvicorn


def main() -> None:
    raw_port = os.environ.get("PORT", "7860")
    try:
        port = int(raw_port)
    except ValueError as exc:
        raise SystemExit(f"PORT debe ser un entero, se recibió {raw_port!r}.") from exc
    if not 1 <= port <= 65535:
        raise SystemExit("PORT debe estar entre 1 y 65535.")
    uvicorn.run("api.main:app", host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
