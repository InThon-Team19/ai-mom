# 담당: 민주
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy import event
from sqlalchemy.engine import make_url

from app.config import DB_URL

_url = make_url(DB_URL)
_connect_args = {"check_same_thread": False, "timeout": 30} if _url.get_backend_name() == "sqlite" else {"connect_timeout": 10}
if _url.drivername == "postgresql+psycopg":
    _connect_args["prepare_threshold"] = None  # Also supports Supabase transaction poolers.
    if _url.host not in {None, "localhost", "127.0.0.1", "::1"} and "sslmode" not in _url.query:
        _connect_args["sslmode"] = "require"
engine = create_engine(DB_URL, pool_pre_ping=True, connect_args=_connect_args)

if DB_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def configure_sqlite(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=30000")


def init_db() -> None:
    from app import models  # noqa: F401  (테이블 등록)
    from app.migrations import upgrade
    with engine.begin() as connection:
        if connection.dialect.name == "postgresql":
            connection.exec_driver_sql("SELECT pg_advisory_xact_lock(6169626)")
        SQLModel.metadata.create_all(connection)
        upgrade(connection)


def get_session():
    with Session(engine, expire_on_commit=False) as session:
        yield session
