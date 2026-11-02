# API de SentinelSSH

Référence des 16 routes de `backend/app.py`. À jour au 29/10/2026 (D20 à D23).

## Règles communes

- **Format** : les routes reçoivent et renvoient du JSON, sauf l'envoi d'un fichier (`multipart/form-data`).
- **Erreurs** : toujours `{"error": "message en français"}`, même pour une adresse inconnue ou une erreur interne.
- **Session** : un cookie signé par Flask (`session`), HttpOnly, SameSite=Lax. Il vaut 60 minutes sans requête
  (`SESSION_LIFETIME_MINUTES`). Il est refusé si le nom ou le mot de passe du compte a changé depuis son ouverture.
- **Connexion obligatoire** (`401 Connexion requise`) pour toutes les routes sauf `register`, `login` et `logout`.
- **Rôle admin** (`403 Accès réservé à l'administrateur`) pour les routes `/api/users`.
- **Ids** : les comptes et les analyses ont un UUID. Un id qui n'est pas un UUID répond 404, comme un UUID inconnu.
- **Corps JSON** : un corps absent, cassé, ou qui n'est pas un objet (`["a"]`, `"texte"`, `42`, `null`) est traité
  comme `{}`. La route répond alors 400, jamais 500.
- **Limites par adresse IP** (`429 Trop de tentatives : réessayez plus tard`) :
  - `login_limiter` : 5 échecs en 15 minutes. Il compte les mauvais mots de passe de la connexion, et aussi ceux
    redemandés pour modifier ou supprimer son compte.
  - `register_limiter` : 5 tentatives d'inscription par heure, réussies ou non.
- **CORS** : seules les origines listées dans `CORS_ORIGINS` (`.env`) peuvent appeler `/api/*` depuis un autre site.

### Erreurs générales

| Code | Message | Quand |
|---|---|---|
| 400 | `Requête invalide` | requête que Flask ne sait pas lire |
| 401 | `Connexion requise` | pas de session, session expirée ou révoquée, compte supprimé |
| 403 | `Accès réservé à l'administrateur` | route `/api/users` demandée par un `user` |
| 404 | `Ressource introuvable` | adresse inconnue, ou id qui n'est pas un UUID |
| 405 | `Méthode non autorisée` | ex. `PUT /api/auth/me` |
| 413 | `Fichier trop volumineux (50 Mo maximum)` | requête de plus de 50 Mo |
| 500 | `Erreur interne du serveur` | erreur imprévue, sans détail interne |

## Vue d'ensemble

| Méthode | URL | Accès | Rôle |
|---|---|---|---|
| POST | `/api/auth/register` | public | Créer un compte `user` et ouvrir la session |
| POST | `/api/auth/login` | public | Se connecter |
| POST | `/api/auth/logout` | public | Se déconnecter |
| GET | `/api/auth/me` | connecté | Lire son compte |
| PATCH | `/api/auth/me` | connecté | Changer son nom et/ou son mot de passe |
| DELETE | `/api/auth/me` | connecté (`user`) | Supprimer son compte et ses analyses |
| POST | `/api/analyses` | connecté | Envoyer et analyser un journal |
| GET | `/api/analyses` | connecté | Historique de ses analyses |
| GET | `/api/analyses/<id>` | connecté | Détail d'une de ses analyses |
| DELETE | `/api/analyses/<id>` | connecté | Supprimer une de ses analyses |
| GET | `/api/recidivists` | connecté | Ses IP vues dans au moins 2 analyses |
| GET | `/api/users` | admin | Liste des comptes |
| GET | `/api/users/<id>` | admin | Profil d'un `user` |
| PATCH | `/api/users/<id>` | admin | Renommer un `user`, réinitialiser son mot de passe |
| DELETE | `/api/users/<id>` | admin | Supprimer un `user` et ses analyses |
| DELETE | `/api/users/<id>/analyses/<id>` | admin | Supprimer une analyse d'un `user`, sans la lire |

## Comptes

### POST `/api/auth/register`

Corps : `{"username": "alice", "password": "un-long-mot-de-passe"}`. Un champ `role` envoyé est ignoré :
l'inscription crée toujours un `user`.

