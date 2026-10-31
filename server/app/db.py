# 담당: 민주
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy import event

from app.config import DB_URL

engine = create_engine(DB_URL, connect_args={"check_same_thread": False, "timeout": 30} if DB_URL.startswith("sqlite") else {})

if DB_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def configure_sqlite(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=30000")


def init_db() -> None:
    from app import models  # noqa: F401  (테이블 등록)
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine, expire_on_commit=False) as session:
        yield session
