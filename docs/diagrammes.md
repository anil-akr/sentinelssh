# Diagrammes de SentinelSSH

Diagrammes écrits en [Mermaid](https://mermaid.js.org/) : GitHub les affiche comme des images, et ils se mettent à
jour comme du code (texte versionné dans Git). À jour au 28/10/2026 (site multi-comptes et profils, D20 et D21).

## Architecture

```mermaid
flowchart TB
    nav["Navigateur<br/>React (Vite) : 9 pages"]
    api["API REST : Flask (app.py)<br/>16 routes JSON, session, rôles, limitation des tentatives"]
    cli["cli.py<br/>mode terminal, sans base"]
    subgraph coeur["Cœur d'analyse : Python pur"]
        parser["LogParser<br/>parser.py"] -- événements --> detector["Detector<br/>detector.py"]
    end
    geo["GeoLocator<br/>geo.py + bases DB-IP locales"]
    limiter["RateLimiter<br/>limiter.py, en mémoire"]
    db["Database<br/>database.py"]
    sqlite[("SQLite<br/>sentinel.db, 4 tables")]

    nav <-- "requête HTTP (JSON ou fichier + cookie) / réponse JSON" --> api
    api -- "texte du fichier / IP suspectes" --> coeur
    cli --> coeur
    api -- "position de chaque IP, jamais stockée" --> geo
    api -- "tentatives par IP" --> limiter
    api -- "enregistre / lit, filtré par compte" --> db
    db -- "SQL paramétré" --> sqlite
```

Aucun service extérieur : la géolocalisation est faite par une base installée sur le serveur.

## Base de données

```mermaid
erDiagram
    roles ||--o{ users : "donne son rôle à"
    users ||--o{ analyses : "possède"
    analyses ||--o{ suspect_ips : "contient"

    roles {
        INTEGER id PK
        TEXT name UK "admin ou user"
    }
    users {
        TEXT id PK "UUID"
        TEXT username UK "COLLATE NOCASE"
        TEXT password_hash "jamais le mot de passe"
        INTEGER role_id FK
        TEXT created_at
        TEXT updated_at "nom ou mot de passe changé"
    }
    analyses {
        TEXT id PK "UUID"
        TEXT user_id FK "ON DELETE CASCADE"
        TEXT filename
        TEXT created_at
        INTEGER total_lines
        INTEGER ignored_lines
        INTEGER suspect_count
        INTEGER critical_count
    }
    suspect_ips {
        INTEGER id PK
        TEXT analysis_id FK "ON DELETE CASCADE"
        TEXT ip
        INTEGER failures
        TEXT severity "moyenne, elevee ou critique"
        TEXT rules
        TEXT users
        TEXT first_seen
        TEXT last_seen
    }
```

Cardinalités (Merise) :

- `users` (1,1) — (0,n) `roles` : chaque compte a exactement un rôle ; un rôle est partagé par plusieurs comptes.
  D'où la clé étrangère `role_id` dans `users`.
- `analyses` (1,1) — (0,n) `users` : chaque analyse appartient à un seul compte.
- `suspect_ips` (1,1) — (0,n) `analyses`.
- Les comptes et les analyses ont un UUID pour clé : impossible à deviner, et il ne révèle pas combien il y en a.
  `suspect_ips` garde un entier : son id n'apparaît jamais dans l'API.
- Supprimer un compte supprime ses analyses, qui suppriment leurs IP (cascade). Un rôle utilisé ne peut pas être
  supprimé (pas de `ON DELETE` sur `role_id`).

## Classes du back-end

```mermaid
classDiagram
    class LogParser {
        +int year = 2000
        +parse_line(line) Event
        +parse_text(text) tuple
    }
    class Detector {
        +int persistent_threshold
        +int fast_threshold
        +int fast_window
        +int compromise_threshold
        +detect(events) list~SuspectIP~
        -_is_persistent(times) bool
        -_is_fast(times) bool
        -_is_compromised(events) bool
        +severity_of(rules) str
    }
    class Database {
        +str db_path
        +connect() Connection
        +init_db()
        +save_analysis(user_id, filename, ...) str
        +list_analyses(user_id) list
        +get_analysis(id, user_id) dict
        +delete_analysis(id, user_id) bool
        +delete_older_than(days) int
        +get_recidivists(user_id) list
        +get_user(username) dict
        +get_user_by_id(user_id) dict
        +create_user(username, hash, role) str
        +update_username(user_id, username)
        +update_password_hash(user_id, hash)
        +list_users() list
        +delete_user(user_id) bool
    }
    class GeoLocator {
        +locate(ip) dict
    }
    class RateLimiter {
        +int max_attempts
        +int window
        +is_blocked(key) bool
        +record(key)
        +reset(key)
    }
    class Event {
        <<dataclass>>
        +datetime time
        +str kind
        +str user
        +str ip
    }
    class SuspectIP {
        <<dataclass>>
        +str ip
        +int failures
        +str severity
        +list rules
        +list users
        +str first_seen
        +str last_seen
        +to_dict() dict
    }
    LogParser ..> Event : crée
    Detector ..> Event : lit
    Detector ..> SuspectIP : produit
    Database ..> SuspectIP : enregistre
```

`app.py` (routes Flask) utilise `LogParser`, `Detector`, `Database`, `GeoLocator` et `RateLimiter` ; `cli.py` utilise
seulement `LogParser` et `Detector`.

## Séquence : inscription et connexion

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant R as React
    participant A as API Flask
    participant L as RateLimiter
    participant D as Database

    U->>R: saisit nom + mot de passe
    R->>A: POST /api/auth/login
    A->>L: is_blocked(IP) ?
    alt 5 échecs en 15 min
        A-->>R: 429 Trop de tentatives
    else
        A->>D: get_user(nom)
        D-->>A: compte + hachage + rôle (ou rien)
        A->>A: compare le hachage
        alt identifiants faux
            A->>L: record(IP)
            A-->>R: 401 Identifiants incorrects
        else identifiants justes
            A->>L: reset(IP)
            A-->>R: 200 + cookie de session (user_id)
            R-->>U: ouvre /analyse
        end
    end
```

L'inscription (`POST /api/auth/register`) suit le même chemin : 5 tentatives par heure et par IP, puis
`create_user` (rôle `user`) et ouverture de la session.

## Séquence : analyse d'un fichier

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant R as React
    participant A as API Flask
    participant C as Cœur d'analyse
    participant D as Database

    U->>R: choisit le fichier
    R->>A: POST /api/analyses (fichier + cookie)
    A->>D: get_user_by_id(session), le compte existe-t-il encore ?
    D-->>A: compte (ou rien : 401)
    A->>A: vérifie le fichier (extension, 50 Mo), gardé en mémoire
    A->>C: parse_text(texte)
    C-->>A: événements + compteurs
    A->>C: detect(événements)
    C-->>A: IP suspectes
    A->>D: save_analysis(user_id, ...)
    D-->>A: id de l'analyse
    A-->>R: 201 + JSON
    R-->>U: ouvre /analyses/:id
```

## Séquence : consultation d'une analyse

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant R as React
    participant A as API Flask
    participant D as Database

    U->>R: clique sur Voir
    R->>A: GET /api/analyses/1
    A->>D: get_user_by_id(session)
    A->>D: get_analysis(1, user_id)
    D-->>A: analyse + IP, ou rien si inconnue ou à un autre compte
    A->>A: commande de blocage et position de chaque IP
    A-->>R: 200 + JSON (ou 404, sans dire si elle existe)
    R-->>U: verdict, carte, graphique, tableau
```
