"""Tests unitaires de Database (sur une base jetable)."""

import uuid
from contextlib import closing

import pytest
import sqlcipher3

from sentinel.database import Database
from sentinel.models import SuspectIP
from tests.conftest import TEST_DB_KEY

# UUID bien formé qui n'existe dans aucune table.
UNKNOWN_ID = "00000000-0000-4000-8000-000000000000"


def suspect(ip="203.0.113.1", failures=5, severity="elevee", rules=("R2",)):
    """Fabrique une SuspectIP de test."""
    return SuspectIP(ip=ip, failures=failures, severity=severity,
                     rules=list(rules), users=["root", "admin"],
                     first_seen="2000-10-12 14:00:00",
                     last_seen="2000-10-12 14:00:40")


@pytest.fixture
def user_id(db):
    """Un compte « alice » : chaque analyse appartient à un compte."""
    return db.create_user("alice", "hachage")


def count_suspect_ips(db):
    """Compte toutes les lignes de la table suspect_ips."""
    with closing(db.connect()) as conn:
        return conn.execute("SELECT COUNT(*) FROM suspect_ips").fetchone()[0]


def test_init_db_creates_four_tables(db):
    with closing(db.connect()) as conn:
        names = {row["name"] for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert {"roles", "users", "analyses", "suspect_ips"} <= names


def test_init_db_twice_keeps_two_roles(db):
    db.init_db()  # 2e démarrage : INSERT OR IGNORE ne double rien
    with closing(db.connect()) as conn:
        names = [row["name"] for row in conn.execute(
            "SELECT name FROM roles ORDER BY name")]
    assert names == ["admin", "user"]


def test_foreign_keys_are_enabled(db):
    with closing(db.connect()) as conn:
        assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1


def test_save_and_get_analysis(db, user_id):
    suspects = [suspect("203.0.113.1", 5, "elevee", ["R2"]),
                suspect("203.0.113.2", 6, "critique", ["R2", "R3"])]
    analysis_id = db.save_analysis(user_id, "demo.log", 37, 2, suspects)

    analysis = db.get_analysis(analysis_id, user_id)
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


def test_get_unknown_analysis_returns_none(db, user_id):
    assert db.get_analysis(UNKNOWN_ID, user_id) is None


def test_list_analyses_most_recent_first(db, user_id):
    first_id = db.save_analysis(user_id, "a.log", 1, 1, [])
    second_id = db.save_analysis(user_id, "b.log", 1, 1, [])
    ids = [a["id"] for a in db.list_analyses(user_id)]
    assert ids == [second_id, first_id]


def test_delete_cascades_to_suspect_ips(db, user_id):
    analysis_id = db.save_analysis(user_id, "demo.log", 10, 0, [suspect()])
    assert count_suspect_ips(db) == 1
    assert db.delete_analysis(analysis_id, user_id) is True
    assert db.get_analysis(analysis_id, user_id) is None
    assert count_suspect_ips(db) == 0


def test_delete_unknown_analysis_returns_false(db, user_id):
    assert db.delete_analysis(UNKNOWN_ID, user_id) is False


def test_recidivists(db, user_id):
    db.save_analysis(user_id, "a.log", 10, 0,
                     [suspect("203.0.113.1", 5), suspect("203.0.113.9", 7)])
    db.save_analysis(user_id, "b.log", 10, 0, [suspect("203.0.113.1", 8)])
    assert db.get_recidivists(user_id) == [
        {"ip": "203.0.113.1", "analyses_count": 2, "total_failures": 13}]


def test_delete_older_than(db, user_id):
    old_id = db.save_analysis(user_id, "old.log", 1, 1, [suspect()])
    with closing(db.connect()) as conn:
        conn.execute("UPDATE analyses SET created_at = ? WHERE id = ?",
                     ("2000-01-01T00:00:00", old_id))
        conn.commit()
    recent_id = db.save_analysis(user_id, "recent.log", 1, 1, [])

    assert db.delete_older_than(30) == 1
    assert db.get_analysis(old_id, user_id) is None
    assert db.get_analysis(recent_id, user_id) is not None


def test_severity_check_constraint(db, user_id):
    with pytest.raises(sqlcipher3.IntegrityError):
        db.save_analysis(user_id, "x.log", 1, 0,
                         [suspect(severity="inconnue")])


def test_create_and_get_user(db):
    user_id = db.create_user("bob", "hachage")
    assert db.get_user("bob") == {"id": user_id, "username": "bob",
                                  "password_hash": "hachage", "role": "user"}
    assert db.get_user("personne") is None


def test_create_admin_role(db):
    user_id = db.create_user("chef", "hachage", role="admin")
    user = db.get_user_by_id(user_id)
    assert (user["username"], user["role"]) == ("chef", "admin")
    # À la création, updated_at = created_at ; jamais de hachage ici.
    assert user["updated_at"] == user["created_at"]
    assert "password_hash" not in user


def test_ids_are_uuids(db, user_id):
    analysis_id = db.save_analysis(user_id, "a.log", 1, 0, [])
    # uuid.UUID lève ValueError si le texte n'est pas un UUID.
    assert uuid.UUID(user_id).version == 4
    assert uuid.UUID(analysis_id).version == 4


def test_update_username_and_password(db, user_id):
    with closing(db.connect()) as conn:
        conn.execute("UPDATE users SET updated_at = ? WHERE id = ?",
                     ("2000-01-01T00:00:00", user_id))
        conn.commit()
    db.update_username(user_id, "alice2")
    db.update_password_hash(user_id, "nouveau-hachage")
    assert db.get_user("alice2")["password_hash"] == "nouveau-hachage"
    assert db.get_user("alice") is None
    # updated_at a avancé.
    assert db.get_user_by_id(user_id)["updated_at"] > "2000-01-01T00:00:00"


def test_update_username_already_taken(db, user_id):
    db.create_user("bob", "hachage")
    with pytest.raises(sqlcipher3.IntegrityError):
        db.update_username(user_id, "BOB")


def test_unknown_role_is_refused(db):
    # La sous-requête ne trouve pas le rôle : role_id NULL, refusé.
    with pytest.raises(sqlcipher3.IntegrityError):
        db.create_user("bob", "hachage", role="superadmin")


def test_username_is_unique(db):
    db.create_user("bob", "hachage")
    with pytest.raises(sqlcipher3.IntegrityError):
        db.create_user("bob", "autre")


def test_username_is_unique_whatever_the_case(db):
    db.create_user("bob", "hachage")
    with pytest.raises(sqlcipher3.IntegrityError):
        db.create_user("BOB", "autre")


def test_sql_injection_is_harmless(db):
    db.create_user("bob", "hachage")
    assert db.get_user("' OR '1'='1") is None


def test_list_users_without_password_hash(db):
    db.create_user("chef", "hachage", role="admin")
    db.create_user("bob", "hachage")
    users = db.list_users()
    assert [(u["username"], u["role"]) for u in users] == [
        ("chef", "admin"), ("bob", "user")]
    assert all("password_hash" not in u for u in users)


# --- Chaque compte ne voit que ses analyses --------------------------------

def test_other_user_cannot_read_or_delete(db, user_id):
    other_id = db.create_user("bob", "hachage")
    analysis_id = db.save_analysis(user_id, "a.log", 1, 0, [suspect()])
    assert db.get_analysis(analysis_id, other_id) is None
    assert db.delete_analysis(analysis_id, other_id) is False
    assert db.list_analyses(other_id) == []
    # L'analyse est toujours là pour son propriétaire.
    assert db.get_analysis(analysis_id, user_id) is not None


def test_recidivists_are_per_user(db, user_id):
    other_id = db.create_user("bob", "hachage")
    db.save_analysis(user_id, "a.log", 10, 0, [suspect("203.0.113.1")])
    db.save_analysis(other_id, "b.log", 10, 0, [suspect("203.0.113.1")])
    # Même IP, mais dans 2 comptes différents : récidiviste pour personne.
    assert db.get_recidivists(user_id) == []
    assert db.get_recidivists(other_id) == []


def test_delete_user_cascades_to_analyses_and_ips(db, user_id):
    analysis_id = db.save_analysis(user_id, "a.log", 10, 0, [suspect()])
    assert db.delete_user(user_id) is True
    assert db.get_user_by_id(user_id) is None
    assert db.get_analysis(analysis_id, user_id) is None
    assert count_suspect_ips(db) == 0


def test_delete_unknown_user_returns_false(db):
    assert db.delete_user(UNKNOWN_ID) is False


# --- Chiffrement (D22) ---------------------------------------------------

def test_file_is_encrypted(db):
    db.create_user("nom-tres-secret", "hachage")
    content = open(db.db_path, "rb").read()
    # Ni l'en-tête de SQLite, ni le nom du compte en clair.
    assert not content.startswith(b"SQLite format 3")
    assert b"nom-tres-secret" not in content


def test_wrong_key_cannot_read(db):
    other_key = "f" * 64
    assert other_key != TEST_DB_KEY
    with pytest.raises(sqlcipher3.DatabaseError):
        Database(db.db_path, other_key).get_user("alice")


@pytest.mark.parametrize("key", ["", "abc", "0" * 63, "G" * 64,
                                 "0" * 60 + "'; --"])
def test_badly_formed_key_is_refused(tmp_path, key):
    # Seuls 64 caractères 0-9a-f passent : rien d'autre ne peut finir
    # dans la commande PRAGMA key.
    with pytest.raises(ValueError):
        Database(str(tmp_path / "x.db"), key)
