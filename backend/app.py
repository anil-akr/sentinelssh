"""API REST de SentinelSSH (Flask) : comptes, analyses, récidivistes.

Développement : flask --app app run
Production    : gunicorn -b 127.0.0.1:8000 app:app
"""

import ipaddress
import os
import re
import sqlite3
from functools import wraps
from io import BytesIO
from pathlib import Path

import click
from flask import (Flask, Request, abort, g, jsonify, request,
                   send_from_directory, session)
from werkzeug.security import check_password_hash, generate_password_hash

from sentinel import config
from sentinel.database import Database
from sentinel.detector import Detector
from sentinel.geo import GeoLocator
from sentinel.limiter import RateLimiter
from sentinel.parser import LogParser

# Front React construit par « npm run build » (servi en production).
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if not config.SECRET_KEY:
    raise RuntimeError("SECRET_KEY manquante : copier .env.example en .env "
                       "puis y mettre une clé (voir le README).")


class MemoryRequest(Request):
    """Requête qui garde les fichiers envoyés en mémoire (RGPD, D17)."""

    def _get_file_stream(self, total_content_length, content_type,
                         filename=None, content_length=None):
        """Renvoie un BytesIO : jamais de fichier temporaire sur le disque.

        Par défaut, Werkzeug range un fichier de plus de 500 Ko dans un
        fichier temporaire. La taille reste bornée par MAX_CONTENT_LENGTH.
        """
        return BytesIO()


# static_folder=None : c'est la route frontend() qui sert le front.
app = Flask(__name__, static_folder=None)
app.request_class = MemoryRequest
app.config.update(
    SECRET_KEY=config.SECRET_KEY,
    # Au-delà de 50 Mo, Flask refuse la requête avec une erreur 413.
    MAX_CONTENT_LENGTH=config.MAX_UPLOAD_BYTES,
    # Cookie de session illisible par JavaScript, et non envoyé par les
    # formulaires d'autres sites (protection CSRF).
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    DB_PATH=config.DB_PATH,
)


def get_db():
    """Renvoie l'objet Database (les tests changent DB_PATH)."""
    return Database(app.config["DB_PATH"])


# Au démarrage : création des tables, puis suppression des analyses de
# plus de 30 jours (durée de conservation, RGPD).
get_db().init_db()
get_db().delete_older_than(config.RETENTION_DAYS)

# Bases de géolocalisation ouvertes une seule fois, au démarrage.
geo = GeoLocator(config.GEO_CITY_DB, config.GEO_ASN_DB)

# Compteurs de tentatives par IP (contre la force brute sur le site).
login_limiter = RateLimiter(config.LOGIN_MAX_FAILURES, config.LOGIN_WINDOW)
register_limiter = RateLimiter(config.REGISTER_MAX_ATTEMPTS,
                               config.REGISTER_WINDOW)

TOO_MANY_ATTEMPTS = "Trop de tentatives : réessayez plus tard"


def error(message, status):
    """Réponse d'erreur au format commun {"error": "..."}."""
    return jsonify(error=message), status


def login_required(view):
    """Décorateur : refuse la route (401) si personne n'est connecté.

    Le compte est relu dans la base à chaque requête et rangé dans g.user :
    un compte supprimé par l'administrateur perd l'accès tout de suite,
    même si son cookie de session est encore valide.
    """
    @wraps(view)
    def wrapper(*args, **kwargs):
        user_id = session.get("user_id")
        user = get_db().get_user_by_id(user_id) if user_id else None
        if user is None:
            session.clear()
            abort(401)
        g.user = user
        return view(*args, **kwargs)
    return wrapper


def admin_required(view):
    """Décorateur : connecté (sinon 401) ET administrateur (sinon 403)."""
    @wraps(view)
    def wrapper(*args, **kwargs):
        if g.user["role"] != "admin":
            abort(403)
        return view(*args, **kwargs)
    # login_required passe d'abord : g.user existe quand wrapper s'exécute.
    return login_required(wrapper)


