-- Schéma de la base SentinelSSH : 3 tables.
-- « IF NOT EXISTS » : le script peut être relancé à chaque démarrage
-- sans effacer les données.

-- Une ligne par fichier analysé.
CREATE TABLE IF NOT EXISTS analyses (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    filename       TEXT    NOT NULL,
    created_at     TEXT    NOT NULL,  -- ISO 8601 : se trie comme du texte
    total_lines    INTEGER NOT NULL,
    ignored_lines  INTEGER NOT NULL,
    suspect_count  INTEGER NOT NULL,
    critical_count INTEGER NOT NULL
);

-- Une ligne par IP suspecte dans une analyse (relation 1 -> N).
CREATE TABLE IF NOT EXISTS suspect_ips (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_id INTEGER NOT NULL
                REFERENCES analyses (id) ON DELETE CASCADE,
    ip          TEXT    NOT NULL,
    failures    INTEGER NOT NULL,
    severity    TEXT    NOT NULL
                CHECK (severity IN ('moyenne', 'elevee', 'critique')),
    rules       TEXT,  -- ex. « R2,R3 »
    users       TEXT,  -- ex. « root,admin,anil » (3 comptes les plus visés)
    first_seen  TEXT,  -- heure du journal, ex. « Oct 12 14:03:21 »
    last_seen   TEXT
);

-- Le compte administrateur. Seul le hachage du mot de passe est stocké.
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL
);
