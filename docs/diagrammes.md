# Diagrammes de SentinelSSH

Diagrammes écrits en [Mermaid](https://mermaid.js.org/) : GitHub les affiche comme des images, et ils se mettent à
jour comme du code (texte versionné dans Git). Une copie en PNG de chacun est dans `docs/images/` (voir la
[liste à la fin](#images-png)).

À jour au 29/10/2026 : site multi-comptes (D20), profils (D21), sécurité (D22), audit (D23).

Sommaire : [cas d'utilisation](#cas-dutilisation) · [architecture](#architecture) ·
[base de données](#base-de-données) · [classes](#classes-du-back-end) ·
[inscription et connexion](#séquence--inscription-et-connexion) · [analyse](#séquence--analyse-dun-fichier) ·
[consultation](#séquence--consultation-dune-analyse) · [modification du compte](#séquence--modification-du-compte) ·
[CI](#intégration-continue) · [branches](#branches-git) · [production](#mise-en-production)

## Cas d'utilisation

```mermaid
flowchart LR
    visiteur(["Visiteur"])
    user(["Utilisateur connecté"])
    admin(["Administrateur"])

    subgraph site["SentinelSSH"]
        p1["Lire la présentation et la page Confidentialité"]
        p2["Créer un compte"]
        p3["Se connecter / se déconnecter"]
        u1["Envoyer un journal auth.log"]
        u2["Lire une analyse : verdict, carte, fiches des IP"]
        u3["Copier une commande de blocage"]
        u4["Voir l'historique et les IP récidivistes"]
        u5["Supprimer une analyse"]
        u6["Changer son nom ou son mot de passe"]
        u7["Supprimer son compte"]
        a1["Lister les comptes"]
        a2["Renommer un user, réinitialiser son mot de passe"]
        a3["Supprimer un user ou une de ses analyses, sans la lire"]
    end

    visiteur --> p1
    visiteur --> p2
    visiteur --> p3
    user --> u1
    user --> u2
    user --> u3
    user --> u4
    user --> u5
    user --> u6
    user --> u7
    admin --> u6
    admin --> a1
    admin --> a2
    admin --> a3
```

- Un visiteur devient utilisateur en créant un compte (rôle `user`).
- L'administrateur est créé seulement par `flask create-admin`, sur le serveur. Il peut aussi analyser ses propres
  journaux, mais ne peut pas supprimer son compte, et ne lit jamais les analyses des autres.

## Architecture

```mermaid
flowchart TB
    nav["Navigateur<br/>React (Vite) : 9 pages, 25 composants<br/>toutes les requêtes dans api.js"]
    api["API REST : Flask (app.py)<br/>16 routes JSON, session signée, rôles"]
    cli["cli.py<br/>mode terminal, sans base"]
    subgraph coeur["Cœur d'analyse : Python pur"]
        parser["LogParser<br/>parser.py"] -- "événements Event" --> detector["Detector<br/>detector.py"]
    end
    geo["GeoLocator<br/>geo.py + bases DB-IP locales"]
    limiter["RateLimiter<br/>limiter.py, en mémoire"]
    db["Database<br/>database.py"]
    sqlite[("SQLite chiffrée (SQLCipher)<br/>sentinel.db, 4 tables")]
    key[/"Fichier de la clé<br/>DB_KEY_FILE, hors du dépôt"/]

    nav <-- "requête HTTP (JSON ou fichier + cookie) / réponse JSON" --> api
    api -- "texte du fichier, gardé en mémoire" --> coeur
    cli --> coeur
    api -- "position de chaque IP, jamais stockée" --> geo
    api -- "tentatives par IP" --> limiter
    api -- "enregistre / lit, filtré par compte" --> db
    db -- "SQL paramétré" --> sqlite
    key -. "lue au démarrage" .-> db
```

- Aucun service extérieur : la géolocalisation est faite par une base installée sur le serveur.
- Le cœur d'analyse ne connaît ni le web ni la base : `cli.py` et `app.py` s'en servent tous les deux.
- En développement, Vite (port 5173) transmet `/api` à Flask (port 5000). En production, Gunicorn sert l'API et le
  front construit sur le même port (8000).

## Base de données

```mermaid
erDiagram
    roles ||--o{ users : "donne son rôle à"
    users ||--o{ analyses : "possède"
    analyses ||--o{ suspect_ips : "contient"

    roles {
        INTEGER id PK
        TEXT name UK "admin ou user (CHECK)"
    }
    users {
        TEXT id PK "UUID"
        TEXT username UK "COLLATE NOCASE"
        TEXT password_hash "jamais le mot de passe"
        INTEGER role_id FK "NOT NULL"
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
        TEXT severity "moyenne, elevee ou critique (CHECK)"
        TEXT rules "ex. R2,R3"
        TEXT users "JSON, 3 comptes les plus visés"
        TEXT first_seen "ex. 2000-10-12 14:03:21"
        TEXT last_seen
    }
```

Cardinalités (Merise) :

- `users` (1,1) — (0,n) `roles` : chaque compte a exactement un rôle ; un rôle est partagé par plusieurs comptes.
  D'où la clé étrangère `role_id` dans `users`.
- `analyses` (1,1) — (0,n) `users` : chaque analyse appartient à un seul compte.
- `suspect_ips` (1,1) — (0,n) `analyses`.

Règles :

- Les comptes et les analyses ont un UUID pour clé : impossible à deviner, et il ne révèle pas combien il y en a.
  `suspect_ips` garde un entier : son id n'apparaît jamais dans l'API.
- Supprimer un compte supprime ses analyses, qui suppriment leurs IP (cascade, grâce à `PRAGMA foreign_keys = ON`).
  Un rôle utilisé ne peut pas être supprimé (pas de `ON DELETE` sur `role_id`).
- Le fichier envoyé n'est jamais stocké : seules les IP suspectes le sont (minimisation, RGPD).
- Tout le fichier `sentinel.db` est chiffré par SQLCipher (D22).

## Classes du back-end

```mermaid
classDiagram
    class LogParser {
        +int year = 2000
        -_read_time(line) datetime
        +parse_line(line) Event
        +parse_text(text) tuple
    }
    class Detector {
        +int persistent_threshold = 20
        +int fast_threshold = 5
        +int fast_window = 60
        +int compromise_threshold = 5
        +detect(events) list~SuspectIP~
        -_is_persistent(times) bool
        -_is_fast(times) bool
        -_is_compromised(events) bool
        +severity_of(rules) str
    }
    class Database {
        +str db_path
        +str key
        +connect() Connection
        +init_db()
        +save_analysis(user_id, filename, total_lines, ignored_lines, suspects) str
        +list_analyses(user_id) list
        +get_analysis(analysis_id, user_id) dict
        +delete_analysis(analysis_id, user_id) bool
        +delete_older_than(days) int
        +get_recidivists(user_id) list
        +get_user(username) dict
        +get_user_by_id(user_id) dict
        +create_user(username, password_hash, role) str
        +update_username(user_id, username)
        +update_password_hash(user_id, password_hash)
        +list_users() list
        +delete_user(user_id) bool
    }
    class GeoLocator {
        +city_db
        +asn_db
        +locate(ip) dict
    }
    class RateLimiter {
        +int max_attempts
        +int window
        +dict attempts
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

- `app.py` (routes Flask) utilise `LogParser`, `Detector`, `Database`, `GeoLocator` et deux `RateLimiter`
  (`login_limiter` : 5 échecs en 15 min ; `register_limiter` : 5 inscriptions par heure).
- `cli.py` utilise seulement `LogParser` et `Detector`.
- `database.py` a aussi deux fonctions : `now()` (date ISO 8601 à la milliseconde) et `new_id()` (UUID v4).

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
        D-->>A: compte, hachage, rôle (ou rien)
        A->>A: check_password_hash
        alt nom ou mot de passe faux
            A->>L: record(IP)
            A-->>R: 401 Identifiants incorrects
        else identifiants justes
            A->>L: reset(IP)
            A->>A: open_session : user_id + logged_at
            A-->>R: 200 + cookie signé HttpOnly (60 min)
            R-->>U: ouvre /analyse
        end
    end
```

L'inscription (`POST /api/auth/register`) suit le même chemin, avec `register_limiter` (5 tentatives par heure et
par IP). Elle vérifie le nom (3 à 30 caractères) et le mot de passe (12 à 128), puis appelle `create_user` (rôle
`user`, mot de passe haché) et ouvre la session. Un nom déjà pris répond 409, même avec d'autres majuscules.

## Séquence : analyse d'un fichier

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant R as React
    participant A as API Flask
    participant C as Cœur d'analyse
    participant D as Database

    U->>R: choisit le fichier
    R->>R: plus de 50 Mo ? refusé avant l'envoi
    R->>A: POST /api/analyses (fichier + cookie)
    A->>D: login_required : get_user_by_id(session)
    D-->>A: compte, ou 401 s'il n'existe plus
    A->>A: champ file, nom de 255 max, .log ou .txt (sinon 400)
    A->>A: fichier gardé en mémoire (MemoryRequest), 413 au-delà de 50 Mo
    A->>A: vide ? 400. Sinon read_log_text (UTF-8, BOM, UTF-16)
    A->>C: parse_text(texte)
    C-->>A: événements + lignes lues et ignorées
    alt aucune tentative SSH
        A-->>R: 400 Aucune tentative de connexion SSH, rien enregistré
    else
        A->>C: detect(événements)
        C-->>A: IP suspectes triées
        A->>D: save_analysis(user_id, ...)
        D-->>A: UUID de l'analyse
        A-->>R: 201 + id, nombre de suspects et de critiques
        R-->>U: ouvre /analyses/:id
    end
```

## Séquence : consultation d'une analyse

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant R as React
    participant A as API Flask
    participant D as Database
    participant G as GeoLocator

    U->>R: clique sur Voir
    R->>A: GET /api/analyses/UUID
    A->>D: login_required : get_user_by_id(session)
    A->>D: get_analysis(UUID, user_id)
    D-->>A: analyse + IP triées, ou rien si inconnue ou à un autre compte
    alt rien
        A-->>R: 404 Analyse introuvable, sans dire si elle existe
    else
        loop chaque IP suspecte
            A->>A: block_command(ip) si gravité élevée ou critique
            A->>G: locate(ip)
            G-->>A: pays, ville, position, opérateur
        end
        A-->>R: 200 + JSON
        R-->>U: verdict, carte, pays, graphique, tableau, fiches
    end
```

La commande de blocage et la position sont calculées à chaque lecture, jamais stockées (D13, D14).

## Séquence : modification du compte

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant R as React
    participant A as API Flask
    participant D as Database
    actor O as Autre appareil

    U->>R: nouveau nom ou mot de passe + mot de passe actuel
    R->>A: PATCH /api/auth/me
    A->>A: règles du nom et du mot de passe (sinon 400)
    A->>D: password_matches(mot de passe actuel)
    alt mot de passe actuel faux
        A->>A: login_limiter.record(IP)
        A-->>R: 400 Mot de passe actuel incorrect
    else juste
        A->>D: update_username / update_password_hash
        D->>D: updated_at = maintenant
        A->>A: open_session : nouveau logged_at
        A-->>R: 200 + compte mis à jour, cette session reste ouverte
        O->>A: requête avec une ancienne session
        A->>D: get_user_by_id
        A->>A: logged_at plus ancien que updated_at
        A-->>O: 401 Connexion requise
    end
```

- L'administrateur fait la même chose pour un user par `PATCH /api/users/<id>`, sans mot de passe actuel. Toutes les
  sessions du user sont alors refusées (D22).
- Un compte admin ne se gère jamais par `/api/users/<id>` (403) : il modifie son propre compte par `/api/auth/me`.

## Intégration continue

```mermaid
flowchart LR
    push["git push ou Pull Request"] --> gha["GitHub Actions<br/>.github/workflows/tests.yml"]
    gha --> back
    gha --> front
    subgraph back["Job backend (Python)"]
        b1["pip install -r requirements.txt"] --> b2["pycodestyle"] --> b3["pytest --cov=sentinel<br/>--cov-fail-under=80"]
    end
    subgraph front["Job frontend (Node.js)"]
        f1["npm ci"] --> f2["ESLint"] --> f3["npm run build"]
    end
    b3 --> ok{"Les 2 jobs<br/>réussis ?"}
    f3 --> ok
    ok -- oui --> merge["Fusion possible dans develop"]
    ok -- non --> fix["Corriger avant de fusionner"]
```

## Branches Git

```mermaid
gitGraph
    commit id: "docs du projet"
    branch develop
    checkout develop
    branch feature/project-setup
    commit id: "CLAUDE.md, requirements"
    checkout develop
    merge feature/project-setup id: "PR #14"
    branch feature/replanning
    commit id: "D11, D12"
    checkout develop
    merge feature/replanning id: "PR #15"
    branch feature/models-config
    commit id: "Event, SuspectIP"
    checkout develop
    merge feature/models-config id: "PR #16"
    branch feature/samples
    commit id: "mini-journaux"
    checkout develop
    merge feature/samples id: "PR #17"
    branch feature/parse-line
    commit id: "parse_line"
    checkout develop
    merge feature/parse-line id: "PR #18"
    branch feature/analysis-engine
    commit id: "parse_text, Detector, cli"
    checkout develop
    merge feature/analysis-engine id: "PR #19"
    branch feature/api-database
    commit id: "Database, API, CI"
    checkout develop
    merge feature/api-database id: "PR #20"
    branch feature/frontend
    commit id: "React, carte, D14-D19"
    commit id: "comptes, D20-D22"
    commit id: "audit, D23"
    checkout develop
    merge feature/frontend id: "PR à venir"
    checkout main
    merge develop id: "v1.0.0 à venir"
```

- `main` : stable, protégée ; elle recevra `develop` à la fin, avec le tag `v1.0.0`.
- `develop` : intégration ; chaque fonctionnalité y arrive par une Pull Request (PR #14 à #20 fusionnées, la PR de
  `feature/frontend` reste à ouvrir).
- `feature/…` et `fix/…` : une branche par tâche, créée depuis `develop`.

## Mise en production

```mermaid
flowchart LR
    src["frontend/src"] -- "npm run build" --> dist["frontend/dist<br/>HTML, JS, CSS"]
    env[/".env<br/>SECRET_KEY, CORS_ORIGINS,<br/>SESSION_LIFETIME_MINUTES, DB_KEY_FILE"/] --> app
    key[/"Fichier de la clé<br/>hors du dépôt"/] --> app
    dist --> app["Gunicorn<br/>gunicorn -b 127.0.0.1:8000 app:app"]
    app --> nav["Navigateur<br/>http://127.0.0.1:8000"]
    app --> sqlite[("sentinel.db chiffrée")]
```

- Flask sert `frontend/dist` : un fichier qui existe est renvoyé tel quel, une route de React reçoit `index.html`,
  un fichier absent répond 404, et `/api/...` va aux routes de l'API.
- Au démarrage : création des tables si besoin, puis suppression des analyses de plus de 30 jours (D11).
- La mise en ligne (serveur, Nginx, HTTPS) n'est pas encore faite : le site écoute seulement en local.

## Images PNG

Copies des diagrammes ci-dessus, pour un document ou une présentation (régénérées le 29/10/2026).

| Image | Diagramme |
|---|---|
| `docs/images/cas-utilisation.png` | Cas d'utilisation |
| `docs/images/architecture.png` | Architecture |
| `docs/images/diagramme-base-de-donnees.png` | Base de données |
| `docs/images/diagramme-classes.png` | Classes du back-end |
| `docs/images/sequence-connexion.png` | Inscription et connexion |
| `docs/images/sequence-analyse.png` | Analyse d'un fichier |
| `docs/images/sequence-consultation.png` | Consultation d'une analyse |
| `docs/images/sequence-compte.png` | Modification du compte |
| `docs/images/pipeline-ci.png` | Intégration continue |
| `docs/images/branches-git.png` | Branches Git |
| `docs/images/pipeline-deploiement.png` | Mise en production |

Les 3 maquettes (`maquette-accueil.png`, `maquette-detail.png`, `maquette-connexion-mobile.png`) datent de la
conception (Stage 3) : l'interface finale a évolué depuis (D14 à D21).
