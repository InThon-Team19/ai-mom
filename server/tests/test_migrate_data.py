import json
import sys

import pytest
from sqlalchemy import inspect
from sqlmodel import Session, SQLModel, create_engine, select

from app.auth import password_hash
from app.migrations import upgrade
from app.models import FamilyProfile, LoginAccount, Parent
from scripts import migrate_data


def test_copy_dry_run_apply_and_duplicate_rollback(tmp_path, monkeypatch, capsys):
    source_path = tmp_path / "backup.db"
    source = create_engine("sqlite:///" + source_path.as_posix())
    target = create_engine("sqlite:///" + (tmp_path / "target.db").as_posix())
    SQLModel.metadata.create_all(source)
    with Session(source) as db:
        account = LoginAccount(login_id="legacy-parent", child_id="legacy-child",
                               password_hash=password_hash("long-password"), profile={"day": 2})
        db.add(account)
        db.commit()
    def initialize():
        with target.begin() as connection:
            SQLModel.metadata.create_all(connection)
            upgrade(connection)
    monkeypatch.setattr(migrate_data, "engine", target)
    monkeypatch.setattr(migrate_data, "init_db", initialize)
    monkeypatch.setattr(sys, "argv", ["migrate_data.py", "--source", str(source.url)])
    migrate_data.main()
    assert json.loads(capsys.readouterr().out)["applied"] is False
    assert inspect(target).get_table_names() == []
    monkeypatch.setattr(sys, "argv", ["migrate_data.py", "--source", str(source.url), "--apply"])
    migrate_data.main()
    assert json.loads(capsys.readouterr().out)["applied"] is True
    with Session(target) as db:
        assert db.exec(select(Parent)).one().display_name == "legacy-parent"
        assert db.get(FamilyProfile, "legacy-child").payload["day"] == 2
    with pytest.raises(Exception):
        migrate_data.main()
    with Session(target) as db:
        assert len(db.exec(select(LoginAccount)).all()) == 1
    with Session(source) as db:
        assert db.exec(select(LoginAccount)).one().profile == {"day": 2}
    source.dispose()
    target.dispose()
