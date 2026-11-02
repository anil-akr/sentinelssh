"""Fixtures pytest partagées : base jetable et client de test Flask."""

import os
import tempfile
from pathlib import Path

# app.py refuse de démarrer sans SECRET_KEY ni clé de base : on donne des
# valeurs de test AVANT de l'importer (la CI n'a pas de fichier .env).
# Affectation directe : le .env et la vraie base du poste ne servent
# jamais aux tests (load_dotenv n'écrase pas une variable déjà posée).
TEST_DB_KEY = "0123456789abcdef" * 4
TEST_DIR = Path(tempfile.mkdtemp())
(TEST_DIR / "db.key").write_text(TEST_DB_KEY, encoding="utf-8")
os.environ["SECRET_KEY"] = "cle-de-test-uniquement"
os.environ["DB_KEY_FILE"] = str(TEST_DIR / "db.key")
os.environ["DB_PATH"] = str(TEST_DIR / "demarrage.db")
os.environ["CORS_ORIGINS"] = "http://localhost:5173"
os.environ["SESSION_LIFETIME_MINUTES"] = "60"

import pytest  # noqa: E402
from werkzeug.security import generate_password_hash  # noqa: E402

from app import app as flask_app  # noqa: E402
from app import login_limiter, register_limiter  # noqa: E402
from sentinel.database import Database  # noqa: E402

ADMIN_PASSWORD = "mot-de-passe-de-test"
USER_PASSWORD = "mot-de-passe-d-alice"


@pytest.fixture
def db(tmp_path):
    """Base chiffrée vide, dans un dossier temporaire supprimé après le
    test."""
    database = Database(str(tmp_path / "test.db"), TEST_DB_KEY)
    database.init_db()
    return database


@pytest.fixture
def client(db):
    """Client de test Flask branché sur la base jetable, avec 2 comptes :
    « admin » (rôle admin) et « alice » (rôle user)."""
    flask_app.config.update(TESTING=True, DB_PATH=db.db_path)
    # Compteurs de tentatives remis à zéro : chaque test part de rien.
    login_limiter.attempts.clear()
    register_limiter.attempts.clear()
    db.create_user("admin", generate_password_hash(ADMIN_PASSWORD),
                   role="admin")
    db.create_user("alice", generate_password_hash(USER_PASSWORD))
    return flask_app.test_client()


@pytest.fixture
def logged_client(client):
    """Client de test déjà connecté avec le compte admin."""
    client.post("/api/auth/login",
                json={"username": "admin", "password": ADMIN_PASSWORD})
    return client


@pytest.fixture
def alice_client(client):
    """2e client (son propre cookie), connecté avec le compte « alice »."""
    other = flask_app.test_client()
    other.post("/api/auth/login",
               json={"username": "alice", "password": USER_PASSWORD})
    return other
