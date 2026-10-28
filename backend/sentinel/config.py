"""Configuration de SentinelSSH : seuils des règles, base, envoi, secret."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Dossier backend/ (ce fichier est dans backend/sentinel/).
BACKEND_DIR = Path(__file__).resolve().parent.parent

# Charge backend/.env dans les variables d'environnement. La commande
# « flask » le fait toute seule, mais pas Gunicorn : on le fait donc ici.
load_dotenv(BACKEND_DIR / ".env")

# R1 (attaque persistante) : nombre d'échecs dans le fichier à partir
# duquel une IP est signalée, même si ses essais sont espacés.
PERSISTENT_THRESHOLD = 20

# R2 (force brute rapide) : nombre d'échecs à observer dans la fenêtre
# FAST_WINDOW pour conclure à une attaque automatisée.
FAST_THRESHOLD = 5

# R2 : durée de la fenêtre, en secondes. Un humain ne rate pas 5 mots de
# passe en une minute, un robot si.
FAST_WINDOW = 60

# R3 (compromission possible) : nombre d'échecs de la même IP avant une
# connexion réussie pour signaler un compte peut-être compromis.
COMPROMISE_THRESHOLD = 5

# Fichier SQLite (jamais commité : il contient des IP).
DB_PATH = str(BACKEND_DIR / "sentinel.db")

# Fichier envoyé : 50 Mo maximum (D17), extensions acceptées.
MAX_UPLOAD_MB = 50
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
ALLOWED_EXTENSIONS = {".log", ".txt"}

# Comptes (décision D20). Nom : 3 à 30 caractères parmi lettres sans
# accent, chiffres, point, tiret et tiret bas (rien qui puisse tromper à
# l'affichage). Mot de passe : 12 caractères minimum, pour l'inscription
# comme pour la commande create-admin.
USERNAME_PATTERN = r"[A-Za-z0-9._-]{3,30}"
MIN_PASSWORD_LENGTH = 12

# Au-delà, le mot de passe est refusé avant d'être haché : sinon un envoi
# de plusieurs Mo ferait travailler scrypt longtemps (déni de service).
MAX_PASSWORD_LENGTH = 128

# Limitation des tentatives par IP (comme la règle R2, contre la force
# brute) : 5 échecs de connexion en 15 minutes, 5 inscriptions par heure.
LOGIN_MAX_FAILURES = 5
LOGIN_WINDOW = 15 * 60
REGISTER_MAX_ATTEMPTS = 5
REGISTER_WINDOW = 60 * 60

# RGPD (décision D11) : les analyses de plus de 30 jours sont supprimées
# au démarrage de l'application.
RETENTION_DAYS = 30

# Bases de géolocalisation DB-IP Lite (décision D14), téléchargées par
# scripts/download_geodb.sh. Absentes : l'application marche sans carte.
GEO_CITY_DB = BACKEND_DIR / "data" / "dbip-city-lite.mmdb"
GEO_ASN_DB = BACKEND_DIR / "data" / "dbip-asn-lite.mmdb"

# Clé qui signe le cookie de session. Lue dans .env, jamais dans le code.
SECRET_KEY = os.environ.get("SECRET_KEY")
