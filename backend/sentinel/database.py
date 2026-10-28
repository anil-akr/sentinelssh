"""Accès à la base SQLite : rôles, comptes, analyses et IP suspectes.

Toutes les requêtes sont paramétrées (« ? ») : une valeur venue de
l'extérieur n'est jamais collée dans le texte SQL (injection SQL).

Le fichier est chiffré par SQLCipher (D22) : sans la clé, il est
illisible, même copié sur une autre machine.

Chaque méthode qui touche une analyse reçoit le user_id du compte
connecté et filtre dessus : un compte ne voit jamais les analyses d'un
autre, même en devinant leur id.
"""

import re
import uuid
from contextlib import closing
from datetime import datetime, timedelta
from pathlib import Path

import sqlcipher3

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "schema.sql"

# Clé de la base : 32 octets aléatoires écrits en hexadécimal.
KEY_PATTERN = r"[0-9a-f]{64}"


def now():
    """Date et heure actuelles, au format ISO 8601, à la milliseconde.

    Se trie comme du texte. La milliseconde sert à login_required : une
    session ouverte juste avant un changement de mot de passe (même
    seconde) doit quand même être refusée (D22).
    """
    return datetime.now().isoformat(timespec="milliseconds")


def new_id():
    """Nouvel id de compte ou d'analyse : un UUID aléatoire (D21).

    uuid4 tire 122 bits au hasard : impossible à deviner, contrairement à
    1, 2, 3… Il ne révèle pas non plus combien de lignes existent.
    """
    return str(uuid.uuid4())


def split_list(value):
    """Transforme « R2,R3 » en ["R2", "R3"] (et un texte vide en [])."""
    return value.split(",") if value else []


