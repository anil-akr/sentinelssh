#!/usr/bin/env bash
# Crée des fichiers de démonstration de plusieurs tailles dans demo/tailles/,
# découpés dans un vrai journal SSH public : le jeu de données OpenSSH de
# Loghub (655 147 lignes, serveur attaqué en décembre 2017).
# Source : https://github.com/logpai/loghub (usage recherche et enseignement).
#
# Les fichiers ne sont jamais commités (dossier ignoré par Git) : trop gros,
# et ce sont les données d'un tiers. On les recrée avec ce script.
#
# Usage (depuis la racine du projet) : ./demo/make_demo_files.sh

# -e : arrêt à la première erreur ; -u : variable inconnue = erreur ;
# -o pipefail : une erreur au milieu d'un « | » compte aussi.
set -euo pipefail

DIR="$(dirname "$0")/tailles"
ARCHIVE="$DIR/SSH.tar.gz"
URL="https://zenodo.org/records/8196385/files/SSH.tar.gz?download=1"
mkdir -p "$DIR"

# 1. Téléchargement (4,6 Mo compressés), une seule fois. Fichier .tmp
#    renommé seulement si tout a réussi : jamais d'archive à moitié écrite.
if [ ! -f "$ARCHIVE" ]; then
    echo "Téléchargement du journal Loghub..."
    curl -fSL "$URL" -o "$ARCHIVE.tmp"
    mv "$ARCHIVE.tmp" "$ARCHIVE"
fi

# 2. Décompression du journal complet (73 Mo) : tar -O écrit sur la sortie.
tar -xzOf "$ARCHIVE" SSH.log > "$DIR/complet.tmp"

# 3. Découpage par nombre de lignes (head -n) : aucune ligne coupée en deux.
#    Une ligne de ce journal fait environ 110 octets.
head -n 2000   "$DIR/complet.tmp" > "$DIR/1-petit.log"       # ~0,2 Mo
head -n 10000  "$DIR/complet.tmp" > "$DIR/2-moyen.log"       # ~1 Mo
head -n 100000 "$DIR/complet.tmp" > "$DIR/3-gros.log"        # ~11 Mo
head -n 420000 "$DIR/complet.tmp" > "$DIR/4-tres-gros.log"   # ~47 Mo, sous la limite de 50 Mo
mv "$DIR/complet.tmp" "$DIR/5-trop-gros.log"                 # ~73 Mo : refusé (413)

echo "Fichiers créés dans demo/tailles/ :"
ls -lh "$DIR"/*.log