| Code | Réponse |
|---|---|
| 201 | `{"username": "alice", "role": "user"}`, et la session est ouverte |
| 400 | `Nom d'utilisateur et mot de passe obligatoires` (champ absent, vide, pas du texte, mot de passe de plus de 128 caractères) |
| 400 | `Nom d'utilisateur : 3 à 30 caractères (lettres sans accent, chiffres, point, tiret, tiret bas)` |
| 400 | `Le mot de passe doit contenir de 12 à 128 caractères` |
| 409 | `Ce nom d'utilisateur est déjà pris` (sans tenir compte des majuscules : `Alice` = `alice`) |
| 429 | 6e tentative de l'heure depuis la même IP |

### POST `/api/auth/login`

Corps : `{"username": "alice", "password": "un-long-mot-de-passe"}`.

| Code | Réponse |
|---|---|
| 200 | `{"username": "alice", "role": "user"}`, et la session est ouverte |
| 400 | `Nom d'utilisateur et mot de passe obligatoires` |
| 401 | `Identifiants incorrects` (même message si le nom ou le mot de passe est faux) |
| 429 | après 5 échecs en 15 minutes, même avec le bon mot de passe |

Une connexion réussie remet le compteur d'échecs de l'IP à zéro.

### POST `/api/auth/logout`

Pas de corps. Répond `204` (sans contenu), même sans session.

### GET `/api/auth/me`

| Code | Réponse |
|---|---|
| 200 | `{"id": "UUID", "username": "alice", "role": "user", "created_at": "2026-10-29T10:18:37.055", "updated_at": "…"}` |

### PATCH `/api/auth/me`

Corps : `{"username"?, "password"?, "current_password"}`. Au moins `username` ou `password`. Le mot de passe
actuel est toujours demandé, pour le nom comme pour le mot de passe : une session laissée ouverte ne suffit pas
à changer les identifiants.

| Code | Réponse |
|---|---|
| 200 | le compte mis à jour (même forme que `GET /api/auth/me`). Cette session reste ouverte, les autres sont refusées |
| 400 | `Rien à modifier : username ou password attendu` |
| 400 | règle du nom ou du mot de passe non respectée (mêmes messages que l'inscription) |
| 400 | `Mot de passe actuel incorrect` (compté dans `login_limiter`) |
| 409 | `Ce nom d'utilisateur est déjà pris` |
| 429 | 5 mauvais mots de passe en 15 minutes |

### DELETE `/api/auth/me`

Corps : `{"password": "…"}`. Supprime le compte et, par cascade, ses analyses et leurs IP.

| Code | Réponse |
|---|---|
| 204 | compte supprimé, session fermée |
| 400 | `Un compte administrateur ne peut pas être supprimé` |
| 400 | `Mot de passe incorrect` (compté dans `login_limiter` ; 400 et non 401, qui voudrait dire « pas connecté ») |
| 429 | 5 mauvais mots de passe en 15 minutes |

## Analyses

### POST `/api/analyses`

Corps : `multipart/form-data`, champ `file`. Le fichier est lu en mémoire, jamais écrit sur le disque.

| Code | Réponse |
|---|---|
| 201 | `{"id": "UUID", "filename": "auth.log", "suspect_count": 3, "critical_count": 1}` |
| 400 | `Aucun fichier envoyé` (pas de champ `file`, ou nom vide) |
| 400 | `Nom de fichier trop long (255 caractères maximum)` |
| 400 | `Extension non autorisée : .log ou .txt uniquement` (majuscules acceptées : `.TXT`) |
| 400 | `Le fichier est vide` |
| 400 | `Aucune tentative de connexion SSH dans ce fichier. Est-ce bien le journal auth.log (ou secure) de votre serveur ?` |
| 413 | plus de 50 Mo |

- Encodages lus : UTF-8, UTF-8 avec BOM, UTF-16 (fichier enregistré par PowerShell). Un octet illisible est remplacé,
  il ne fait pas planter l'analyse.
- Dans les deux derniers cas de 400, rien n'est enregistré : un verdict « rien de suspect » sur un mauvais fichier
  donnerait un faux sentiment de sécurité.
- Un journal sans aucune IP suspecte est enregistré (`suspect_count: 0`) : c'est un vrai résultat.

### GET `/api/analyses`

Historique du compte, de la plus récente à la plus ancienne :

```json
[{"id": "UUID", "filename": "auth.log", "created_at": "2026-10-29T10:18:37.055",
  "total_lines": 2000, "suspect_count": 9, "critical_count": 0}]
```

### GET `/api/analyses/<id>`

| Code | Réponse |
|---|---|
| 200 | l'analyse (voir ci-dessous) |
| 404 | `Analyse introuvable` : id inconnu **ou** analyse d'un autre compte (on ne révèle pas qu'elle existe) |