def read_credentials():
    """Lit {"username", "password"} dans le JSON reçu.

    Renvoie le couple (username, password), ou (None, None) si un champ
    manque, est vide, n'est pas du texte ou si le mot de passe est trop
    long (il n'est alors jamais haché).
    """
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")
    if not (isinstance(username, str) and isinstance(password, str)
            and username and password):
        return None, None
    if len(password) > config.MAX_PASSWORD_LENGTH:
        return None, None
    return username, password


def username_error(username):
    """Message d'erreur si le nom ne suit pas les règles, sinon None."""
    # fullmatch : tout le nom doit suivre le modèle, pas seulement le début.
    if not (isinstance(username, str)
            and re.fullmatch(config.USERNAME_PATTERN, username)):
        return ("Nom d'utilisateur : 3 à 30 caractères (lettres sans "
                "accent, chiffres, point, tiret, tiret bas)")
    return None


def password_error(password):
    """Message d'erreur si le mot de passe est trop court ou trop long."""
    if not (isinstance(password, str)
            and config.MIN_PASSWORD_LENGTH <= len(password)
            <= config.MAX_PASSWORD_LENGTH):
        return ("Le mot de passe doit contenir de "
                + str(config.MIN_PASSWORD_LENGTH) + " à "
                + str(config.MAX_PASSWORD_LENGTH) + " caractères")
    return None


def password_matches(username, password):
    """True si password est le mot de passe actuel du compte."""
    if not (isinstance(password, str)
            and len(password) <= config.MAX_PASSWORD_LENGTH):
        return False
    user = get_db().get_user(username)
    return check_password_hash(user["password_hash"], password)


def update_account(user, data, require_current_password):
    """Change le nom et/ou le mot de passe du compte user.

    data : {"username"?, "password"?, "current_password"?}. Pour son propre
    compte, le mot de passe actuel est exigé avant d'en mettre un nouveau ;
    l'admin qui réinitialise celui d'un user ne le connaît pas.
    Renvoie une réponse d'erreur, ou None si tout s'est bien passé.
    """
    username = data.get("username")
    password = data.get("password")
    if username is None and password is None:
        return error("Rien à modifier : username ou password attendu", 400)
    if username is not None and username_error(username):
        return error(username_error(username), 400)
    if password is not None:
        if password_error(password):
            return error(password_error(password), 400)
        if require_current_password:
            ip = request.remote_addr
            if login_limiter.is_blocked(ip):
                return error(TOO_MANY_ATTEMPTS, 429)
            # Un mauvais mot de passe actuel compte comme un échec de
            # connexion : impossible de le deviner par essais.
            if not password_matches(user["username"],
                                    data.get("current_password")):
                login_limiter.record(ip)
                return error("Mot de passe actuel incorrect", 400)

    db = get_db()
    if username is not None:
        try:
            db.update_username(user["id"], username)
        except sqlite3.IntegrityError:
            return error("Ce nom d'utilisateur est déjà pris", 409)
    if password is not None:
        db.update_password_hash(user["id"], generate_password_hash(password))
    return None


def managed_user(user_id):
    """Le compte « user » que l'admin veut gérer, ou une erreur.

    user_id vient du convertisseur <uuid:...> (objet UUID, mis en texte).
    Renvoie (compte, None) ou (None, réponse d'erreur). Un compte admin,
    y compris le sien, ne se gère jamais par /api/users (403) : l'admin
    modifie son propre compte par /api/auth/me, comme tout le monde.
    """
    user = get_db().get_user_by_id(str(user_id))
    if user is None:
        return None, error("Compte introuvable", 404)
    if user["role"] == "admin":
        return None, error("Un compte administrateur ne peut pas être "
                           "géré ici", 403)
    return user, None


def block_command(ip):
    """Commande de blocage proposée (jamais exécutée), ou None.

    L'IP vient du journal : on vérifie que c'est bien une adresse avant de
    l'écrire dans une commande que l'administrateur va copier.
    """
    try:
        address = ipaddress.ip_address(ip)
    except ValueError:
        return None
    tool = "ip6tables" if address.version == 6 else "iptables"
    return tool + " -A INPUT -s " + str(address) + " -j DROP"


