"""Tests d'intégration de l'API (client de test Flask, base jetable)."""

import io
import uuid
from datetime import timedelta
from pathlib import Path

import pytest
from werkzeug import formparser

from app import app as flask_app, block_command, read_db_key
from sentinel import config
from tests.conftest import ADMIN_PASSWORD, USER_PASSWORD

ROOT = Path(__file__).resolve().parent.parent.parent
DEMO_LOG = (ROOT / "demo" / "demo.log").read_bytes()
SAMPLES = Path(__file__).parent / "samples"

# UUID bien formé qui n'existe dans aucune table.
UNKNOWN_ID = "00000000-0000-4000-8000-000000000000"

PROTECTED_ROUTES = [
    ("get", "/api/auth/me"),
    ("get", "/api/analyses"),
    ("post", "/api/analyses"),
    ("get", f"/api/analyses/{UNKNOWN_ID}"),
    ("delete", f"/api/analyses/{UNKNOWN_ID}"),
    ("get", "/api/recidivists"),
    ("get", "/api/users"),
    ("delete", f"/api/users/{UNKNOWN_ID}"),
    ("delete", "/api/auth/me"),
    ("patch", "/api/auth/me"),
]

ADMIN_ROUTES = [
    ("get", "/api/users"),
    ("get", f"/api/users/{UNKNOWN_ID}"),
    ("patch", f"/api/users/{UNKNOWN_ID}"),
    ("delete", f"/api/users/{UNKNOWN_ID}"),
    ("delete", f"/api/users/{UNKNOWN_ID}/analyses/{UNKNOWN_ID}"),
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
    assert response.get_json() == {"username": "admin", "role": "admin"}
    assert "HttpOnly" in response.headers["Set-Cookie"]
    assert "SameSite=Lax" in response.headers["Set-Cookie"]
    body = client.get("/api/auth/me").get_json()
    assert (body["username"], body["role"]) == ("admin", "admin")
    assert set(body) == {"id", "username", "role", "created_at",
                         "updated_at"}  # jamais le hachage


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


def test_login_blocked_after_5_failures(client):
    for _ in range(5):
        client.post("/api/auth/login", json={
            "username": "admin", "password": "mauvais"})
    # 6e essai, même avec le bon mot de passe : refusé.
    response = client.post("/api/auth/login", json={
        "username": "admin", "password": ADMIN_PASSWORD})
    assert response.status_code == 429
    assert response.get_json() == {
        "error": "Trop de tentatives : réessayez plus tard"}


def test_successful_login_resets_failures(client):
    for _ in range(4):
        client.post("/api/auth/login", json={
            "username": "admin", "password": "mauvais"})
    client.post("/api/auth/login", json={
        "username": "admin", "password": ADMIN_PASSWORD})
    # Compteur remis à zéro : 4 nouveaux échecs ne bloquent pas.
    for _ in range(4):
        client.post("/api/auth/login", json={
            "username": "admin", "password": "mauvais"})
    assert client.post("/api/auth/login", json={
        "username": "admin", "password": ADMIN_PASSWORD}).status_code == 200


# --- Inscription -----------------------------------------------------------

def test_register_opens_session_as_user(client):
    response = client.post("/api/auth/register", json={
        "username": "bob", "password": "un-long-mot-de-passe"})
    assert response.status_code == 201
    assert response.get_json() == {"username": "bob", "role": "user"}
    body = client.get("/api/auth/me").get_json()
    assert (body["username"], body["role"]) == ("bob", "user")
    # Le nouveau compte part d'un historique vide.
    assert client.get("/api/analyses").get_json() == []


def test_register_then_login(client):
    client.post("/api/auth/register", json={
        "username": "bob", "password": "un-long-mot-de-passe"})
    client.post("/api/auth/logout")
    response = client.post("/api/auth/login", json={
        "username": "bob", "password": "un-long-mot-de-passe"})
    assert response.status_code == 200


def test_register_taken_username_returns_409(client):
    response = client.post("/api/auth/register", json={
        "username": "alice", "password": "un-long-mot-de-passe"})
    assert response.status_code == 409
    assert response.get_json() == {
        "error": "Ce nom d'utilisateur est déjà pris"}


def test_register_short_password_returns_400(client):
    response = client.post("/api/auth/register", json={
        "username": "bob", "password": "court"})
    assert response.status_code == 400
    assert "de 12 à 128 caractères" in response.get_json()["error"]


@pytest.mark.parametrize("username", ["ab", "a" * 31, "bob dupont",
                                      "<script>", "élodie"])
def test_register_bad_username_returns_400(client, username):
    response = client.post("/api/auth/register", json={
        "username": username, "password": "un-long-mot-de-passe"})
    assert response.status_code == 400


@pytest.mark.parametrize("body", [{}, {"username": "bob"},
                                  {"username": 1, "password": 2}])
def test_register_missing_fields_returns_400(client, body):
    assert client.post("/api/auth/register", json=body).status_code == 400


def test_register_same_name_other_case_returns_409(client):
    # « Alice » imiterait « alice » : refusé comme un nom déjà pris.
    response = client.post("/api/auth/register", json={
        "username": "Alice", "password": "un-long-mot-de-passe"})
    assert response.status_code == 409


@pytest.mark.parametrize("url", ["/api/auth/register", "/api/auth/login"])
def test_too_long_password_returns_400(client, url, monkeypatch):
    # Le mot de passe n'est même pas haché : on le vérifie en remplaçant
    # les fonctions de hachage par une fonction qui fait échouer le test.
    def no_hash(*args, **kwargs):
        raise AssertionError("mot de passe trop long haché")

    monkeypatch.setattr("app.generate_password_hash", no_hash)
    monkeypatch.setattr("app.check_password_hash", no_hash)
    response = client.post(url, json={"username": "alice",
                                      "password": "a" * 129})
    assert response.status_code == 400


def test_register_blocked_after_5_attempts(client):
    for i in range(5):
        client.post("/api/auth/register", json={
            "username": f"robot{i}", "password": "un-long-mot-de-passe"})
    response = client.post("/api/auth/register", json={
        "username": "robot5", "password": "un-long-mot-de-passe"})
    assert response.status_code == 429


def test_register_cannot_create_admin(client):
    # Un champ « role » envoyé par le visiteur est ignoré.
    response = client.post("/api/auth/register", json={
        "username": "pirate", "password": "un-long-mot-de-passe",
        "role": "admin"})
    assert response.get_json()["role"] == "user"
    assert client.get("/api/users").status_code == 403


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
    response = logged_client.get(f"/api/analyses/{UNKNOWN_ID}")
    assert response.status_code == 404
    assert response.get_json() == {"error": "Analyse introuvable"}


@pytest.mark.parametrize("bad_id", ["1", "99999999999999999999", "abc"])
def test_non_uuid_id_is_refused(logged_client, bad_id):
    # <uuid:...> : Flask refuse l'adresse avant d'appeler la fonction.
    url = f"/api/analyses/{bad_id}"
    response = logged_client.get(url)
    assert response.status_code == 404
    assert response.get_json() == {"error": "Ressource introuvable"}
    # DELETE : seule la route du front (GET) reconnaît cette adresse, d'où
    # 405 ; toujours en JSON, et rien n'est supprimé.
    response = logged_client.delete(url)
    assert response.status_code == 405
    assert "error" in response.get_json()


def test_upload_returns_uuid(logged_client):
    analysis_id = upload(logged_client).get_json()["id"]
    assert uuid.UUID(analysis_id).version == 4


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


# --- Chaque compte ne voit que ses analyses --------------------------------

def test_other_user_gets_404_on_my_analysis(logged_client, alice_client):
    analysis_id = upload(logged_client).get_json()["id"]
    url = f"/api/analyses/{analysis_id}"
    # 404 et pas 403 : alice n'apprend même pas que l'analyse existe.
    assert alice_client.get(url).status_code == 404
    assert alice_client.delete(url).status_code == 404
    assert alice_client.get("/api/analyses").get_json() == []
    # L'analyse est toujours là pour son propriétaire.
    assert logged_client.get(url).status_code == 200


def test_recidivists_are_per_user(logged_client, alice_client):
    upload(logged_client)
    upload(alice_client)
    assert logged_client.get("/api/recidivists").get_json() == []
    assert alice_client.get("/api/recidivists").get_json() == []


# --- Suppression de son propre compte --------------------------------------

def test_user_deletes_own_account(alice_client, db):
    upload(alice_client)
    response = alice_client.delete("/api/auth/me",
                                   json={"password": USER_PASSWORD})
    assert response.status_code == 204
    assert db.get_user("alice") is None
    # Session fermée, analyses parties avec le compte (cascade).
    assert alice_client.get("/api/analyses").status_code == 401


@pytest.mark.parametrize("body", [{}, {"password": "mauvais"},
                                  {"password": 12}])
def test_delete_own_account_needs_password(alice_client, db, body):
    response = alice_client.delete("/api/auth/me", json=body)
    assert response.status_code == 400
    assert response.get_json() == {"error": "Mot de passe incorrect"}
    assert db.get_user("alice") is not None


def test_admin_cannot_delete_own_account(logged_client):
    response = logged_client.delete("/api/auth/me",
                                    json={"password": ADMIN_PASSWORD})
    assert response.status_code == 400


# --- Gestion des comptes (administrateur) ----------------------------------

@pytest.mark.parametrize("method, url", ADMIN_ROUTES)
def test_admin_routes_refuse_simple_user(alice_client, method, url):
    response = getattr(alice_client, method)(url)
    assert response.status_code == 403
    assert response.get_json() == {"error": "Accès réservé à l'administrateur"}


def test_admin_lists_users(logged_client):
    users = logged_client.get("/api/users").get_json()
    assert [(u["username"], u["role"]) for u in users] == [
        ("admin", "admin"), ("alice", "user")]
    assert all("password_hash" not in u for u in users)


def test_admin_deletes_user_and_session_stops(logged_client, alice_client):
    upload(alice_client)
    alice = logged_client.get("/api/users").get_json()[1]
    assert logged_client.delete(f"/api/users/{alice['id']}"
                                ).status_code == 204
    # Le cookie d'alice est encore là, mais son compte n'existe plus.
    assert alice_client.get("/api/analyses").status_code == 401
    assert alice_client.post("/api/auth/login", json={
        "username": "alice", "password": USER_PASSWORD}).status_code == 401


@pytest.mark.parametrize("method", ["get", "patch", "delete"])
def test_admin_cannot_manage_an_admin(logged_client, db, method):
    other_admin_id = db.create_user("chef2", "hachage", role="admin")
    me_id = logged_client.get("/api/auth/me").get_json()["id"]
    # Ni un autre admin, ni lui-même (son compte passe par /api/auth/me).
    for user_id in (other_admin_id, me_id):
        response = getattr(logged_client, method)(
            f"/api/users/{user_id}", json={"username": "pirate"})
        assert response.status_code == 403
        assert response.get_json() == {
            "error": "Un compte administrateur ne peut pas être géré ici"}
    assert db.get_user_by_id(other_admin_id)["username"] == "chef2"


@pytest.mark.parametrize("method", ["get", "patch", "delete"])
def test_unknown_user_returns_404(logged_client, method):
    response = getattr(logged_client, method)(
        f"/api/users/{UNKNOWN_ID}", json={"username": "bob"})
    assert response.status_code == 404
    assert response.get_json() == {"error": "Compte introuvable"}


def alice_id(admin_client):
    """Id du compte alice, lu dans la liste des comptes (admin)."""
    users = admin_client.get("/api/users").get_json()
    return next(u["id"] for u in users if u["username"] == "alice")


def test_admin_reads_user_profile_without_secrets(logged_client,
                                                  alice_client):
    upload(alice_client)
    body = logged_client.get(f"/api/users/{alice_id(logged_client)}"
                             ).get_json()
    assert body["username"] == "alice"
    assert "password_hash" not in body
    # Analyses : de quoi en supprimer une, rien sur leur contenu (RGPD).
    assert len(body["analyses"]) == 1
    assert set(body["analyses"][0]) == {"id", "filename", "created_at"}


def test_admin_cannot_read_user_analysis(logged_client, alice_client):
    analysis_id = upload(alice_client).get_json()["id"]
    assert logged_client.get(f"/api/analyses/{analysis_id}"
                             ).status_code == 404


def test_admin_renames_user_and_resets_password(logged_client,
                                                alice_client, client):
    response = logged_client.patch(
        f"/api/users/{alice_id(logged_client)}",
        json={"username": "alice2", "password": "nouveau-mot-de-passe"})
    assert response.status_code == 200
    assert response.get_json()["username"] == "alice2"
    other = flask_app.test_client()
    assert other.post("/api/auth/login", json={
        "username": "alice2", "password": "nouveau-mot-de-passe"}
    ).status_code == 200


def test_admin_deletes_user_analysis_without_reading(logged_client,
                                                     alice_client):
    analysis_id = upload(alice_client).get_json()["id"]
    url = f"/api/users/{alice_id(logged_client)}/analyses/{analysis_id}"
    assert logged_client.delete(url).status_code == 204
    assert alice_client.get("/api/analyses").get_json() == []
    assert logged_client.delete(url).status_code == 404


def test_admin_cannot_delete_analysis_of_other_user(logged_client,
                                                    alice_client, db):
    analysis_id = upload(alice_client).get_json()["id"]
    bob_id = db.create_user("bob", "hachage")
    response = logged_client.delete(
        f"/api/users/{bob_id}/analyses/{analysis_id}")
    assert response.status_code == 404
    assert len(alice_client.get("/api/analyses").get_json()) == 1


# --- Modifier son propre compte --------------------------------------------

def test_rename_own_account(alice_client):
    response = alice_client.patch("/api/auth/me",
                                  json={"username": "alice2"})
    assert response.status_code == 200
    body = response.get_json()
    assert body["username"] == "alice2"
    assert body["updated_at"] >= body["created_at"]
    assert alice_client.get("/api/auth/me").get_json()["username"] == "alice2"


@pytest.mark.parametrize("body, status", [
    ({}, 400),
    ({"username": "a b"}, 400),
    ({"username": "ADMIN"}, 409),
    ({"password": "court", "current_password": USER_PASSWORD}, 400),
])
def test_update_own_account_errors(alice_client, body, status):
    assert alice_client.patch("/api/auth/me", json=body
                              ).status_code == status


def test_change_own_password_needs_current_one(alice_client):
    for body in ({"password": "nouveau-mot-de-passe"},
                 {"password": "nouveau-mot-de-passe",
                  "current_password": "mauvais"}):
        response = alice_client.patch("/api/auth/me", json=body)
        assert response.status_code == 400
        assert response.get_json() == {
            "error": "Mot de passe actuel incorrect"}


def test_change_own_password(alice_client):
    assert alice_client.patch("/api/auth/me", json={
        "password": "nouveau-mot-de-passe",
        "current_password": USER_PASSWORD}).status_code == 200
    other = flask_app.test_client()
    assert other.post("/api/auth/login", json={
        "username": "alice", "password": USER_PASSWORD}).status_code == 401
    assert other.post("/api/auth/login", json={
        "username": "alice", "password": "nouveau-mot-de-passe"}
    ).status_code == 200


def test_guessing_current_password_is_limited(alice_client):
    for _ in range(5):
        alice_client.patch("/api/auth/me", json={
            "password": "nouveau-mot-de-passe",
            "current_password": "mauvais"})
    response = alice_client.patch("/api/auth/me", json={
        "password": "nouveau-mot-de-passe",
        "current_password": USER_PASSWORD})
    assert response.status_code == 429


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
    assert db.get_user("chef")["role"] == "admin"


# --- Session, CORS et clé de la base (D22) -------------------------------

def test_session_cookie_expires(client):
    response = client.post("/api/auth/login", json={
        "username": "alice", "password": USER_PASSWORD})
    cookie = response.headers["Set-Cookie"]
    assert "Expires=" in cookie and "HttpOnly" in cookie
    assert "SameSite=Lax" in cookie


def test_expired_session_returns_401(logged_client, monkeypatch):
    # Durée de vie négative : le cookie est déjà trop vieux pour Flask.
    monkeypatch.setitem(flask_app.config, "PERMANENT_SESSION_LIFETIME",
                        timedelta(seconds=-1))
    assert logged_client.get("/api/auth/me").status_code == 401


def test_admin_password_reset_closes_user_session(logged_client,
                                                  alice_client):
    assert alice_client.get("/api/auth/me").status_code == 200
    logged_client.patch(f"/api/users/{alice_id(logged_client)}",
                        json={"password": "nouveau-mot-de-passe"})
    assert alice_client.get("/api/auth/me").status_code == 401


def test_own_password_change_keeps_session(alice_client):
    response = alice_client.patch("/api/auth/me", json={
        "password": "nouveau-mot-de-passe",
        "current_password": USER_PASSWORD})
    assert response.status_code == 200
    assert alice_client.get("/api/auth/me").status_code == 200


def test_cors_allows_listed_origin_with_cookie(client):
    response = client.get("/api/auth/me",
                          headers={"Origin": "http://localhost:5173"})
    headers = response.headers
    assert headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert headers["Access-Control-Allow-Credentials"] == "true"


def test_cors_ignores_other_origin(client):
    response = client.get("/api/auth/me",
                          headers={"Origin": "https://pirate.example"})
    assert "Access-Control-Allow-Origin" not in response.headers


@pytest.mark.parametrize("key_file", [None, "/chemin/qui/n/existe/pas"])
def test_missing_db_key_stops_the_app(monkeypatch, key_file):
    monkeypatch.setattr(config, "DB_KEY_FILE", key_file)
    with pytest.raises(RuntimeError):
        read_db_key()
