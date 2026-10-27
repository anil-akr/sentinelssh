# SentinelSSH — contexte pour Claude Code

## Qui je suis et comment m'aider

- Anil, étudiant en 1re année à Holberton School Bordeaux (école de développement). À l'aise en Python, C, Shell, Linux (WSL). Je découvre React.
- Ce projet est évalué à l'oral par mon SWE (revue technique) puis par un jury RNCP : je dois comprendre et savoir expliquer **chaque ligne** du code.
- Réponds en français, avec des mots simples, une idée à la fois, et explique toujours le **pourquoi**.
- Choisis toujours la solution **la plus simple à défendre à l'oral**, efficace et fonctionnelle.
- **Ne m'écris pas directement** le code de `LogParser`, `Detector`, `Database`, des routes de l'API ni des composants React : guide-moi par des questions et des indices, relis mon code, signale franchement les bugs et les failles.
- Tu peux générer de la configuration ou du code répétitif si je le demande explicitement (ex. `vite.config.js`, workflow GitHub Actions, CSS), en commentant les parties clés.
- Avant de modifier un fichier, dis ce que tu vas changer et pourquoi.

## Le projet

Application web qui analyse un fichier de journal SSH (`auth.log`), repère les adresses IP suspectes, leur attribue une gravité et présente les résultats à un administrateur connecté. Usage local uniquement (127.0.0.1).

- 3 règles de détection, une gravité par règle :
  - R1 attaque persistante : ≥ 20 échecs dans le fichier → moyenne
  - R2 force brute rapide : ≥ 5 échecs en ≤ 60 s → élevée
  - R3 compromission possible : connexion réussie après ≥ 5 échecs de la même IP → critique
- Lignes lues : `Failed password` (y compris « for invalid user ») = échec ; `Accepted password` / `Accepted publickey` = succès ; le reste est ignoré mais compté. La ligne `Invalid user … from …` est ignorée (sinon double comptage).
- Formats de date lus (D16) : syslog classique (`Oct 12 14:03:21`), sans année → convertir avec une année bissextile fixe (2000) ; et nouveau format Ubuntu 23.10+ (`2026-10-25T17:17:03.249675+01:00`) → vraie année gardée, microsecondes et fuseau retirés.
- Commande de blocage proposée (`iptables`, ou `ip6tables` pour une IPv6), jamais exécutée.

## Architecture (décidée, ne pas changer sans me le signaler)