# --- Connexion -----------------------------------------------------------

@app.post("/api/auth/login")
def login():
    """Vérifie le nom et le mot de passe, puis ouvre la session.

    Après 5 échecs en 15 minutes, l'IP est refusée (429) jusqu'à la fin
    de la fenêtre, même avec le bon mot de passe.
    """
    ip = request.remote_addr
    if login_limiter.is_blocked(ip):
        return error(TOO_MANY_ATTEMPTS, 429)
    username, password = read_credentials()
    if username is None:
        return error("Nom d'utilisateur et mot de passe obligatoires", 400)

    user = get_db().get_user(username)
    # Même message si le nom OU le mot de passe est faux : un attaquant ne
    # peut pas deviner quels comptes existent.
    if user is None or not check_password_hash(user["password_hash"],
                                               password):
        login_limiter.record(ip)
        return error("Identifiants incorrects", 401)

    # Connexion réussie : les échecs précédents de cette IP sont oubliés.
    login_limiter.reset(ip)

    # session.clear() d'abord : on repart d'une session neuve.
    session.clear()
    session["user_id"] = user["id"]
    return jsonify(username=user["username"], role=user["role"])


@app.post("/api/auth/register")
def register():
    """Crée un compte « user », puis ouvre sa session (pas d'e-mail, D20).

    5 tentatives par heure et par IP : un robot ne peut ni créer des
    milliers de comptes, ni tester des milliers de noms (réponse 409).
    """
    ip = request.remote_addr
    if register_limiter.is_blocked(ip):
        return error(TOO_MANY_ATTEMPTS, 429)
    register_limiter.record(ip)
    username, password = read_credentials()
    if username is None:
        return error("Nom d'utilisateur et mot de passe obligatoires", 400)
    for message in (username_error(username), password_error(password)):
        if message:
            return error(message, 400)
    try:
        user_id = get_db().create_user(username,
                                       generate_password_hash(password))
    except sqlite3.IntegrityError:
        # Contrainte UNIQUE : la base refuse un 2e compte du même nom (sans
        # risque si 2 inscriptions arrivent en même temps).
        return error("Ce nom d'utilisateur est déjà pris", 409)

    session.clear()
    session["user_id"] = user_id
    return jsonify(username=username, role="user"), 201


@app.post("/api/auth/logout")
def logout():
    """Ferme la session."""
    session.clear()
    return "", 204


@app.get("/api/auth/me")
@login_required
def me():
    """Le compte connecté (id, nom, rôle, date d'inscription) ; le front
    s'en sert pour ses pages."""
    return jsonify(g.user)


@app.patch("/api/auth/me")
@login_required
def update_me():
    """Change son nom et/ou son mot de passe (l'actuel est redemandé)."""
    failure = update_account(g.user, request.get_json(silent=True) or {},
                             require_current_password=True)
    if failure:
        return failure
    return jsonify(get_db().get_user_by_id(g.user["id"]))


@app.delete("/api/auth/me")
@login_required
def delete_my_account():
    """Supprime son propre compte et ses analyses (droit à l'effacement).

    Le mot de passe est redemandé : quelqu'un devant une session restée
    ouverte ne peut pas effacer le compte. Un admin ne peut pas se
    supprimer (il reste toujours quelqu'un pour gérer les comptes).
    """
    if g.user["role"] == "admin":
        return error("Un compte administrateur ne peut pas être supprimé",
                     400)
    ip = request.remote_addr
    if login_limiter.is_blocked(ip):
        return error(TOO_MANY_ATTEMPTS, 429)
    data = request.get_json(silent=True) or {}
    # 400 et pas 401 : 401 voudrait dire « pas connecté » pour le front.
    if not password_matches(g.user["username"], data.get("password")):
        login_limiter.record(ip)
        return error("Mot de passe incorrect", 400)
    get_db().delete_user(g.user["id"])
    session.clear()
    return "", 204


