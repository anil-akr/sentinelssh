"""Accès à la base SQLite : analyses, IP suspectes et compte administrateur.

Toutes les requêtes sont paramétrées (« ? ») : une valeur venue de
l'extérieur n'est jamais collée dans le texte SQL (injection SQL).
"""

import sqlite3
from contextlib import closing
from datetime import datetime, timedelta
from pathlib import Path

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "schema.sql"


def split_list(value):
    """Transforme « R2,R3 » en ["R2", "R3"] (et un texte vide en [])."""
    return value.split(",") if value else []


class Database:
    """Lit et écrit les données de SentinelSSH dans un fichier SQLite."""

    def __init__(self, db_path):
        """Garde le chemin du fichier ; les tests passent une base jetable."""
        self.db_path = db_path

    def connect(self):
        """Ouvre la base et active les clés étrangères."""
        conn = sqlite3.connect(self.db_path)
        # Les lignes se lisent comme des dictionnaires : row["ip"].
        conn.row_factory = sqlite3.Row
        # SQLite désactive les clés étrangères par défaut : sans cette
        # ligne, ON DELETE CASCADE ne ferait rien.
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def init_db(self):
        """Crée les 3 tables si elles n'existent pas encore."""
        script = SCHEMA_PATH.read_text(encoding="utf-8")
        with closing(self.connect()) as conn:
            conn.executescript(script)

    def save_analysis(self, filename, total_lines, ignored_lines, suspects):
        """Enregistre une analyse et ses IP suspectes ; renvoie son id."""
        critical_count = sum(1 for s in suspects if s.severity == "critique")
        created_at = datetime.now().isoformat(timespec="seconds")
        with closing(self.connect()) as conn:
            cursor = conn.execute(
                "INSERT INTO analyses (filename, created_at, total_lines,"
                " ignored_lines, suspect_count, critical_count)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (filename, created_at, total_lines, ignored_lines,
                 len(suspects), critical_count))
            analysis_id = cursor.lastrowid
            conn.executemany(
                "INSERT INTO suspect_ips (analysis_id, ip, failures, severity,"
                " rules, users, first_seen, last_seen)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [(analysis_id, s.ip, s.failures, s.severity,
                  ",".join(s.rules), ",".join(s.users),
                  s.first_seen, s.last_seen) for s in suspects])
            conn.commit()
        return analysis_id

    def list_analyses(self):
        """Renvoie l'historique, de la plus récente à la plus ancienne."""
        with closing(self.connect()) as conn:
            rows = conn.execute(
                "SELECT id, filename, created_at, total_lines,"
                " suspect_count, critical_count FROM analyses"
                " ORDER BY created_at DESC, id DESC").fetchall()
        return [dict(row) for row in rows]

    def get_analysis(self, analysis_id):
        """Renvoie l'analyse et ses IP triées, ou None si l'id est inconnu."""
        with closing(self.connect()) as conn:
            row = conn.execute("SELECT * FROM analyses WHERE id = ?",
                               (analysis_id,)).fetchone()
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

    def delete_analysis(self, analysis_id):
        """Supprime une analyse (ses IP suivent par cascade).

        Renvoie True si une analyse a été supprimée, False si l'id
        n'existait pas.
        """
        with closing(self.connect()) as conn:
            cursor = conn.execute("DELETE FROM analyses WHERE id = ?",
                                  (analysis_id,))
            conn.commit()
        return cursor.rowcount > 0

    def delete_older_than(self, days):
        """Supprime les analyses de plus de days jours (RGPD, D11).

        Renvoie le nombre d'analyses supprimées.
        """
        limit = datetime.now() - timedelta(days=days)
        with closing(self.connect()) as conn:
            cursor = conn.execute("DELETE FROM analyses WHERE created_at < ?",
                                  (limit.isoformat(timespec="seconds"),))
            conn.commit()
        return cursor.rowcount

    def get_recidivists(self):
        """Renvoie les IP présentes dans au moins 2 analyses."""
        with closing(self.connect()) as conn:
            rows = conn.execute(
                "SELECT ip, COUNT(DISTINCT analysis_id) AS analyses_count,"
                " SUM(failures) AS total_failures FROM suspect_ips"
                " GROUP BY ip HAVING COUNT(DISTINCT analysis_id) >= 2"
                " ORDER BY analyses_count DESC, total_failures DESC"
            ).fetchall()
        return [dict(row) for row in rows]

    def get_user(self, username):
        """Renvoie le compte (id, username, password_hash) ou None."""
        with closing(self.connect()) as conn:
            row = conn.execute("SELECT * FROM users WHERE username = ?",
                               (username,)).fetchone()
        return dict(row) if row else None

    def create_user(self, username, password_hash):
        """Crée le compte ; on stocke le hachage, jamais le mot de passe."""
        with closing(self.connect()) as conn:
            conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, password_hash))
            conn.commit()
