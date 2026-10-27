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

# RGPD (décision D11) : les analyses de plus de 30 jours sont supprimées
# au démarrage de l'application.
RETENTION_DAYS = 30

# Bases de géolocalisation DB-IP Lite (décision D14), téléchargées par
# scripts/download_geodb.sh. Absentes : l'application marche sans carte.
GEO_CITY_DB = BACKEND_DIR / "data" / "dbip-city-lite.mmdb"
GEO_ASN_DB = BACKEND_DIR / "data" / "dbip-asn-lite.mmdb"

# Clé qui signe le cookie de session. Lue dans .env, jamais dans le code.
SECRET_KEY = os.environ.get("SECRET_KEY")
