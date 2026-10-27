"""Tests d'intégration de l'API (client de test Flask, base jetable)."""

import io
from pathlib import Path

import pytest
from werkzeug import formparser

from app import app as flask_app, block_command
from sentinel import config
from tests.conftest import ADMIN_PASSWORD

ROOT = Path(__file__).resolve().parent.parent.parent
DEMO_LOG = (ROOT / "demo" / "demo.log").read_bytes()
SAMPLES = Path(__file__).parent / "samples"

PROTECTED_ROUTES = [
    ("get", "/api/auth/me"),
    ("get", "/api/analyses"),
    ("post", "/api/analyses"),
    ("get", "/api/analyses/1"),
    ("delete", "/api/analyses/1"),
    ("get", "/api/recidivists"),
]


def upload(client, content=DEMO_LOG, filename="demo.log"):
    """Envoie un fichier comme le ferait le formulaire du front."""
    return client.post("/api/analyses",
                       data={"file": (io.BytesIO(content), filename)},
                       content_type="multipart/form-data")


# --- Connexion -------------------------------------------------------------

@pytest.mark.parametrize("method, url", PROTECTED_ROUTES)
def test_protected_routes_without_session_return_401(client, method, url):
    response = getattr(client, method)(url)
    assert response.status_code == 401
    assert response.get_json() == {"error": "Connexion requise"}


def test_login_ok_then_me(client):
    response = client.post("/api/auth/login", json={
        "username": "admin", "password": ADMIN_PASSWORD})
    assert response.status_code == 200
    assert response.get_json() == {"username": "admin"}
    assert "HttpOnly" in response.headers["Set-Cookie"]
    assert "SameSite=Lax" in response.headers["Set-Cookie"]
    assert client.get("/api/auth/me").get_json() == {"username": "admin"}


def test_wrong_password_and_unknown_user_same_message(client):
    wrong_password = client.post("/api/auth/login", json={
        "username": "admin", "password": "mauvais"})
    unknown_user = client.post("/api/auth/login", json={
        "username": "personne", "password": "mauvais"})
    assert wrong_password.status_code == unknown_user.status_code == 401
    assert wrong_password.get_json() == unknown_user.get_json() == {
        "error": "Identifiants incorrects"}


@pytest.mark.parametrize("body", [{}, {"username": "admin"},
                                  {"username": "", "password": "x"},
                                  {"username": 1, "password": 2}])
def test_login_missing_fields_returns_400(client, body):
    assert client.post("/api/auth/login", json=body).status_code == 400


def test_logout_then_401(logged_client):
    assert logged_client.post("/api/auth/logout").status_code == 204
    assert logged_client.get("/api/analyses").status_code == 401


# --- Analyses --------------------------------------------------------------

def test_upload_demo_log(logged_client):
    response = upload(logged_client)
    assert response.status_code == 201
    body = response.get_json()
    assert body["filename"] == "demo.log"
    assert body["suspect_count"] == 3
    assert body["critical_count"] == 1


def test_upload_without_file_returns_400(logged_client):
    response = logged_client.post("/api/analyses", data={},
                                  content_type="multipart/form-data")
    assert response.status_code == 400
    assert response.get_json() == {"error": "Aucun fichier envoyé"}


def test_upload_bad_extension_returns_400(logged_client):
    response = upload(logged_client, b"MZ...", "virus.exe")
    assert response.status_code == 400
    assert response.get_json() == {
        "error": "Extension non autorisée : .log ou .txt uniquement"}


def test_upload_too_large_returns_413(logged_client):
    big = b"x" * (config.MAX_UPLOAD_BYTES + 1)
    response = upload(logged_client, big, "big.log")
    assert response.status_code == 413
    assert response.get_json() == {
        "error": "Fichier trop volumineux (50 Mo maximum)"}