```json
{
  "id": "UUID", "user_id": "UUID", "filename": "auth.log", "created_at": "2026-10-29T10:18:37.055",
  "total_lines": 2000, "ignored_lines": 1200, "suspect_count": 1, "critical_count": 1,
  "suspects": [{
    "ip": "203.0.113.5", "failures": 6, "severity": "critique", "rules": ["R2", "R3"],
    "users": ["root", "admin"], "first_seen": "2000-10-12 14:03:21", "last_seen": "2000-10-12 14:04:02",
    "block_command": "iptables -A INPUT -s 203.0.113.5 -j DROP",
    "geo": {"reserved": true, "country_code": null, "country": null, "city": null,
            "latitude": null, "longitude": null, "asn": null, "as_org": null}
  }]
}
```

- `suspects` est trié par gravité (`critique`, `elevee`, `moyenne`), puis par nombre d'échecs.
- `users` : les 3 comptes les plus visés par les échecs de cette IP. Un nom peut être vide ou contenir des espaces.
- `first_seen` / `last_seen` : heures du journal. Dans l'ancien format sans année, l'année vaut 2000 (ou 1999 avant
  un Nouvel An, D18).
- `block_command` : `iptables` (ou `ip6tables` pour une IPv6) seulement pour `elevee` et `critique`, sinon `null`.
  Elle est calculée à la lecture, jamais stockée ni exécutée (D13).
- `geo` : calculé à la lecture avec la base DB-IP locale, jamais stocké (D14). `null` si la base n'est pas
  installée. `reserved: true` pour une IP privée ou de documentation, qui n'a pas de position.

### DELETE `/api/analyses/<id>`

`204`, ou `404 Analyse introuvable` (inconnue ou à un autre compte). Ses IP sont supprimées par cascade.

### GET `/api/recidivists`

IP du compte présentes dans au moins 2 analyses, triées par nombre d'analyses puis par total d'échecs :

```json
[{"ip": "203.0.113.5", "analyses_count": 3, "total_failures": 75}]
```

## Gestion des comptes (administrateur)

Un compte admin (y compris le sien) ne se gère jamais par ces routes : `403 Un compte administrateur ne peut pas
être géré ici`. L'admin modifie son propre compte par `PATCH /api/auth/me`. Un UUID inconnu répond
`404 Compte introuvable`.

### GET `/api/users`

Tous les comptes, du plus ancien au plus récent, sans mot de passe ni analyses :

```json
[{"id": "UUID", "username": "admin", "role": "admin", "created_at": "…", "updated_at": "…"}]
```

### GET `/api/users/<id>`

Profil d'un `user`. Ses analyses sont réduites à l'id, au nom du fichier et à la date : de quoi en supprimer une à
sa demande, sans jamais lire son contenu.

```json
{"id": "UUID", "username": "alice", "role": "user", "created_at": "…", "updated_at": "…",
 "analyses": [{"id": "UUID", "filename": "auth.log", "created_at": "…"}]}
```

### PATCH `/api/users/<id>`

Corps : `{"username"?, "password"?}`. Le mot de passe actuel n'est pas demandé : l'admin ne le connaît pas.
Toutes les sessions ouvertes du `user` sont ensuite refusées.

| Code | Réponse |
|---|---|
| 200 | le compte mis à jour |
| 400 | `Rien à modifier…`, ou règle du nom ou du mot de passe non respectée |
| 409 | `Ce nom d'utilisateur est déjà pris` |

### DELETE `/api/users/<id>`

`204`. Supprime le compte, ses analyses et leurs IP (cascade).

### DELETE `/api/users/<id>/analyses/<id>`

`204`, ou `404 Analyse introuvable` si l'analyse n'appartient pas à ce compte.

## Hors API

- `GET /` et toute autre adresse hors `/api` : Flask sert le front construit (`frontend/dist`). Un fichier qui existe
  est renvoyé, une route de React reçoit `index.html`, un fichier absent (ex. `/assets/absent.js`) répond 404.
- `flask --app app create-admin` : seul moyen de créer un administrateur, avec les mêmes règles que l'inscription.

## Essayer l'API

La collection Postman `docs/testing/sentinelssh.postman_collection.json` rejoue toutes les routes, avec leurs cas
d'erreur.
