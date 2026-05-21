from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

_DB_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_DB_PATH = _DB_DIR / "inqress.db"

_DB_DIR.mkdir(parents=True, exist_ok=True)
ENGINE = create_engine(f"sqlite:///{_DB_PATH}")


def get_engine() -> Engine:
    return ENGINE
