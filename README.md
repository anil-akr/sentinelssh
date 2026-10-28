# SentinelSSH

**Analyseur de logs SSH — sécurité défensive.** SentinelSSH analyse le journal de connexions SSH d'un serveur Linux
(`auth.log`), repère les adresses IP suspectes, leur attribue une gravité et présente les résultats sur un
site web : chacun crée son compte, envoie son journal et retrouve ses propres analyses.

> Projet de fin d'année — Holberton School Bordeaux (Portfolio Project, Demo Day, titre RNCP niveau 5).
> Auteur : Anil AKER — [github.com/anil-akr](https://github.com/anil-akr)

<!-- À compléter en fin de projet : badge de la CI, capture d'écran de l'application, lien de la vidéo de démonstration -->

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Architecture](#architecture)
3. [Base de données](#base-de-données)
4. [Technologies](#technologies)
5. [Installation (développement)](#installation-développement)
6. [Utilisation](#utilisation)
7. [API](#api)
8. [Tests](#tests)
9. [Déploiement (production)](#déploiement-production)
10. [Sécurité et RGPD](#sécurité-et-rgpd)
11. [Organisation du projet](#organisation-du-projet)
12. [Limites et évolutions](#limites-et-évolutions)

## Fonctionnalités

- **Comptes** : inscription libre (nom + mot de passe, pas d'e-mail), connexion par session ; chaque compte ne voit
  que ses propres analyses. Page **Mon compte** : informations, changement de nom et de mot de passe, ses analyses,
  suppression du compte. Un rôle **administrateur** gère les comptes `user` (nom, réinitialisation du mot de passe,
  suppression du compte ou d'une analyse à sa demande) sans jamais voir leur mot de passe ni le contenu de leurs
  analyses (D20, D21).
- **Analyse d'un fichier** `auth.log` (.log ou .txt, 50 Mo maximum) : lecture des tentatives de connexion SSH.
- **Détection en 3 règles**, une gravité par règle :

  | Règle | Condition | Gravité |
  |---|---|---|
  | R1 — Attaque persistante | au moins 20 échecs dans le fichier | moyenne |
  | R2 — Force brute rapide | au moins 5 échecs en 60 secondes | élevée |
  | R3 — Compromission possible | une connexion réussie après au moins 5 échecs | critique |

- **Résultats** : verdict, chiffres clés, **carte du monde** des IP suspectes, classement des pays d'origine,
  graphique du top 10, légende des gravités et tableau trié par gravité avec une **fiche détaillée par IP**
  (localisation, opérateur du réseau, durée et rythme de l'attaque, règles expliquées).
- **Géolocalisation hors ligne** avec la base DB-IP Lite : aucune IP n'est envoyée à un service extérieur.
- **Commande de blocage** (`iptables`) prête à copier, avec une aide (où la taper, `sudo`, vérifier, annuler) : l'outil propose, l'utilisateur décide.
- **Accueil** : vue d'ensemble chiffrée, **historique** des analyses, suppression, liste des **IP récidivistes** (vues dans plusieurs analyses).
- **Page de présentation** publique (le projet en une page, puis l'inscription ou la connexion), **page Confidentialité**, interface **responsive** (ordinateur et mobile), **mode terminal** de secours (`cli.py`).

## Architecture

Schéma : [docs/diagrammes.md](docs/diagrammes.md#architecture) (diagrammes en Mermaid, affichés par GitHub).

- **Front-end** : React (Vite), 9 pages (présentation à `/`, inscription, connexion et confidentialité publiques ; espace d'analyse `/analyse`, détail d'une analyse, mon compte `/compte`, comptes `/comptes` et profil d'un user `/comptes/<id>` protégés), toutes les requêtes dans `src/api.js`.
- **API** : Flask, 16 routes JSON, session obligatoire sauf pour l'inscription, la connexion et la déconnexion ; 5 routes réservées à l'administrateur ; tentatives de connexion et d'inscription limitées par IP (`RateLimiter`).
- **Cœur d'analyse** : `LogParser` (lecture) et `Detector` (règles), en Python pur, sans dépendance au web ni à la base.
- **Géolocalisation** : `GeoLocator` lit les bases locales DB-IP (`backend/data/*.mmdb`) ; la position est calculée à
  chaque lecture d'une analyse, jamais stockée (décision D14).
- **Données** : `Database` (requêtes SQL paramétrées) et SQLite chiffrée par SQLCipher (4 tables).

[Diagramme de classes](docs/diagrammes.md#classes-du-back-end) · diagrammes de séquence :
[connexion](docs/diagrammes.md#séquence--inscription-et-connexion), [analyse](docs/diagrammes.md#séquence--analyse-dun-fichier),
[consultation](docs/diagrammes.md#séquence--consultation-dune-analyse).

## Base de données

Diagramme et cardinalités : [docs/diagrammes.md](docs/diagrammes.md#base-de-données).

- `users` et `analyses` ont pour clé un **UUID** (texte aléatoire, impossible à deviner) ; `users.updated_at` note le
  dernier changement de nom ou de mot de passe.
- `roles` (`admin`, `user`) 1 → N `users` (clé étrangère `role_id`) : chaque compte a un seul rôle.
- `users` 1 → N `analyses` (clé étrangère `user_id`, suppression en cascade) : chaque analyse appartient à un compte.
- `analyses` 1 → N `suspect_ips` (clé étrangère `analysis_id`, suppression en cascade).
- Supprimer un compte supprime donc ses analyses, puis leurs IP. Le mot de passe n'est jamais stocké, seulement son hachage.
- SQLite désactive les clés étrangères par défaut : `PRAGMA foreign_keys = ON` à chaque connexion.

## Technologies

| Couche | Technologies |
|---|---|
| Front-end | React, Vite, React Router, Recharts, d3-geo + world-atlas (carte), polices IBM Plex |
| Back-end | Python 3, Flask, Werkzeug (hachage), python-dotenv, maxminddb (lecture des bases DB-IP) |
| Base de données | SQLite chiffrée par SQLCipher (module `sqlcipher3`) |
| Production | Gunicorn |
| Qualité | pytest, pytest-cov, pycodestyle, ESLint, GitHub Actions, Postman |

Les justifications de chaque choix sont dans la [documentation technique](docs/stages/SentinelSSH_Stage3_Technical_Documentation.pdf) (§7).

## Installation (développement)

Prérequis : Python 3.10+, Node.js LTS, Git.

```bash
git clone https://github.com/anil-akr/sentinelssh.git
cd sentinelssh

# Back-end (terminal 1)
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env               # puis remplacer SECRET_KEY (voir le fichier)
mkdir -p ~/.config/sentinelssh     # clé de la base, HORS du dépôt (D22)
python3 -c "import secrets; print(secrets.token_hex(32))" > ~/.config/sentinelssh/db.key
chmod 600 ~/.config/sentinelssh/db.key
./scripts/download_geodb.sh        # bases de géolocalisation DB-IP (une fois par mois)
flask --app app create-admin       # premier administrateur, une seule fois
flask --app app run                # API sur http://127.0.0.1:5000

# Front-end (terminal 2)
cd frontend
npm install
npm run dev                        # application sur http://localhost:5173
```

## Utilisation

1. Créer un compte (`/inscription`) ou se connecter.
2. Envoyer un fichier `auth.log`. Deux exemples sont fournis :
   - `demo/demo.log` : 3 IP de documentation (203.0.113.x), une par gravité ; elles n'ont pas de position sur la carte ;
   - `demo/demo-monde.log` : 13 vraies IP d'attaquants tirées du jeu de données public
     [Loghub](https://github.com/logpai/loghub), dans 13 pays (lignes générées pour déclencher les 3 règles).
3. Lire le verdict, la carte et le tableau ; ouvrir la fiche d'une IP ; copier une commande de blocage si besoin.

Fichiers de démonstration de plusieurs tailles, découpés dans le vrai journal public Loghub (non commités, recréés
par un script) :

```bash
./demo/make_demo_files.sh      # crée demo/tailles/
```

| Fichier | Taille | Lignes | Résultat attendu |
|---|---|---|---|
| `1-petit.log` | 0,2 Mo | 2 000 | 9 IP (élevées), 5 pays |
| `2-moyen.log` | 1 Mo | 10 000 | 12 IP (élevées), 6 pays |
| `3-gros.log` | 11 Mo | 100 000 | 61 IP (58 élevées, 3 moyennes), 22 pays, en 0,4 s |
| `4-tres-gros.log` | 45 Mo | 420 000 | 370 IP (2 critiques, 341 élevées, 27 moyennes), 39 pays, en 1,7 s |
| `5-trop-gros.log` | 70 Mo | 655 146 | refusé : « Fichier trop volumineux (50 Mo maximum) » |

Mode terminal, sans interface web :

```bash
cd backend && python cli.py ../demo/demo.log
```

## API

Toutes les routes échangent du JSON. Les erreurs ont la forme `{"error": "message"}`.

| Méthode | URL | Session | Rôle |
|---|---|---|---|
| POST | `/api/auth/register` | non | Inscription (`{username, password}`), crée un compte `user` et ouvre la session |
| POST | `/api/auth/login` | non | Connexion (`{username, password}`) |
| POST | `/api/auth/logout` | non | Déconnexion |
| GET | `/api/auth/me` | oui | Compte connecté et son rôle |
| PATCH | `/api/auth/me` | oui | Changer son nom (`{username}`) et/ou son mot de passe (`{password, current_password}`) |
| DELETE | `/api/auth/me` | oui | Suppression de son compte et de ses analyses (`{password}`) ; refusée pour un admin |
| POST | `/api/analyses` | oui | Envoi d'un fichier (`multipart/form-data`, champ `file`) |
| GET | `/api/analyses` | oui | Historique des analyses du compte |
| GET | `/api/analyses/<id>` | oui | Détail d'une analyse du compte (404 si elle appartient à un autre) |
| DELETE | `/api/analyses/<id>` | oui | Suppression d'une analyse du compte |
| GET | `/api/recidivists` | oui | IP présentes dans au moins 2 analyses du compte |
| GET | `/api/users` | admin | Liste des comptes (nom, rôle, date d'inscription) |
| GET | `/api/users/<id>` | admin | Profil d'un `user` : nom, rôle, dates ; ses analyses réduites à id, date et fichier |
| PATCH | `/api/users/<id>` | admin | Changer le nom et/ou réinitialiser le mot de passe d'un `user` |
| DELETE | `/api/users/<id>` | admin | Suppression d'un compte `user` et de ses analyses |
| DELETE | `/api/users/<id>/analyses/<id>` | admin | Suppression d'une analyse d'un `user`, sans pouvoir la lire |

Les `<id>` des comptes et des analyses sont des UUID. Un compte admin ne se gère jamais par `/api/users/<id>` (`403`) :
il modifie son propre compte par `/api/auth/me`.

Tentatives limitées par IP : 5 échecs de connexion en 15 minutes, 5 inscriptions par heure ; au-delà, `429`.

Entrées et sorties détaillées : documentation technique, §5.

## Tests

```bash
cd backend
pytest --cov=sentinel          # tests unitaires et d'intégration + couverture
pycodestyle sentinel app.py cli.py tests
cd ../frontend && npm run lint
```

- **Unitaires** : `LogParser`, `Detector`, `Database`, `GeoLocator`.
- **Intégration** : les 16 routes avec le client de test Flask et une base temporaire, dont la séparation des comptes
  (un compte reçoit 404 sur l'analyse d'un autre) et les droits de l'administrateur (403 pour un simple compte).
- **Manuels** : collection Postman (`docs/testing/`) et checklist de bout en bout (13 scénarios), rejouée dans un vrai navigateur.
- **Robustesse** : dataset OpenSSH de [Loghub](https://github.com/logpai/loghub) (655 146 lignes).

Résultats : [docs/testing/test-report.md](docs/testing/test-report.md) — 171 tests, couverture de `sentinel` à 100 %,
fichier de 45 Mo analysé en 1,7 s par l'API.

## Déploiement (production)

```bash
cd frontend && npm run build                  # crée frontend/dist
cd ../backend && source venv/bin/activate
flask --app app create-admin                  # si le compte n'existe pas
gunicorn -b 127.0.0.1:8000 app:app            # application complète sur http://127.0.0.1:8000
```

Flask sert le front construit et renvoie `index.html` pour toute adresse hors `/api`. La `SECRET_KEY`, la durée de la session et
les origines CORS sont lues dans `.env` (jamais commité) ; la clé de la base, dans le fichier `DB_KEY_FILE`, hors du dépôt. Pour l'instant, le site écoute seulement en local ; sa mise en ligne (serveur, Nginx,
HTTPS) n'est pas encore prévue.

## Sécurité et RGPD

- Requêtes SQL paramétrées (injection SQL) ; affichage échappé par React, jamais `dangerouslySetInnerHTML` (XSS).
- Mots de passe hachés (Werkzeug), de 12 à 128 caractères (au-delà, refusé avant d'être haché) ; noms uniques sans tenir compte des majuscules ; cookie de session HttpOnly et SameSite=Lax, valable 60 minutes sans requête et refusé dès que le nom ou le mot de passe change (D22) ; même message d'erreur que le nom ou le mot de passe soit faux.
- Chaque requête sur une analyse filtre sur le compte connecté (`WHERE user_id = ?`) : deviner l'id d'une autre analyse renvoie 404.
- Le compte est relu dans la base à chaque requête : un compte supprimé perd l'accès immédiatement. L'inscription crée toujours un `user` ; un administrateur ne se crée qu'avec `flask create-admin`.
- Base chiffrée par SQLCipher : copié seul, le fichier `sentinel.db` est illisible ; la clé est dans un fichier hors du dépôt que seul l'administrateur du serveur détient. Lui perdu, la base l'est aussi.
- CORS : seules les origines de `CORS_ORIGINS` peuvent appeler l'API depuis un autre site.
- Force brute freinée : 5 échecs de connexion en 15 minutes ou 5 inscriptions par heure depuis une IP, puis `429`.
- Fichiers limités à 50 Mo, extension vérifiée, contenu gardé en mémoire et jamais écrit sur le disque (pas de fichier temporaire, voir D17).
- Aucune commande système exécutée : l'application n'a pas besoin des droits root.
- Une adresse IP est une donnée personnelle : seules les IP suspectes sont conservées, une analyse peut être
  supprimée, et la page Confidentialité informe sur les données traitées. Les analyses de plus de 30 jours sont
  supprimées automatiquement au démarrage du site (décision D11). Aucune adresse e-mail n'est demandée ;
  l'administrateur voit les comptes, pas leurs analyses.

## Organisation du projet

- **Branches** : `main` (stable, taguée à chaque fin de sprint), `develop` (intégration), `feature/…` et `fix/…` (une par tâche).
- **Pull Requests** relues avec une checklist, **CI** GitHub Actions à chaque push.
- **Sprints** d'une semaine : [plan des sprints](docs/sprints/sprint-planning.md), revues et rétrospectives dans `docs/sprints/`.
- **Suivi** : GitHub Projects (kanban), issues et milestones ; bugs avec le label `bug`.
- **Décisions** : [journal des décisions](docs/decisions.md).
- **Documents du projet** : `docs/stages/` (Stages 1 à 4, conception complète).

## Limites et évolutions

- Deux formats de date lus : syslog classique (`Oct 12 14:03:21`, sans année : le passage du Nouvel An est repéré quand le mois recule, D18) et ISO 8601 d'Ubuntu 23.10 et plus (`2026-10-25T17:17:03.249675+01:00`)  ; le journal systemd se lit une fois exporté en texte (`journalctl -u ssh -u sshd --no-pager > ssh.log`). Journaux d'OpenSSH pour Windows non pris en charge (autre format).
- Analyse à la demande, pas en temps réel.
- Compteurs de tentatives en mémoire : remis à zéro au redémarrage, un par processus Gunicorn. Avant une mise en ligne :
  HTTPS (`SESSION_COOKIE_SECURE`), et derrière Nginx, lire la vraie IP du visiteur (`ProxyFix`), sinon toutes les
  requêtes semblent venir de Nginx.
- Pas de durée maximale pour un compte inactif : il est gardé jusqu'à sa suppression (par son propriétaire ou par l'admin).
- Géolocalisation approximative (base gratuite) : souvent la ville de l'opérateur, pas l'adresse exacte de l'attaquant.
- Pistes : mise en ligne (HTTPS, Nginx), audit de `sshd_config`, surveillance en temps réel, alertes par e-mail.
