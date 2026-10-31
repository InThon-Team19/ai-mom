"""Opt-in live PostgreSQL checks. Uses an isolated random schema, never public.

TEST_POSTGRES_URL must point to a disposable test database with CREATE SCHEMA rights.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import os
from uuid import uuid4

from fastapi import HTTPException
import pytest
from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable
from sqlmodel import Session, SQLModel, create_engine, select

from app.auth import digest, issue_token, password_hash, rate_limit
from app.migrations import upgrade
from app.models import AccessToken, LoginAccount, Parent, now


def test_postgres_timestamp_ddl():
    ddl = str(CreateTable(AccessToken.__table__).compile(dialect=postgresql.dialect()))
    assert "TIMESTAMP WITH TIME ZONE" in ddl


@pytest.fixture
def postgres_engine():
    url = os.getenv("TEST_POSTGRES_URL")
    if not url:
        pytest.skip("TEST_POSTGRES_URL not set; live PostgreSQL validation requires a test database")
    if url.startswith(("postgres://", "postgresql://")):
        url = "postgresql+psycopg://" + url.split("://", 1)[1]
    admin = create_engine(url)
    schema = "aibom_test_" + uuid4().hex
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    try:
        with engine.begin() as connection:
            SQLModel.metadata.create_all(connection)
            upgrade(connection)
        yield engine
    finally:
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


def test_postgres_migration_rls_and_expiry(postgres_engine):
    with postgres_engine.begin() as connection:
        upgrade(connection)
        rows = connection.execute(text("SELECT relname, relrowsecurity FROM pg_class JOIN pg_namespace ON pg_namespace.oid=pg_class.relnamespace WHERE nspname=current_schema() AND relkind='r'"))
        assert all(row.relrowsecurity for row in rows)
    with Session(postgres_engine) as db:
        parent = Parent(email="test@example.com", display_name="부모", password_hash=password_hash("test-password"))
        db.add(parent)
        db.flush()
        raw = issue_token(db, parent.id)["access_token"]
        db.commit()
        token = db.exec(select(AccessToken).where(AccessToken.token_hash == digest(raw))).one()
        assert token.expires_at.tzinfo is not None and token.expires_at > now()
        token.expires_at = now() - timedelta(seconds=1)
        db.add(token)
        db.commit()
        assert db.exec(select(AccessToken).where(AccessToken.expires_at > now())).all() == []


def test_postgres_parallel_rate_limit(postgres_engine):
    def attempt(_):
        with Session(postgres_engine) as db:
            try:
                rate_limit(db, "parallel-check", 5)
                return 200
            except HTTPException as exc:
                return exc.status_code
    with ThreadPoolExecutor(max_workers=5) as workers:
        results = list(workers.map(attempt, range(10)))
    assert results.count(200) == 5 and results.count(429) == 5