- **Back-end** : Python 3 + Flask, dans `backend/`.
  - `sentinel/models.py` : dataclasses `Event` (time, kind, user, ip) et `SuspectIP` (ip, failures, severity, rules, users, first_seen, last_seen, `to_dict()`).
  - `sentinel/parser.py` : `LogParser` (`parse_line`, `parse_text`, `_read_time` : ancien format syslog et format ISO 8601 d'Ubuntu 23.10+, D16).
  - `sentinel/detector.py` : `Detector` (seuils à la création ; `detect`, `_is_persistent`, `_is_fast`, `_is_compromised`, `severity_of`).
  - `sentinel/database.py` : `Database` (`connect` avec `PRAGMA foreign_keys = ON`, `init_db`, `save_analysis`, `list_analyses`, `get_analysis`, `delete_analysis`, `delete_older_than` (purge des 30 jours), `get_recidivists`, `get_user`, `create_user` ; un id plus grand que `SQLITE_MAX_INT` = analyse introuvable).
  - `sentinel/config.py` : seuils, `DB_PATH`, `MAX_UPLOAD_MB` / `MAX_UPLOAD_BYTES` (50 Mo, D17), `ALLOWED_EXTENSIONS`, `SECRET_KEY` (lue dans `.env`), `GEO_CITY_DB` / `GEO_ASN_DB`.
  - `sentinel/geo.py` : `GeoLocator` (`locate`) lit les bases DB-IP Lite de `backend/data/` (téléchargées par `scripts/download_geodb.sh`, jamais commitées) ; position calculée à la lecture, jamais stockée (D14).
  - `schema.sql` (dans `backend/`) : création des 3 tables.
  - `app.py` : `MemoryRequest` (fichier envoyé gardé en mémoire, jamais de fichier temporaire, D17), 8 routes, `login_required`, `block_command(ip)`, erreurs JSON 400/401/404/405/413/500, commande `flask create-admin`, sert `frontend/dist` en production.
  - `cli.py` : mode terminal, sans base.
- **Base** : SQLite, 3 tables : `analyses`, `suspect_ips` (FK `analysis_id` ON DELETE CASCADE), `users` (username UNIQUE, password_hash).
- **API** (JSON, erreurs `{"error": "..."}`) : `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/analyses` (multipart, champ `file`), `GET /api/analyses`, `GET /api/analyses/<id>`, `DELETE /api/analyses/<id>`, `GET /api/recidivists`. Session obligatoire (401) sauf login et logout.
- **Front-end** : React + Vite, React Router, Recharts, dans `frontend/`. Pages : LandingPage (présentation publique, `/presentation`, D15), LoginPage, HomePage, AnalysisPage, PrivacyPage. Composants : ProtectedRoute, Header, UploadForm, HistoryTable, RecidivistsTable, SummaryCards (verdict + chiffres), TopIpsChart, SuspectsTable, SeverityBadge, CopyButton, et depuis D14 : WorldMap, CountryList, IpDetails, SeverityLegend, BlockCommandHelp (aide sous la commande de blocage). Fonctions de mise en forme dans `src/format.js`. Thème sombre, polices IBM Plex (npm). Toutes les requêtes dans `src/api.js`. Proxy Vite `/api` → `http://127.0.0.1:5000` en développement.
- **Production** : `npm run build` puis `gunicorn -b 127.0.0.1:8000 app:app`.

## Précisions tirées de la conception

- Gravité : exactement `"moyenne"`, `"elevee"` (sans accent), `"critique"` — ce sont les valeurs du `CHECK` de la table `suspect_ips`.
- `create-admin` refuse un mot de passe de moins de 12 caractères.
- Tests : `test_parser.py`, `test_detector.py`, `test_database.py`, `test_api.py`, `test_geo.py` ; mini-journaux dans `backend/tests/samples/`.
- Checklist de bout en bout : celle du Stage 3 (§6.2, 13 scénarios).
- CI : `.github/workflows/tests.yml`.
- Durée de conservation : 30 jours, appliquée par une requête `DELETE` au démarrage (décision D11, codée au sprint 2).
- NoSQL (référentiel RNCP) : question posée à l'équipe pédagogique ; rien à ajouter tant qu'il n'y a pas de réponse.

## Règles de sécurité (non négociables)

- Requêtes SQL paramétrées uniquement (`?`), jamais de f-string ni de concaténation.
- Jamais `dangerouslySetInnerHTML` ; tout affichage passe par le JSX.
- Mots de passe hachés avec Werkzeug ; même message « Identifiants incorrects » si le nom ou le mot de passe est faux.
- Cookie de session HttpOnly + `SESSION_COOKIE_SAMESITE = "Lax"` ; `SECRET_KEY` jamais dans le code.
- Le fichier envoyé n'est jamais écrit sur le disque ; seules les IP suspectes sont stockées (RGPD).

## Conventions

- Branches : `main` (protégée, stable), `develop` (intégration), `feature/…` et `fix/…` créées depuis `develop`. Toute fusion passe par une Pull Request vers `develop`.
- Commits au format Conventional Commits : `feat:`, `fix:`, `test:`, `docs:`, `refactor:`.
- Python : style pycodestyle, docstring pour chaque module, classe et méthode publique.
- JavaScript : ESLint sans erreur, un composant par fichier.
- Tests : pytest dans `backend/tests/` (unitaires + intégration avec le client de test Flask et une base temporaire). Objectif : couverture ≥ 80 % de `sentinel`.

## Où en est le projet

- Sprint 0 (préparation) : terminé le 12/10 (dépôt, kanban, labels, milestones, 13 issues du sprint 1, venv, `requirements.txt`).
- Replanification du 12/10 (D12) : sprints décalés d'une semaine. Sprint 1 : 12 → 18 oct. ; Sprint 2 : 19 → 25 oct. ; Sprint 3 : 26 oct. → 1er nov. ; Sprint 4 : 2 → 8 nov. ; marge : 9 → 12 nov. ; **demo day le 13 novembre**. Date de la revue avec le SWE à confirmer.
- 25/10 : changement de méthode, Claude produit le code (MR dans moins de 2 semaines) ; Anil commite et pousse lui-même.
- Bloc 1 (moteur d'analyse, PR #19) et bloc 2 (base, API, connexion, CI, PR #20) fusionnés dans `develop` (`ed46c31`).
- Bloc 3 (front React, thème sombre, géolocalisation DB-IP + carte (D14), page de présentation (D15), collection Postman, test Loghub, branche `feature/frontend`) : écrit et testé, voir `docs/testing/test-report.md`.
- 27/10 : nouveau format de date (D16), accueil enrichi, aide de la commande de blocage, couleurs vives, limite d'envoi à 50 Mo et fichier gardé en mémoire (D17), carte accélérée, vérification générale (rapport de tests §8).
- Reste : PR `feature/frontend` → `develop`, fusion dans `main`, tag v1.0.0, lancement en production, README final ; revues et rétrospectives des sprints (`docs/sprints/`, encore vides).
- **À mettre à jour à chaque début de sprint.**

## Documents de référence

- Plan des sprints : @docs/sprints/sprint-planning.md
- Journal des décisions : @docs/decisions.md
- Documentation détaillée (PDF, à lire seulement si nécessaire) : `docs/stages/SentinelSSH_Stage3_Technical_Documentation.pdf` et `docs/stages/SentinelSSH_Conception_complete.pdf`
