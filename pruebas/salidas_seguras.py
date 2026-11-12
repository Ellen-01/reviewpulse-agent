"""Creación de destinos de salida nuevos sin reemplazar ejecuciones anteriores."""
from pathlib import Path
import tempfile


def crear_destino_aislado(base: Path, prefijo: str) -> Path:
    base.mkdir(parents=True, exist_ok=True)
    return Path(tempfile.mkdtemp(prefix=f"{prefijo}_", dir=base))