class Database:
    """Lit et écrit les données de SentinelSSH dans un fichier SQLite."""

    def __init__(self, db_path, key):
        """Garde le chemin du fichier et la clé de chiffrement.

        La clé est vérifiée tout de suite (64 caractères hexadécimaux) :
        c'est elle qui permet de l'écrire sans danger dans PRAGMA key.
        """
        if not re.fullmatch(KEY_PATTERN, key):
            raise ValueError("Clé de la base invalide : 64 caractères "
                             "hexadécimaux attendus (voir .env.example)")
        self.db_path = db_path
        self.key = key

    def connect(self):
        """Ouvre la base, donne la clé, puis active les clés étrangères."""
        conn = sqlcipher3.connect(self.db_path)
        # PRAGMA n'accepte pas « ? » : la clé est collée dans la commande,
        # mais elle vient du fichier de l'administrateur (jamais d'un
        # visiteur) et ne contient que 0-9 et a-f (vérifié dans
        # __init__). x'…' : clé brute, déjà aléatoire, pas de dérivation.
        conn.execute("PRAGMA key = \"x'" + self.key + "'\"")
        # Les lignes se lisent comme des dictionnaires : row["ip"].
        conn.row_factory = sqlcipher3.Row
        # SQLite désactive les clés étrangères par défaut : sans cette
        # ligne, ON DELETE CASCADE ne ferait rien.
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def init_db(self):
        """Crée les 4 tables (et les 2 rôles) si elles n'existent pas."""
        script = SCHEMA_PATH.read_text(encoding="utf-8")
        with closing(self.connect()) as conn:
            conn.executescript(script)

    def save_analysis(self, user_id, filename, total_lines, ignored_lines,
                      suspects):
        """Enregistre l'analyse d'un compte et ses IP ; renvoie son id."""
        critical_count = sum(1 for s in suspects if s.severity == "critique")
        created_at = now()
        analysis_id = new_id()
        with closing(self.connect()) as conn:
            conn.execute(
                "INSERT INTO analyses (id, user_id, filename, created_at,"
                " total_lines, ignored_lines, suspect_count, critical_count)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (analysis_id, user_id, filename, created_at, total_lines,
                 ignored_lines, len(suspects), critical_count))
            conn.executemany(
                "INSERT INTO suspect_ips (analysis_id, ip, failures, severity,"
                " rules, users, first_seen, last_seen)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [(analysis_id, s.ip, s.failures, s.severity,
                  ",".join(s.rules), ",".join(s.users),
                  s.first_seen, s.last_seen) for s in suspects])
            conn.commit()
        return analysis_id

    def list_analyses(self, user_id):
        """Renvoie l'historique d'un compte, de la plus récente à la plus
        ancienne."""
        with closing(self.connect()) as conn:
            rows = conn.execute(
                "SELECT id, filename, created_at, total_lines,"
                " suspect_count, critical_count FROM analyses"
                " WHERE user_id = ?"
                # rowid : numéro de ligne caché de SQLite, dans l'ordre
                # d'insertion ; départage 2 analyses de la même seconde
                # (un UUID, lui, n'a pas d'ordre).
                " ORDER BY created_at DESC, rowid DESC",
                (user_id,)).fetchall()
        return [dict(row) for row in rows]

    def get_analysis(self, analysis_id, user_id):
        """Renvoie l'analyse et ses IP triées, ou None si l'id est inconnu
        ou si l'analyse appartient à un autre compte."""
        with closing(self.connect()) as conn:
            row = conn.execute(
                "SELECT * FROM analyses WHERE id = ? AND user_id = ?",
                (analysis_id, user_id)).fetchone()
            if row is None:
                return None
            # Tri : critique, puis elevee, puis moyenne, puis nombre
            # d'échecs (CASE donne un rang à chaque gravité).
            suspect_rows = conn.execute(
                "SELECT ip, failures, severity, rules, users, first_seen,"
                " last_seen FROM suspect_ips WHERE analysis_id = ?"
                " ORDER BY CASE severity WHEN 'critique' THEN 3"
                " WHEN 'elevee' THEN 2 ELSE 1 END DESC, failures DESC",
                (analysis_id,)).fetchall()
        analysis = dict(row)
        analysis["suspects"] = []
        for suspect_row in suspect_rows:
            suspect = dict(suspect_row)
            suspect["rules"] = split_list(suspect["rules"])
            suspect["users"] = split_list(suspect["users"])
            analysis["suspects"].append(suspect)
        return analysis

    def delete_analysis(self, analysis_id, user_id):
        """Supprime une analyse du compte (ses IP suivent par cascade).

        Renvoie True si une analyse a été supprimée, False si l'id
        n'existait pas ou appartient à un autre compte.
        """
        with closing(self.connect()) as conn:
            cursor = conn.execute(
                "DELETE FROM analyses WHERE id = ? AND user_id = ?",
                (analysis_id, user_id))
            conn.commit()
        return cursor.rowcount > 0

    def delete_older_than(self, days):
        """Supprime les analyses de plus de days jours (RGPD, D11).

        Renvoie le nombre d'analyses supprimées.
        """
        limit = datetime.now() - timedelta(days=days)
        with closing(self.connect()) as conn:
            cursor = conn.execute("DELETE FROM analyses WHERE created_at < ?",
                                  (limit.isoformat(timespec="milliseconds"),))
            conn.commit()
        return cursor.rowcount

    def get_recidivists(self, user_id):
        """Renvoie les IP présentes dans au moins 2 analyses du compte."""
        with closing(self.connect()) as conn:
            # La jointure retrouve le propriétaire de chaque IP suspecte.
            rows = conn.execute(
                "SELECT s.ip, COUNT(DISTINCT s.analysis_id) AS analyses_count,"
                " SUM(s.failures) AS total_failures FROM suspect_ips s"
                " JOIN analyses a ON a.id = s.analysis_id"
                " WHERE a.user_id = ?"
                " GROUP BY s.ip HAVING COUNT(DISTINCT s.analysis_id) >= 2"
                " ORDER BY analyses_count DESC, total_failures DESC",
                (user_id,)).fetchall()
        return [dict(row) for row in rows]

    def get_user(self, username):
        """Renvoie le compte (id, username, password_hash, role) ou None."""
        with closing(self.connect()) as conn:
            row = conn.execute(
                "SELECT u.id, u.username, u.password_hash, r.name AS role"
                " FROM users u JOIN roles r ON r.id = u.role_id"
                " WHERE u.username = ?", (username,)).fetchone()
        return dict(row) if row else None

    def get_user_by_id(self, user_id):
        """Renvoie le compte (id, username, role, created_at,
        updated_at), ou None s'il a été supprimé."""
        with closing(self.connect()) as conn:
            row = conn.execute(
                "SELECT u.id, u.username, r.name AS role, u.created_at,"
                " u.updated_at"
                " FROM users u JOIN roles r ON r.id = u.role_id"
                " WHERE u.id = ?", (user_id,)).fetchone()
        return dict(row) if row else None

    def create_user(self, username, password_hash, role="user"):
        """Crée un compte et renvoie son id ; on stocke le hachage, jamais
        le mot de passe.

        Lève sqlcipher3.IntegrityError si le nom est déjà pris (UNIQUE) ou si
        le rôle n'existe pas (role_id NULL refusé par NOT NULL).
        """
        created_at = now()
        user_id = new_id()
        with closing(self.connect()) as conn:
            # La sous-requête traduit le nom du rôle en son id.
            conn.execute(
                "INSERT INTO users (id, username, password_hash, role_id,"
                " created_at, updated_at) VALUES"
                " (?, ?, ?, (SELECT id FROM roles WHERE name = ?), ?, ?)",
                (user_id, username, password_hash, role, created_at,
                 created_at))
            conn.commit()
        return user_id

    def update_username(self, user_id, username):
        """Change le nom du compte.

        Lève sqlcipher3.IntegrityError si le nom est déjà pris (UNIQUE, sans
        tenir compte des majuscules).
        """
        with closing(self.connect()) as conn:
            conn.execute(
                "UPDATE users SET username = ?, updated_at = ? WHERE id = ?",
                (username, now(), user_id))
            conn.commit()

    def update_password_hash(self, user_id, password_hash):
        """Remplace le hachage du mot de passe (jamais le mot de passe)."""
        with closing(self.connect()) as conn:
            conn.execute(
                "UPDATE users SET password_hash = ?, updated_at = ?"
                " WHERE id = ?", (password_hash, now(), user_id))
            conn.commit()

    def list_users(self):
        """Renvoie tous les comptes (sans le hachage), par ordre d'inscription.

        Réservé à l'administrateur : il voit les comptes, pas leurs analyses.
        """
        with closing(self.connect()) as conn:
            rows = conn.execute(
                "SELECT u.id, u.username, r.name AS role, u.created_at,"
                " u.updated_at FROM users u JOIN roles r ON r.id = u.role_id"
                " ORDER BY u.created_at, u.rowid").fetchall()
        return [dict(row) for row in rows]

    def delete_user(self, user_id):
        """Supprime un compte ; ses analyses et leurs IP suivent par cascade.

        Renvoie True si un compte a été supprimé, False si l'id est inconnu.
        """
        with closing(self.connect()) as conn:
            cursor = conn.execute("DELETE FROM users WHERE id = ?",
                                  (user_id,))
            conn.commit()
        return cursor.rowcount > 0
