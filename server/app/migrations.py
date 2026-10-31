"""Versioned, transactional upgrades. Source data is never deleted."""
from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, select


def bridge_legacy_accounts(db):
    from app.family import bridge_account
    from app.models import AccessToken, LoginAccount, LoginSession
    for account in db.exec(select(LoginAccount)).all():
        bridge_account(db, account)
        # Move old sessions into the shared token table without exposing raw tokens.
        for session in db.exec(select(LoginSession).where(LoginSession.account_id == account.id)).all():
            existing = db.exec(select(AccessToken).where(AccessToken.token_hash == session.token_hash)).first()
            if not existing:
                db.add(AccessToken(parent_id=account.id, token_hash=session.token_hash, expires_at=session.expires_at))
            db.delete(session)
        account.profile = {}  # FamilyProfile now owns the data.
        db.add(account)
    db.flush()


def upgrade(connection):
    from app.models import SchemaVersion
    with Session(bind=connection) as db:
        if not db.get(SchemaVersion, 1):
            bridge_legacy_accounts(db)
            db.add(SchemaVersion(version=1))
            db.flush()
        if connection.dialect.name == "postgresql" and not db.get(SchemaVersion, 2):
            # Existing SQL-created tables need protection too, not just newly created ones.
            quote = connection.dialect.identifier_preparer.quote
            inspector = inspect(connection)
            for table in SQLModel.metadata.sorted_tables:
                name = quote(table.name)
                for column in inspector.get_columns(table.name):
                    if column["type"].__class__.__name__ == "TIMESTAMP" and not column["type"].timezone:
                        col = quote(column["name"])
                        connection.execute(text(f"ALTER TABLE {name} ALTER COLUMN {col} TYPE TIMESTAMPTZ USING {col} AT TIME ZONE 'UTC'"))
                connection.execute(text(f"ALTER TABLE {name} ENABLE ROW LEVEL SECURITY"))
                # A backend-only database: Supabase browser roles must never read hashes or family data.
                for role in ("anon", "authenticated"):
                    if connection.execute(text("SELECT 1 FROM pg_roles WHERE rolname=:role"), {"role": role}).scalar():
                        connection.execute(text(f"REVOKE ALL ON TABLE {name} FROM {quote(role)}"))
            db.add(SchemaVersion(version=2))
        db.commit()
