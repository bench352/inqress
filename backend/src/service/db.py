from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

_DB_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_DB_PATH = _DB_DIR / "inqress.db"

_DB_DIR.mkdir(parents=True, exist_ok=True)
ENGINE = create_engine(f"sqlite:///{_DB_PATH}")


@event.listens_for(ENGINE, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.close()


@contextmanager
def get_session() -> Generator[Session, None, None]:
    session = Session(ENGINE)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
