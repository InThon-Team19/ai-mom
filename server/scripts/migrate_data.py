"""Copy existing SQLite data to the configured DB, or import owned JSON profiles.

Run from server: python scripts/migrate_data.py --source sqlite:////absolute/backup.db
Dry-run by default. --apply is explicit and never overwrites existing primary keys.
No credentials or profile contents are printed.
"""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import MetaData, Table, inspect
from sqlmodel import Session, SQLModel, create_engine, select

from app.db import engine, init_db
from app.family import merge_profile
from app.migrations import bridge_legacy_accounts
from app.models import Child, FamilyProfile, SchemaVersion


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", help="Source DB URL. Prefer a SQLite backup file.")
    parser.add_argument("--profiles", type=Path, help="Directory containing children/<child_id>/profile.json")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if not args.source and not args.profiles:
        parser.error("provide --source or --profiles")
    source = create_engine(args.source) if args.source else None
    if source and source.url == engine.url:
        parser.error("source and destination must be different")
    if args.apply:
        init_db()
    counts = {}
    with Session(engine) as target:
        if source:
            tables = set(inspect(source).get_table_names())
            with source.connect() as connection:
                for table in SQLModel.metadata.sorted_tables:
                    if table.name == SchemaVersion.__tablename__ or table.name not in tables:
                        continue
                    old_table = Table(table.name, MetaData(), autoload_with=connection)
                    rows = connection.execute(old_table.select()).mappings().all()
                    counts[table.name] = len(rows)
                    if args.apply:
                        # Any duplicate aborts the entire transaction; never silently overwrite.
                        for row in rows:
                            target.execute(table.insert().values(**{k: v for k, v in row.items() if k in table.c}))
            if args.apply:
                bridge_legacy_accounts(target)
        if args.profiles:
            profile_files = sorted(args.profiles.glob("children/*/profile.json"))
            counts["json_profiles"] = len(profile_files)
            if args.apply:
                for path in profile_files:
                    child = target.get(Child, path.parent.name)
                    if not child:
                        raise ValueError("A JSON profile has no authenticated child owner; assign ownership before import")
                    current = target.get(FamilyProfile, child.id)
                    if current and current.payload:
                        raise ValueError("Destination profile already exists; refusing to overwrite")
                    merge_profile(target, child, json.loads(path.read_text(encoding="utf-8")))
        if args.apply:
            target.commit()
    if source:
        source.dispose()
    print(json.dumps({"applied": args.apply, "counts": counts}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Driver exceptions often embed DB URLs or user data. Keep CLI output private.
        print("Migration failed; target data transaction was rolled back. Verify source schema, ownership and duplicates.", file=sys.stderr)
        raise SystemExit(1)
