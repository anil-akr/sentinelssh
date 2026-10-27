"""Tests unitaires de Database (sur une base jetable)."""

import sqlite3
from contextlib import closing

import pytest

from sentinel.models import SuspectIP


def suspect(ip="203.0.113.1", failures=5, severity="elevee", rules=("R2",)):
    """Fabrique une SuspectIP de test."""
    return SuspectIP(ip=ip, failures=failures, severity=severity,
                     rules=list(rules), users=["root", "admin"],
                     first_seen="2000-10-12 14:00:00",
                     last_seen="2000-10-12 14:00:40")


def count_suspect_ips(db):
    """Compte toutes les lignes de la table suspect_ips."""
    with closing(db.connect()) as conn:
        return conn.execute("SELECT COUNT(*) FROM suspect_ips").fetchone()[0]


def test_init_db_creates_three_tables(db):
    with closing(db.connect()) as conn:
        names = {row["name"] for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert {"analyses", "suspect_ips", "users"} <= names


def test_foreign_keys_are_enabled(db):
    with closing(db.connect()) as conn:
        assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1


def test_save_and_get_analysis(db):
    suspects = [suspect("203.0.113.1", 5, "elevee", ["R2"]),
                suspect("203.0.113.2", 6, "critique", ["R2", "R3"])]
    analysis_id = db.save_analysis("demo.log", 37, 2, suspects)

    analysis = db.get_analysis(analysis_id)
    assert analysis["filename"] == "demo.log"
    assert analysis["total_lines"] == 37
    assert analysis["ignored_lines"] == 2
    assert analysis["suspect_count"] == 2
    assert analysis["critical_count"] == 1
    # Les IP reviennent triées (critique d'abord) et en listes.
    first = analysis["suspects"][0]
    assert first["ip"] == "203.0.113.2"
    assert first["rules"] == ["R2", "R3"]
    assert first["users"] == ["root", "admin"]


def test_get_unknown_analysis_returns_none(db):
    assert db.get_analysis(999) is None


def test_list_analyses_most_recent_first(db):
    first_id = db.save_analysis("a.log", 1, 1, [])
    second_id = db.save_analysis("b.log", 1, 1, [])
    ids = [a["id"] for a in db.list_analyses()]
    assert ids == [second_id, first_id]


def test_delete_cascades_to_suspect_ips(db):
    analysis_id = db.save_analysis("demo.log", 10, 0, [suspect()])
    assert count_suspect_ips(db) == 1
    assert db.delete_analysis(analysis_id) is True
    assert db.get_analysis(analysis_id) is None
    assert count_suspect_ips(db) == 0


def test_delete_unknown_analysis_returns_false(db):
    assert db.delete_analysis(999) is False


def test_recidivists(db):
    db.save_analysis("a.log", 10, 0,
                     [suspect("203.0.113.1", 5), suspect("203.0.113.9", 7)])
    db.save_analysis("b.log", 10, 0, [suspect("203.0.113.1", 8)])
    assert db.get_recidivists() == [
        {"ip": "203.0.113.1", "analyses_count": 2, "total_failures": 13}]


def test_delete_older_than(db):
    old_id = db.save_analysis("old.log", 1, 1, [suspect()])
    with closing(db.connect()) as conn:
        conn.execute("UPDATE analyses SET created_at = ? WHERE id = ?",
                     ("2000-01-01T00:00:00", old_id))
        conn.commit()
    recent_id = db.save_analysis("recent.log", 1, 1, [])

    assert db.delete_older_than(30) == 1
    assert db.get_analysis(old_id) is None
    assert db.get_analysis(recent_id) is not None


def test_severity_check_constraint(db):
    with pytest.raises(sqlite3.IntegrityError):
        db.save_analysis("x.log", 1, 0, [suspect(severity="inconnue")])


def test_create_and_get_user(db):
    db.create_user("admin", "hachage")
    assert db.get_user("admin")["password_hash"] == "hachage"
    assert db.get_user("personne") is None


def test_username_is_unique(db):
    db.create_user("admin", "hachage")
    with pytest.raises(sqlite3.IntegrityError):
        db.create_user("admin", "autre")


def test_sql_injection_is_harmless(db):
    db.create_user("admin", "hachage")
    assert db.get_user("' OR '1'='1") is None
