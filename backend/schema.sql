-- Schéma de la base SentinelSSH : 4 tables.
-- « IF NOT EXISTS » : le script peut être relancé à chaque démarrage
-- sans effacer les données.
--
-- Les comptes et les analyses ont pour id un UUID (texte aléatoire de 36
-- caractères, créé par Python) : impossible à deviner, et il ne révèle
-- pas combien de comptes ou d'analyses existent (D21).
--
-- Relations (cardinalités Merise) :
--   users (1,1) ---- (0,n) roles     : un compte a un seul rôle
--   analyses (1,1) - (0,n) users     : une analyse appartient à un compte
--   suspect_ips (1,1) - (0,n) analyses

-- Les rôles possibles : « admin » gère les comptes, « user » analyse.
CREATE TABLE IF NOT EXISTS roles (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    NOT NULL UNIQUE CHECK (name IN ('admin', 'user'))
);

-- « OR IGNORE » : au 2e démarrage, les rôles existent déjà (UNIQUE),
-- l'insertion est simplement sautée.
INSERT OR IGNORE INTO roles (name) VALUES ('admin'), ('user');

-- Un compte. Seul le hachage du mot de passe est stocké.
-- COLLATE NOCASE : « Admin » et « admin » sont le même nom (UNIQUE les
-- compare sans les majuscules) : personne ne peut imiter un autre compte.
-- Pas de ON DELETE sur role_id : impossible de supprimer un rôle utilisé.
CREATE TABLE IF NOT EXISTS users (
    id            TEXT    PRIMARY KEY,  -- UUID
    username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    role_id       INTEGER NOT NULL REFERENCES roles (id),
    created_at    TEXT    NOT NULL,  -- ISO 8601
    -- Dernier changement de nom ou de mot de passe (= created_at au début).
    -- Pas de updated_at sur les analyses : elles ne sont jamais modifiées.
    updated_at    TEXT    NOT NULL
);

-- Une ligne par fichier analysé. Supprimer un compte supprime ses
-- analyses (et donc leurs IP, par la cascade suivante).
CREATE TABLE IF NOT EXISTS analyses (
    id             TEXT    PRIMARY KEY,  -- UUID
    user_id        TEXT    NOT NULL
                   REFERENCES users (id) ON DELETE CASCADE,
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
    analysis_id TEXT    NOT NULL
                REFERENCES analyses (id) ON DELETE CASCADE,
    ip          TEXT    NOT NULL,
    failures    INTEGER NOT NULL,
    severity    TEXT    NOT NULL
                CHECK (severity IN ('moyenne', 'elevee', 'critique')),
    rules       TEXT,  -- ex. « R2,R3 »
    users       TEXT,  -- ex. « root,admin,anil » (3 comptes les plus visés)
    first_seen  TEXT,  -- heure du journal, ex. « 2000-10-12 14:03:21 »
    last_seen   TEXT
);
