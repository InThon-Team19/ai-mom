# 담당: 민주
from sqlmodel import SQLModel, Session, create_engine

from app.config import DB_URL

engine = create_engine(DB_URL, connect_args={"check_same_thread": False})


def init_db() -> None:
    from app import models  # noqa: F401  (테이블 등록)
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
