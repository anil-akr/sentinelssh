"""Fixtures pytest partagées : base jetable et client de test Flask."""

import os

# app.py refuse de démarrer sans SECRET_KEY : on en donne une de test
# AVANT de l'importer (la CI n'a pas de fichier .env).
os.environ.setdefault("SECRET_KEY", "cle-de-test-uniquement")

import pytest  # noqa: E402
from werkzeug.security import generate_password_hash  # noqa: E402

from app import app as flask_app  # noqa: E402
from sentinel.database import Database  # noqa: E402

ADMIN_PASSWORD = "mot-de-passe-de-test"


@pytest.fixture
def db(tmp_path):
    """Base SQLite vide, dans un dossier temporaire supprimé après le test."""
    database = Database(str(tmp_path / "test.db"))
    database.init_db()
    return database


@pytest.fixture
def client(db):
    """Client de test Flask branché sur la base jetable, avec un admin."""
    flask_app.config.update(TESTING=True, DB_PATH=db.db_path)
    db.create_user("admin", generate_password_hash(ADMIN_PASSWORD))
    return flask_app.test_client()


@pytest.fixture
def logged_client(client):
    """Client de test déjà connecté avec le compte admin."""
    client.post("/api/auth/login",
                json={"username": "admin", "password": ADMIN_PASSWORD})
    return client
