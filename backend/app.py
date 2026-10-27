"""API REST de SentinelSSH (Flask) : connexion, analyses, récidivistes.

Développement : flask --app app run
Production    : gunicorn -b 127.0.0.1:8000 app:app
"""

import ipaddress
import os
from functools import wraps
from io import BytesIO
from pathlib import Path

import click
from flask import (Flask, Request, abort, jsonify, request,
                   send_from_directory, session)
from werkzeug.security import check_password_hash, generate_password_hash

from sentinel import config
from sentinel.database import Database
from sentinel.detector import Detector
from sentinel.geo import GeoLocator
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


def error(message, status):
    """Réponse d'erreur au format commun {"error": "..."}."""
    return jsonify(error=message), status


def login_required(view):
    """Décorateur : refuse la route (401) si personne n'est connecté."""
    @wraps(view)
    def wrapper(*args, **kwargs):
        if "username" not in session:
            abort(401)
        return view(*args, **kwargs)
    return wrapper


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
    """Vérifie le nom et le mot de passe, puis ouvre la session."""
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")
    if not (isinstance(username, str) and isinstance(password, str)
            and username and password):
        return error("Nom d'utilisateur et mot de passe obligatoires", 400)

    user = get_db().get_user(username)
    # Même message si le nom OU le mot de passe est faux : un attaquant ne
    # peut pas deviner quels comptes existent.
    if user is None or not check_password_hash(user["password_hash"],
                                               password):
        return error("Identifiants incorrects", 401)

    session.clear()
    session["username"] = user["username"]
    return jsonify(username=user["username"])


@app.post("/api/auth/logout")
def logout():
    """Ferme la session."""
    session.clear()
    return "", 204


@app.get("/api/auth/me")
@login_required
def me():
    """Indique qui est connecté ; le front s'en sert pour ses pages."""
    return jsonify(username=session["username"])


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

    analysis_id = get_db().save_analysis(file.filename, total_lines,
                                         ignored_lines, suspects)
    critical_count = sum(1 for s in suspects if s.severity == "critique")
    return jsonify(id=analysis_id, filename=file.filename,
                   suspect_count=len(suspects),
                   critical_count=critical_count), 201


@app.get("/api/analyses")
@login_required
def list_analyses():
    """Historique des analyses, de la plus récente à la plus ancienne."""
    return jsonify(get_db().list_analyses())


@app.get("/api/analyses/<int:analysis_id>")
@login_required
def get_analysis(analysis_id):
    """Une analyse avec ses IP suspectes triées."""
    analysis = get_db().get_analysis(analysis_id)
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


@app.delete("/api/analyses/<int:analysis_id>")
@login_required
def delete_analysis(analysis_id):
    """Supprime une analyse et ses IP (droit à l'effacement)."""
    if not get_db().delete_analysis(analysis_id):
        return error("Analyse introuvable", 404)
    return "", 204


@app.get("/api/recidivists")
@login_required
def list_recidivists():
    """IP présentes dans au moins 2 analyses, avec leur total d'échecs."""
    return jsonify(get_db().get_recidivists())


# --- Erreurs : toujours du JSON ------------------------------------------

@app.errorhandler(400)
def bad_request(_):
    """Requête mal formée."""
    return error("Requête invalide", 400)


@app.errorhandler(401)
def unauthorized(_):
    """Pas de session : il faut se connecter."""
    return error("Connexion requise", 401)


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
    """Crée le compte administrateur (mot de passe de 12 caractères min.)."""
    if len(password) < 12:
        raise click.ClickException(
            "Le mot de passe doit contenir au moins 12 caractères.")
    db = get_db()
    if db.get_user(username) is not None:
        raise click.ClickException("Ce compte existe déjà : " + username)
    db.create_user(username, generate_password_hash(password))
    click.echo("Compte administrateur créé : " + username)
