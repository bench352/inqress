import contextlib
import pathlib
import typing

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

_DB_DIR = pathlib.Path(__file__).resolve().parent.parent.parent / "data"
_DB_PATH = _DB_DIR / "inqress.db"

_DB_DIR.mkdir(parents=True, exist_ok=True)
ENGINE = create_engine(f"sqlite:///{_DB_PATH}")


@event.listens_for(ENGINE, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.close()


@contextlib.contextmanager
def get_session() -> typing.Generator[Session, None, None]:
    session = Session(ENGINE)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