# --- Analyses ------------------------------------------------------------

@app.post("/api/analyses")
@login_required
def create_analysis():
    """Reçoit un fichier, l'analyse en mémoire et enregistre le résultat."""
    file = request.files.get("file")
    if file is None or not file.filename:
        return error("Aucun fichier envoyé", 400)

    extension = os.path.splitext(file.filename)[1].lower()
    if extension not in config.ALLOWED_EXTENSIONS:
        return error("Extension non autorisée : .log ou .txt uniquement", 400)

    # Le fichier est lu en mémoire, jamais écrit sur le disque (RGPD).
    # errors="replace" : un octet illisible ne fait pas planter l'analyse.
    text = file.read().decode("utf-8", errors="replace")
    events, total_lines, ignored_lines = LogParser().parse_text(text)
    suspects = Detector().detect(events)

    analysis_id = get_db().save_analysis(g.user["id"], file.filename,
                                         total_lines, ignored_lines, suspects)
    critical_count = sum(1 for s in suspects if s.severity == "critique")
    return jsonify(id=analysis_id, filename=file.filename,
                   suspect_count=len(suspects),
                   critical_count=critical_count), 201


@app.get("/api/analyses")
@login_required
def list_analyses():
    """Historique des analyses du compte, de la plus récente à la plus
    ancienne."""
    return jsonify(get_db().list_analyses(g.user["id"]))


@app.get("/api/analyses/<uuid:analysis_id>")
@login_required
def get_analysis(analysis_id):
    """Une analyse du compte avec ses IP suspectes triées.

    L'analyse d'un autre compte répond 404, comme un id inconnu : on ne
    révèle même pas qu'elle existe.
    """
    # <uuid:...> donne un objet UUID : str() le remet en texte pour SQLite.
    analysis = get_db().get_analysis(str(analysis_id), g.user["id"])
    if analysis is None:
        return error("Analyse introuvable", 404)
    for suspect in analysis["suspects"]:
        # Commande calculée ici, jamais stockée. Proposée seulement pour
        # les gravités élevée et critique (décision D13).
        if suspect["severity"] in ("elevee", "critique"):
            suspect["block_command"] = block_command(suspect["ip"])
        else:
            suspect["block_command"] = None
        # Position calculée à chaque lecture, jamais stockée (D14).
        suspect["geo"] = geo.locate(suspect["ip"])
    return jsonify(analysis)


@app.delete("/api/analyses/<uuid:analysis_id>")
@login_required
def delete_analysis(analysis_id):
    """Supprime une analyse et ses IP (droit à l'effacement)."""
    if not get_db().delete_analysis(str(analysis_id), g.user["id"]):
        return error("Analyse introuvable", 404)
    return "", 204


@app.get("/api/recidivists")
@login_required
def list_recidivists():
    """IP présentes dans au moins 2 analyses du compte, avec leur total
    d'échecs."""
    return jsonify(get_db().get_recidivists(g.user["id"]))


# --- Gestion des comptes (administrateur) --------------------------------

@app.get("/api/users")
@admin_required
def list_users():
    """Liste des comptes (nom, rôle, date d'inscription), sans leurs
    analyses : l'administrateur gère les comptes, pas les données."""
    return jsonify(get_db().list_users())


@app.get("/api/users/<uuid:user_id>")
@admin_required
def get_user(user_id):
    """Profil d'un compte « user » vu par l'admin (D21).

    Jamais le hachage du mot de passe. Ses analyses : seulement l'id, la
    date et le nom du fichier, de quoi en supprimer une à sa demande sans
    en lire le contenu (RGPD).
    """
    user, failure = managed_user(user_id)
    if failure:
        return failure
    user["analyses"] = [
        {"id": a["id"], "filename": a["filename"],
         "created_at": a["created_at"]}
        for a in get_db().list_analyses(user["id"])]
    return jsonify(user)


