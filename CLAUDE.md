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

Site web multi-comptes (D20) : chacun crée un compte (nom + mot de passe, sans e-mail), dépose son journal SSH (`auth.log`) et voit ses propres analyses : IP suspectes, gravité, carte, commande de blocage. Un rôle administrateur gère les comptes (liste, suppression) sans voir leurs analyses. **C'est un site web, pas une application à installer** : seule la mise en ligne (serveur, HTTPS) n'est pas encore prévue ; pour l'instant il tourne sur 127.0.0.1.

- 3 règles de détection, une gravité par règle :
  - R1 attaque persistante : ≥ 20 échecs dans le fichier → moyenne
  - R2 force brute rapide : ≥ 5 échecs en ≤ 60 s → élevée
  - R3 compromission possible : connexion réussie après ≥ 5 échecs de la même IP → critique
- Lignes lues : `Failed password` (y compris « for invalid user ») = échec ; `Accepted password` / `Accepted publickey` = succès ; le reste est ignoré mais compté. La ligne `Invalid user … from …` est ignorée (sinon double comptage). Le nom d'utilisateur est libre (espaces, virgules, vide) ; l'IP est le dernier `from <IP> port <n>` de la ligne (un nom piégé ne peut pas faire accuser une autre IP) et doit être une vraie IP (`ipaddress`), sinon ligne ignorée (D23).
- Fichier refusé (400, rien d'enregistré) s'il est vide ou ne contient aucune tentative de connexion SSH ; UTF-8 (avec ou sans BOM) et UTF-16 (PowerShell) lus (D23).
- Formats de date lus (D16) : syslog classique (`Oct 12 14:03:21`), sans année → convertir avec une année bissextile fixe (2000), qui recule d'un an pour la partie d'avant un Nouvel An (D18) ; et nouveau format Ubuntu 23.10+ (`2026-10-25T17:17:03.249675+01:00`) → vraie année gardée, microsecondes et fuseau retirés.
- Commande de blocage proposée (`iptables`, ou `ip6tables` pour une IPv6), jamais exécutée.

## Architecture (décidée, ne pas changer sans me le signaler)

- **Back-end** : Python 3 + Flask, dans `backend/`.
  - `sentinel/models.py` : dataclasses `Event` (time, kind, user, ip) et `SuspectIP` (ip, failures, severity, rules, users, first_seen, last_seen, `to_dict()`).
  - `sentinel/parser.py` : `LogParser` (`parse_line`, `parse_text`, `_read_time` : ancien format syslog et format ISO 8601 d'Ubuntu 23.10+, D16).
  - `sentinel/detector.py` : `Detector` (seuils à la création ; `detect`, `_is_persistent`, `_is_fast`, `_is_compromised`, `severity_of`).
  - `sentinel/database.py` : `Database(db_path, key)` (base chiffrée par SQLCipher, clé de 64 caractères hexadécimaux vérifiée, D22 ; `connect` avec `PRAGMA key` puis `PRAGMA foreign_keys = ON`, `init_db`, `save_analysis`, `list_analyses`, `get_analysis`, `delete_analysis`, `get_recidivists` — toutes avec le `user_id` du compte connecté et `WHERE user_id = ?` —, `delete_older_than` (purge des 30 jours), `get_user`, `get_user_by_id`, `create_user` (rôle `user` par défaut), `update_username`, `update_password_hash` (mettent `updated_at` à jour), `list_users`, `delete_user` ; ids des comptes et des analyses = UUID créés par `new_id()`).
  - `sentinel/config.py` : seuils, `DB_PATH`, `DB_KEY_FILE` (D22), `MAX_UPLOAD_MB` / `MAX_UPLOAD_BYTES` (50 Mo, D17), `ALLOWED_EXTENSIONS`, `USERNAME_PATTERN`, `MIN_PASSWORD_LENGTH` (12), `MAX_PASSWORD_LENGTH` (128), `LOGIN_MAX_FAILURES`/`LOGIN_WINDOW` (5 en 15 min), `REGISTER_MAX_ATTEMPTS`/`REGISTER_WINDOW` (5 par heure), `SECRET_KEY`, `SESSION_LIFETIME_MINUTES`, `CORS_ORIGINS` (lus dans `.env`, D22), `GEO_CITY_DB` / `GEO_ASN_DB`.
  - `sentinel/limiter.py` : `RateLimiter` (`is_blocked`, `record`, `reset`), compteurs par IP en mémoire (même idée que R2).
  - `sentinel/geo.py` : `GeoLocator` (`locate`) lit les bases DB-IP Lite de `backend/data/` (téléchargées par `scripts/download_geodb.sh`, jamais commitées) ; position calculée à la lecture, jamais stockée (D14).
  - `schema.sql` (dans `backend/`) : création des 4 tables et des 2 rôles.
  - `app.py` : `MemoryRequest` (fichier envoyé gardé en mémoire, jamais de fichier temporaire, D17), 16 routes, `read_db_key` (clé lue dans `DB_KEY_FILE`, hors du dépôt), `open_session` (session permanente + `logged_at`), CORS (flask-cors, `CORS_ORIGINS`), `login_required` (relit le compte à chaque requête dans `g.user` ; refuse une session ouverte avant le dernier `updated_at`), `admin_required` (403), `json_body` (corps JSON qui n'est pas un objet → `{}`, donc 400 et jamais 500), `read_log_text` (UTF-8/BOM/UTF-16), `read_credentials` (refuse un mot de passe de plus de 128 caractères), `username_error`, `password_error`, `password_matches`, `update_account`, `managed_user` (403 si la cible est un admin), convertisseurs `<uuid:…>`, `login_limiter` / `register_limiter` (429), `block_command(ip)`, erreurs JSON 400/401/403/404/405/413/429/500, commande `flask create-admin` (seul moyen de créer un admin), sert `frontend/dist` en production (404 pour un fichier absent, `index.html` pour une route React).
  - `cli.py` : mode terminal, sans base.
- **Base** : SQLite chiffrée par SQLCipher (D22), 4 tables : `roles` (`admin`, `user`), `users` (id UUID, username UNIQUE COLLATE NOCASE, password_hash, FK `role_id`, created_at, updated_at), `analyses` (id UUID, FK `user_id` ON DELETE CASCADE), `suspect_ips` (FK `analysis_id` ON DELETE CASCADE ; `users` en JSON, `rules` séparées par des virgules). Cardinalités : un compte a un seul rôle (users (1,1) — (0,n) roles), une analyse appartient à un compte.
- **API** (JSON, erreurs `{"error": "..."}`) : `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` (id, username, role, created_at, updated_at), `PATCH /api/auth/me` (nom et/ou mot de passe, l'actuel redemandé), `DELETE /api/auth/me` (supprimer son compte, mot de passe redemandé ; refusé à un admin), `POST /api/analyses` (multipart, champ `file`), `GET /api/analyses`, `GET /api/analyses/<id>`, `DELETE /api/analyses/<id>`, `GET /api/recidivists`, `GET /api/users` (admin), `GET`/`PATCH`/`DELETE /api/users/<id>` et `DELETE /api/users/<id>/analyses/<id>` (admin ; seulement un compte `user`, sinon 403 ; analyses réduites à id, date, fichier). Session obligatoire (401) sauf register, login et logout ; analyse d'un autre compte = 404 ; route admin pour un `user` = 403.
- **Front-end** : React + Vite, React Router, Recharts, dans `frontend/`. Pages : LandingPage (présentation publique à `/`, D19 ; sections « Sécurité du site » (6 mesures) et « Vos données (RGPD) »), LoginPage, RegisterPage (`/inscription`, D20), HomePage (espace du compte à `/analyse`, D19), AnalysisPage, ProfilePage (`/compte`, D21), AdminPage (`/comptes`, admin : son compte à part, puis la liste), UserAdminPage (`/comptes/:id`, admin), PrivacyPage (dont « Sécurité des données » (art. 32), « Cookie », réclamation CNIL). Composants : ProtectedRoute, Header, UploadForm, HistoryTable, RecidivistsTable, SummaryCards (verdict + chiffres), TopIpsChart, SuspectsTable, SeverityBadge, CopyButton, et depuis D14 : WorldMap, CountryList, IpDetails, SeverityLegend, BlockCommandHelp (aide sous la commande de blocage), et depuis D20 : UsersTable, DeleteAccountForm (ProfilePage, `user` seulement), AccountPrompt (invite `nom@sentinelssh:~$` / `#`, bouton-lien vers `/compte` dans le Header et la LandingPage ; remplace l'onglet « Mon compte »), AccountInfo (en-tête du profil : invite en grand, rôle, dates), EditableRow (ligne de réglage qui ouvre son formulaire), UsernameForm, PasswordForm, AnalysisRefsTable, LogoutButton (Header, et LandingPage si connecté), LogFileHelp (aide « quel fichier envoyer » : Debian/Ubuntu, Red Hat, journalctl, vérification par `grep`, scp ; serveur Windows non pris en charge). Diagrammes en Mermaid dans `docs/diagrammes.md` (11 diagrammes, copiés en PNG dans `docs/images/` le 29/10) ; référence de l'API dans `docs/api.md`. Fonctions de mise en forme dans `src/format.js`. Thème sombre, polices IBM Plex (npm). Toutes les requêtes dans `src/api.js`. Proxy Vite `/api` → `http://127.0.0.1:5000` en développement.
- **Production** : `npm run build` puis `gunicorn -b 127.0.0.1:8000 app:app`.

## Précisions tirées de la conception

- Gravité : exactement `"moyenne"`, `"elevee"` (sans accent), `"critique"` — ce sont les valeurs du `CHECK` de la table `suspect_ips`.
- `create-admin` et l'inscription refusent un mot de passe de moins de 12 caractères ; nom d'utilisateur : 3 à 30 caractères `[A-Za-z0-9._-]`.
- L'administrateur ne voit ni le mot de passe ni le contenu des analyses d'un user (seulement id, date, fichier) ; il peut renommer, réinitialiser le mot de passe, supprimer le compte ou une analyse. Un compte admin ne se gère jamais par `/api/users` (403) et ne peut pas être supprimé. Un user ne voit que son propre compte.
- `first_seen` / `last_seen` enregistrés avec l'année (`1999-12-31 23:59:40`, D18) ; `format.js` lit aussi l'ancien format sans année.
- Tests : `test_parser.py`, `test_detector.py`, `test_database.py`, `test_api.py`, `test_geo.py`, `test_limiter.py` ; mini-journaux dans `backend/tests/samples/`.
- Checklist de bout en bout : celle du Stage 3 (§6.2, 13 scénarios).
- CI : `.github/workflows/tests.yml`.
- Durée de conservation : 30 jours, appliquée par une requête `DELETE` au démarrage (décision D11, codée au sprint 2).
- NoSQL (référentiel RNCP) : question posée à l'équipe pédagogique ; rien à ajouter tant qu'il n'y a pas de réponse.

## Règles de sécurité (non négociables)

- Requêtes SQL paramétrées uniquement (`?`), jamais de f-string ni de concaténation. Seule exception : `PRAGMA key` (n'accepte pas `?`), la clé n'étant écrite qu'après vérification (64 caractères 0-9 a-f, D22).
- Jamais `dangerouslySetInnerHTML` ; tout affichage passe par le JSX.
- Mots de passe hachés avec Werkzeug ; même message « Identifiants incorrects » si le nom ou le mot de passe est faux.
- Toute requête SQL sur une analyse filtre sur le compte connecté (`user_id`) ; jamais d'accès à l'analyse d'un autre compte.
- Cookie de session HttpOnly + `SESSION_COOKIE_SAMESITE = "Lax"`, durée de vie `SESSION_LIFETIME_MINUTES` ; `SECRET_KEY` jamais dans le code. Pas de JWT (D22).
- Base chiffrée (SQLCipher) ; la clé reste dans un fichier hors du dépôt (`DB_KEY_FILE`), jamais commitée ni dans `.env`.
- Le fichier envoyé n'est jamais écrit sur le disque ; seules les IP suspectes sont stockées (RGPD).

## Conventions

- Branches : `main` (protégée, stable), `develop` (intégration), `feature/…` et `fix/…` créées depuis `develop`. Toute fusion passe par une Pull Request vers `develop`.
- Commits au format Conventional Commits : `feat:`, `fix:`, `test:`, `docs:`, `refactor:`.
- Python : style pycodestyle, docstring pour chaque module, classe et méthode publique.
- JavaScript : ESLint sans erreur, un composant par fichier.
- Tests : pytest dans `backend/tests/` (unitaires + intégration avec le client de test Flask et une base temporaire). Objectif : couverture ≥ 80 % de `sentinel`.

## Pull Requests et fusion (flux superpowers)

**Commits, pushs et PR : c'est moi qui les fais.** Claude ne lance jamais `git commit`, `git push` ni `gh pr create`, même pendant l'exécution d'un plan : à la fin de chaque tâche, il s'arrête, me donne le message de commit (Conventional Commits) et les commandes à taper, et attend que j'aie commité avant la tâche suivante.

Pour chaque PR, Claude me prépare le titre et la description, prêts à coller sur GitHub. La description se termine par une section `# Standup` :
- **Fait** : ce que la branche change, en deux ou trois phrases ;
- **Appris** : ce que le travail a révélé (sur le code, OpenSSH, les outils), y compris les fausses pistes ;
- **Décisions** : les choix faits et leur raison ;
- **Difficultés** : ce qui a bloqué ou coûté du temps ;
- **Suite** : ce qui reste à faire ou à surveiller.

**Revue de code avant chaque PR** : une fois toutes les tâches du plan terminées et les tests verts, faire la revue de toute la branche (`superpowers:requesting-code-review`), puis me donner `/code-review` à taper. Corriger les constats que je valide, relancer les tests, puis me donner les commandes pour commiter et pousser, et le titre et la description de la PR.

**Ne jamais fusionner dans `main`** pour l'instant. Dans `finishing-a-development-branch`, ne jamais choisir l'option qui fusionne en local : à la fin d'une branche, je pousse, j'ouvre la PR sur GitHub et c'est moi qui fusionne.

Ces sections servent à recouper tous les standups en une synthèse d'apprentissage du projet : elles doivent être lisibles seules, sans la conversation.

## Où en est le projet

- Sprint 0 (préparation) : terminé le 12/10 (dépôt, kanban, labels, milestones, 13 issues du sprint 1, venv, `requirements.txt`).
- Replanification du 12/10 (D12) : sprints décalés d'une semaine. Sprint 1 : 12 → 18 oct. ; Sprint 2 : 19 → 25 oct. ; Sprint 3 : 26 oct. → 1er nov. ; Sprint 4 : 2 → 8 nov. ; marge : 9 → 12 nov. ; **demo day le 13 novembre**. Date de la revue avec le SWE à confirmer.
- 25/10 : changement de méthode, Claude produit le code (MR dans moins de 2 semaines) ; Anil commite et pousse lui-même.
- Bloc 1 (moteur d'analyse, PR #19) et bloc 2 (base, API, connexion, CI, PR #20) fusionnés dans `develop` (`ed46c31`).
- Bloc 3 (front React, thème sombre, géolocalisation DB-IP + carte (D14), page de présentation (D15), collection Postman, test Loghub, branche `feature/frontend`) : écrit et testé, voir `docs/testing/test-report.md`.
- 27/10 : nouveau format de date (D16), accueil enrichi, aide de la commande de blocage, couleurs vives, limite d'envoi à 50 Mo et fichier gardé en mémoire (D17), carte accélérée, vérification générale (rapport de tests §8).
- 28/10 (soir) : profils de compte (D21) : `/compte`, `/comptes`, `/comptes/:id`, modification du nom et du mot de passe, UUID, `updated_at` ; 171 tests. Base locale à recréer (schéma changé).
- 28/10 : passage en site multi-comptes (D20) : inscription, rôles admin/user, analyses par compte, page Comptes, suppression de son compte, limitation des tentatives ; revue de code appliquée ; 146 tests ; diagrammes Mermaid, Postman et rapport de tests (§9) à jour. La base locale `backend/sentinel.db` de l'ancien schéma doit être recréée.
- 28/10 (fin de journée) : sécurité (D22) : durée de vie de la session et révocation après changement d'identifiants, CORS par liste blanche, base chiffrée (SQLCipher, clé hors du dépôt) ; 186 tests. Base locale à recréer (chiffrée) et fichier de clé à créer.
- 29/10 : audit complet (D23) : faille d'usurpation d'IP par le nom d'utilisateur corrigée, noms avec espace ou vides lus, fichier vide ou sans log refusé, JSON non-objet → 400, UTF-16 et BOM lus, comptes visés en JSON, 404 pour un fichier du front absent, titre sans UUID, taille vérifiée avant l'envoi, mot de passe actuel redemandé aussi pour renommer son compte ; 221 tests (rapport §12). Base locale à recréer.
- 29/10 (suite) : audit vérifié (55 contrôles dans le navigateur), mot de passe redemandé pour renommer son compte, `create-admin` avec les règles de l'inscription ; collection Postman passée par newman (40 requêtes, 0 échec) ; documentation refaite (README, `docs/api.md`, diagrammes et PNG, écarts dans le plan des sprints). Revue avec le SWE dans 4 jours (vers le 02/11).
- 30/10 : accueil (technologies dans « Sécurité du site », extrait de journal réaliste, nom et GitHub), page Confidentialité (responsable du traitement), aide d'envoi en 3 étapes avec vérification par `grep`, section « Journal analysé » du README (sshd écrit le message, rsyslog le fichier) ; plugins du projet (`.claude/settings.json`) et règles des PR ; 5 commits poussés (`3042689`). Parsers OpenSSH versionnés écartés pour la v1.0 (D24).
- 31/10 : audit complet avant la revue (rapport §13) : 221 tests, couverture 100 %, newman 40/70/0, navigateur 55/55, aucun bug. Revue avec le SWE vers le 02/11.
- Reste : PR `feature/frontend` → `develop` (Anil, sur GitHub), fusion dans `main`, tag v1.0.0, lancement en production ; revues et rétrospectives des sprints (`docs/sprints/`, encore vides).
- **À mettre à jour à chaque début de sprint.**

## Documents de référence

- Plan des sprints : @docs/sprints/sprint-planning.md
- Journal des décisions : @docs/decisions.md
- Documentation détaillée (PDF, à lire seulement si nécessaire) : `docs/stages/SentinelSSH_Stage3_Technical_Documentation.pdf` et `docs/stages/SentinelSSH_Conception_complete.pdf`