def test_upload_is_never_written_to_disk(logged_client, monkeypatch):
    # Sans réglage, Werkzeug range un fichier de plus de 500 Ko dans un
    # fichier temporaire sur le disque (SpooledTemporaryFile). On remplace
    # cet outil par une fonction qui fait échouer le test si elle est appelée.
    def no_disk(*args, **kwargs):
        raise AssertionError("fichier temporaire créé sur le disque")

    monkeypatch.setattr(formparser, "SpooledTemporaryFile", no_disk)
    big_log = DEMO_LOG * (1024 * 1024 // len(DEMO_LOG) + 1)  # plus de 1 Mo
    response = upload(logged_client, big_log, "gros.log")
    assert response.status_code == 201


def test_upload_empty_file_gives_empty_analysis(logged_client):
    response = upload(logged_client, b"", "vide.log")
    assert response.status_code == 201
    assert response.get_json()["suspect_count"] == 0


def test_upload_invalid_utf8_does_not_crash(logged_client):
    assert upload(logged_client, b"\xff\xfe\x00 bad", "bad.txt"
                  ).status_code == 201


def test_list_analyses(logged_client):
    upload(logged_client)
    analyses = logged_client.get("/api/analyses").get_json()
    assert len(analyses) == 1
    assert analyses[0]["filename"] == "demo.log"
    assert "suspects" not in analyses[0]


def test_get_analysis_detail(logged_client):
    analysis_id = upload(logged_client).get_json()["id"]
    body = logged_client.get(f"/api/analyses/{analysis_id}").get_json()
    assert body["total_lines"] == 37
    assert body["ignored_lines"] == 2
    severities = [s["severity"] for s in body["suspects"]]
    assert severities == ["critique", "elevee", "moyenne"]
    commands = [s["block_command"] for s in body["suspects"]]
    assert commands == ["iptables -A INPUT -s 203.0.113.20 -j DROP",
                        "iptables -A INPUT -s 203.0.113.10 -j DROP",
                        None]
    # Géolocalisation : clé toujours présente (None si la base DB-IP n'est
    # pas installée, comme dans la CI).
    assert all("geo" in s for s in body["suspects"])


def test_get_unknown_analysis_returns_404(logged_client):
    response = logged_client.get("/api/analyses/999")
    assert response.status_code == 404
    assert response.get_json() == {"error": "Analyse introuvable"}


@pytest.mark.parametrize("method", ["get", "delete"])
def test_huge_id_returns_404(logged_client, method):
    # Trop grand pour un entier SQLite (2**63 - 1 au maximum) : sans
    # vérification, SQLite lève OverflowError et l'API répond 500.
    response = getattr(logged_client, method)(
        "/api/analyses/99999999999999999999")
    assert response.status_code == 404
    assert response.get_json() == {"error": "Analyse introuvable"}


def test_delete_then_get_returns_404(logged_client):
    analysis_id = upload(logged_client).get_json()["id"]
    url = f"/api/analyses/{analysis_id}"
    assert logged_client.delete(url).status_code == 204
    assert logged_client.get(url).status_code == 404
    assert logged_client.delete(url).status_code == 404


def test_same_file_twice_gives_recidivists(logged_client):
    upload(logged_client)
    upload(logged_client)
    recidivists = logged_client.get("/api/recidivists").get_json()
    assert {r["ip"] for r in recidivists} == {
        "203.0.113.10", "203.0.113.20", "203.0.113.30"}
    assert all(r["analyses_count"] == 2 for r in recidivists)


def test_ipv6_gets_ip6tables(logged_client):
    content = (SAMPLES / "ipv6.log").read_bytes()
    analysis_id = upload(logged_client, content, "ipv6.log").get_json()["id"]
    suspect = logged_client.get(
        f"/api/analyses/{analysis_id}").get_json()["suspects"][0]
    assert suspect["block_command"] == (
        "ip6tables -A INPUT -s 2001:db8::ab -j DROP")


# --- Divers ----------------------------------------------------------------

def test_block_command_refuses_non_ip():
    assert block_command("1.2.3.4;rm -rf /") is None


def test_unknown_api_route_returns_json_404(client):
    response = client.get("/api/nexiste-pas")
    assert response.status_code == 404
    assert response.get_json() == {"error": "Ressource introuvable"}


def test_wrong_method_returns_json_405(client):
    response = client.put("/api/analyses")
    assert response.status_code == 405
    assert "error" in response.get_json()


def test_create_admin_command(db):
    flask_app.config.update(DB_PATH=db.db_path)
    runner = flask_app.test_cli_runner()
    short = runner.invoke(args=["create-admin", "--username", "chef"],
                          input="court\ncourt\n")
    assert "12 caractères" in short.output
    ok = runner.invoke(args=["create-admin", "--username", "chef"],
                       input="un-long-mot-de-passe\nun-long-mot-de-passe\n")
    assert "Compte administrateur créé" in ok.output
    assert db.get_user("chef") is not None
