#!/usr/bin/env bash
# Télécharge les bases de géolocalisation DB-IP Lite (gratuites, licence
# CC BY 4.0) dans backend/data/. À lancer une fois, puis chaque mois pour
# avoir une base à jour. Les fichiers ne sont jamais commités (trop gros).
#
# Usage (depuis backend/) : ./scripts/download_geodb.sh

# -e : arrêt à la première erreur ; -u : variable inconnue = erreur ;
# -o pipefail : une erreur au milieu d'un « | » compte aussi.
set -euo pipefail

DATA_DIR="$(dirname "$0")/../data"
MONTH="$(date +%Y-%m)"  # DB-IP publie un fichier par mois, ex. 2026-10
mkdir -p "$DATA_DIR"

# city : pays, ville, coordonnées. asn : opérateur du réseau (AS).
for kind in city asn; do
    url="https://download.db-ip.com/free/dbip-${kind}-lite-${MONTH}.mmdb.gz"
    echo "Téléchargement de $url"
    # Fichier compressé (.gz) : gunzip le décompresse à la volée.
    curl -fSL "$url" | gunzip > "$DATA_DIR/dbip-${kind}-lite.mmdb"
done

echo "Bases installées dans backend/data/."