@app.patch("/api/users/<uuid:user_id>")
@admin_required
def update_user(user_id):
    """L'admin change le nom et/ou réinitialise le mot de passe d'un user
    (sans connaître l'ancien)."""
    user, failure = managed_user(user_id)
    if failure:
        return failure
    failure = update_account(user, request.get_json(silent=True) or {},
                             require_current_password=False)
    if failure:
        return failure
    return jsonify(get_db().get_user_by_id(user["id"]))


@app.delete("/api/users/<uuid:user_id>")
@admin_required
def delete_user(user_id):
    """Supprime un compte « user » et, par cascade, ses analyses et leurs
    IP. Un compte admin ne se supprime pas par l'API (403) : il reste
    toujours quelqu'un pour gérer les comptes."""
    user, failure = managed_user(user_id)
    if failure:
        return failure
    get_db().delete_user(user["id"])
    return "", 204


@app.delete("/api/users/<uuid:user_id>/analyses/<uuid:analysis_id>")
@admin_required
def delete_user_analysis(user_id, analysis_id):
    """L'admin supprime une analyse d'un user (à sa demande) sans la lire.

    delete_analysis filtre sur user_id : l'analyse doit bien appartenir à
    ce compte, sinon 404.
    """
    user, failure = managed_user(user_id)
    if failure:
        return failure
    if not get_db().delete_analysis(str(analysis_id), user["id"]):
        return error("Analyse introuvable", 404)
    return "", 204


# --- Erreurs : toujours du JSON ------------------------------------------

@app.errorhandler(400)
def bad_request(_):
    """Requête mal formée."""
    return error("Requête invalide", 400)


@app.errorhandler(401)
def unauthorized(_):
    """Pas de session : il faut se connecter."""
    return error("Connexion requise", 401)


@app.errorhandler(403)
def forbidden(_):
    """Connecté, mais sans le droit (route réservée à l'administrateur)."""
    return error("Accès réservé à l'administrateur", 403)


@app.errorhandler(404)
def not_found(_):
    """Adresse inconnue."""
    return error("Ressource introuvable", 404)


@app.errorhandler(405)
def method_not_allowed(_):
    """Méthode HTTP non prévue pour cette adresse."""
    return error("Méthode non autorisée", 405)


@app.errorhandler(413)
def too_large(_):
    """Fichier trop gros (Flask renverrait sinon une page HTML)."""
    return error("Fichier trop volumineux ("
                 + str(config.MAX_UPLOAD_MB) + " Mo maximum)", 413)


@app.errorhandler(500)
def server_error(_):
    """Erreur inattendue : pas de détail interne dans la réponse."""
    return error("Erreur interne du serveur", 500)


# --- Front construit (production) ----------------------------------------

@app.get("/", defaults={"path": ""})
@app.get("/<path:path>")
def frontend(path):
    """Sert frontend/dist ; renvoie index.html pour les routes de React."""
    if path.startswith("api/"):
        abort(404)
    if path and (FRONTEND_DIST / path).is_file():
        return send_from_directory(FRONTEND_DIST, path)
    if (FRONTEND_DIST / "index.html").is_file():
        # /login ou /analyses/3 rechargées : React Router prend le relais.
        return send_from_directory(FRONTEND_DIST, "index.html")
    return error("Front non construit : lancer « npm run build »", 404)


# --- Commande flask --app app create-admin -------------------------------

@app.cli.command("create-admin")
@click.option("--username", prompt="Nom d'utilisateur", default="admin")
@click.password_option(prompt="Mot de passe")
def create_admin(username, password):
    """Crée un compte administrateur (mot de passe de 12 caractères min.).

    C'est le seul moyen de créer un admin : l'inscription du site crée
    toujours un simple « user ».
    """
    if len(password) < config.MIN_PASSWORD_LENGTH:
        raise click.ClickException(
            "Le mot de passe doit contenir au moins "
            + str(config.MIN_PASSWORD_LENGTH) + " caractères.")
    db = get_db()
    if db.get_user(username) is not None:
        raise click.ClickException("Ce compte existe déjà : " + username)
    db.create_user(username, generate_password_hash(password), role="admin")
    click.echo("Compte administrateur créé : " + username)
