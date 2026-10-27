# Rapport de tests

**Version testée :** `develop` (commit `ed46c31`) + front React de la branche `feature/frontend` — **Dates :** 26 et 27/10/2026

## 1. Tests automatiques

Commandes : `pytest --cov=sentinel` (dans `backend/`), `pycodestyle sentinel app.py cli.py tests`, `npm run lint` (dans `frontend/`).

| Suite | Nombre de tests | Résultat | Lien |
|---|---|---|---|
| Unitaires (LogParser 17, Detector 23, Database 13, GeoLocator 8) | 61 | ✅ | `backend/tests/test_parser.py`, `test_detector.py`, `test_database.py`, `test_geo.py` |
| Intégration (8 routes de l'API, dont fichier jamais écrit sur le disque et id trop grand) | 32 | ✅ | `backend/tests/test_api.py` |
| Couverture du package `sentinel` | — | ✅ 100 % (objectif ≥ 80 %) | 235 instructions, 0 manquée (93 tests au total) |
| pycodestyle / ESLint | — | ✅ 0 erreur | |

Les mêmes vérifications tournent dans la CI (`.github/workflows/tests.yml`) : un job `backend` et un job `frontend` (lint + construction).

## 2. Tests manuels de l'API (Postman)

Collection : `docs/testing/sentinelssh.postman_collection.json` (21 requêtes, 36 vérifications automatiques).
Exécutée le 27/10/2026 avec newman (Postman en ligne de commande) sur une base temporaire : **21 requêtes, 36 vérifications, 0 échec**.

Pour la rejouer dans Postman : importer le fichier, mettre le mot de passe administrateur dans la variable `password`, lancer Flask, puis « Run collection ». Les requêtes d'envoi demandent de choisir le fichier dans l'onglet Body (`demo/demo.log`, un petit `.exe`, un fichier de plus de 50 Mo, D17).

| Route | Cas testés | Résultat |
|---|---|---|
| POST /api/auth/login | bon mot de passe → 200 + cookie ; mauvais → 401 ; compte inconnu → 401 (même message) ; champ manquant → 400 | ✅ |
| GET /api/auth/me | sans session → 401 ; connecté → 200 ; après déconnexion → 401 | ✅ |
| POST /api/auth/logout | → 204 | ✅ |
| GET /api/analyses (sans session) | → 401 | ✅ |
| POST /api/analyses | fichier valide → 201 ; sans fichier → 400 ; .exe → 400 ; > 5 Mo → 413 (limite passée à 50 Mo le 27/10, D17) | ✅ |
| GET /api/analyses/<id> | existant → 200, 3 gravités, commande seulement pour élevée et critique (D13) ; inconnu → 404 | ✅ |
| DELETE /api/analyses/<id> | → 204 puis GET → 404 | ✅ |
| GET /api/recidivists | après 2 analyses du même fichier → IP présentes | ✅ |

## 3. Checklist de bout en bout

Environnement : pré-production (front construit avec `npm run build`, servi par Gunicorn, base temporaire) et développement (Vite + Flask) pour le scénario 10.
Navigateur : Chromium (sans interface) piloté par Playwright. Firefox et Safari non testés.

| # | Scénario | Résultat attendu | Résultat | Date |
|---|---|---|---|---|
| 1 | Ouvrir l'accueil sans être connecté | Redirection vers la connexion | ✅ redirigé vers `/login` | 26/10 |
| 2 | Mauvais mot de passe | « Identifiants incorrects » | ✅ même message pour un mauvais mot de passe et un compte inconnu | 26/10 |
| 3 | Envoyer demo.log | Les 3 niveaux de gravité apparaissent | ✅ résumé 37 / 2 / 3 / 1 ; badges Critique, Élevée, Moyenne ; graphique à 3 barres | 26/10 |
| 4 | Fichier .exe / de plus de 5 Mo (50 Mo depuis D17, voir §8) / vide | Messages clairs / « Aucune IP suspecte » | ✅ « Extension non autorisée : .log ou .txt uniquement » ; « Fichier trop volumineux (5 Mo maximum) » ; fichier vide → « Aucune IP suspecte dans ce fichier. » | 26/10 |
| 5 | Utilisateur `<script>alert(1)</script>` dans un journal | Affiché comme du texte | ✅ affiché en texte, aucune alerte (testé aussi avec `<img onerror>` et `<b>`) | 26/10 |
| 6 | Bouton « Copier » | « Copié ! » et commande copiée | ✅ presse-papiers = `iptables -A INPUT -s 203.0.113.20 -j DROP` | 26/10 |
| 7 | Supprimer une analyse | Disparaît après confirmation | ✅ « Annuler » la garde, « OK » la supprime (vérifié aussi par l'API) | 26/10 |
| 8 | Envoyer 2 fois le même fichier | IP dans les récidivistes | ✅ 3 IP récidivistes affichées à l'accueil | 26/10 |
| 9 | Recharger la page de détail | Toujours affichée | ✅ | 26/10 |
| 10 | Serveur arrêté puis rechargement | Message d'erreur clair | ✅ après correction (voir § 5) : « Impossible de joindre le serveur. L'API est-elle lancée ? » | 26/10 |
| 11 | Chaque page en mode mobile | Lisible, sans débordement | ✅ à 375 px : aucun débordement horizontal (connexion, accueil, détail, confidentialité) | 26/10 |
| 12 | Déconnexion puis retour arrière | Retour à la connexion | ✅ Retour → `/login` ; `/api/auth/me` répond 401 | 26/10 |
| 13 | /confidentialite sans connexion | La page s'affiche | ✅ page publique, durée de 30 jours affichée | 26/10 |

Après la refonte visuelle du 27/10 (polices IBM Plex, bandeau de verdict, couleurs par gravité), les scénarios 1 à 9, 11 et 13 ont été rejoués sur la nouvelle version, plus la déconnexion : tous ✅, aucune erreur JavaScript, aucun débordement à 375 px. Les scénarios 10 et 12 n'ont pas été rejoués : leur code (`api.js`, logique de déconnexion) n'a pas changé.

Après le thème sombre et la géolocalisation du 27/10 (décision D14), tous les scénarios ont été rejoués, plus 4 nouveaux, tous ✅ :
- **Carte** : `demo/demo-monde.log` → 13 points sur la carte, onde animée sur les 2 IP critiques, pays d'origine coloriés selon leur gravité la plus haute, 13 pays classés (barres de la couleur de la gravité) ;
- **Fiche IP** : la plus grave est ouverte au départ (Guangzhou, Chine ; opérateur Chinanet, AS4134 ; 11,4 échecs par minute) ; « Détails » ouvre une autre IP, « Masquer » la ferme ;
- **IP de documentation** (`demo.log`) : « Adresse réservée », aucune erreur, message sous la carte ;
- **Légende** : les 3 niveaux affichés avec leur règle, la réaction conseillée et « Pourquoi ce seuil ? ».

Aucune erreur JavaScript ; aucun débordement horizontal à 390 px (sur téléphone, le tableau cache les colonnes Origine, Règles et Comptes visés, visibles dans la fiche).

Scénarios ajoutés en plus de la checklist, tous ✅ : connexion au clavier (Tab, Entrée) ; formulaire vide non envoyé ; « Analyser » sans fichier → « Choisissez un fichier. » ; adresse inconnue → accueil ; `/analyses/999` → « Analyse introuvable » ; historique toujours présent après redémarrage du serveur.

Remarque sur le scénario 10 en production : comme Gunicorn sert aussi le front, un rechargement complet avec le serveur arrêté affiche la page d'erreur du navigateur (`ERR_CONNECTION_REFUSED`). C'est normal : aucune application ne peut s'afficher si son serveur est éteint. Le message clair s'affiche quand l'application est déjà chargée.

## 4. Robustesse et performance

| Test | Mesure | Objectif | Résultat |
|---|---|---|---|
| Échantillon Loghub OpenSSH (2 000 lignes, `cli.py`) | résultat | pas de plantage | ✅ 0,01 s ; 9 IP suspectes (gravité élevée) |
| Dataset OpenSSH Loghub complet (71 Mo, `cli.py`) | temps, plantage ? | 655 146 lignes sans plantage | ✅ 2,3 à 2,4 s sur 3 essais, 245 Mo de mémoire ; 467 IP suspectes (3 critiques, 434 élevées, 30 moyennes) |
| Fichier de 5 Mo (journal généré, 54 145 lignes, `cli.py`) | temps d'analyse | moins de 5 s | ✅ 0,32 à 0,35 s sur 3 essais |
| Limite à 50 Mo (D17) : 45 Mo de Loghub envoyés à l'API (Gunicorn), puis 51 Mo | 201 / 413 | analyse en moins de 5 s ; refus clair | ✅ 201 en 1,74 s (371 IP suspectes) ; 413 « Fichier trop volumineux (50 Mo maximum) » en 0,002 s. Moteur seul sur 50 Mo : 1,7 s, environ 160 Mo de mémoire au maximum |

Le programme compte 655 147 lignes au lieu de 655 146 : la dernière ligne du fichier ne finit pas par un retour à la ligne, donc `wc -l` ne la compte pas, alors que `splitlines()` la compte.

Limite connue : Flask mesure la taille de **toute** la requête (fichier + quelques centaines d'octets d'enveloppe). Un fichier à moins de 200 octets près de la limite (5 Mo, puis 50 Mo depuis D17) est donc refusé avec le message « Fichier trop volumineux ». Sans gêne réelle, non corrigé.

## 5. Bugs trouvés

| Issue | Gravité | État |
|---|---|---|
| Serveur Flask arrêté en développement : le front affichait « Erreur du serveur (code 502) » au lieu d'un message clair (le proxy de Vite répond 502 à la place de Flask) | mineur | corrigé : `frontend/src/api.js` traite 502, 503 et 504 comme « serveur injoignable » ; scénario 10 retesté ✅ |
| Fichier envoyé de plus de 500 Ko écrit par Werkzeug dans un fichier temporaire sur le disque, contrairement à la règle RGPD « jamais écrit sur le disque » (trouvé en vérifiant la limite de 50 Mo) | majeur (RGPD) | corrigé : `MemoryRequest` dans `backend/app.py` garde toujours le fichier en mémoire (D17) ; test `test_upload_is_never_written_to_disk` |
| `GET` ou `DELETE /api/analyses/99999999999999999999` : erreur 500 (`OverflowError`, entier trop grand pour SQLite) au lieu de 404 | mineur | corrigé : `SQLITE_MAX_INT` dans `backend/sentinel/database.py` ; test `test_huge_id_returns_404` (GET et DELETE) |
| Téléchargement des bases DB-IP interrompu : la base existante était remplacée par un fichier tronqué, et l'application ne démarrait plus (`InvalidDatabaseError`) | majeur (démo) | corrigé : `scripts/download_geodb.sh` écrit dans un `.tmp` puis le renomme seulement si tout a réussi ; échec simulé (fausse adresse) : ancienne base intacte |
| Analyse de 45 Mo (371 IP) : page de détail affichée en 6,5 s, car la carte testait chaque IP contre les 241 pays avec `geoContains` (4,7 s de calcul) | moyen (lenteur) | corrigé : rectangle englobant de chaque pays (`geoBounds`) testé d'abord dans `WorldMap.jsx` ; 0,16 s, mêmes résultats ; page affichée en 0,85 s |

## 6. Revue de qualité du code (26/10/2026)

Relecture de tout le code (back et front) pour chercher de la duplication, du code mort ou des fonctions trop complexes.

**Verdict : mineur.** Le code est propre ; trois petites améliorations possibles, volontairement **non appliquées** avant la revue technique (le code est testé à 100 % et chaque changement serait un risque sans bénéfice pour l'utilisateur).

| # | Constat | Où | Décision |
|---|---|---|---|
| 1 | Le nombre d'IP critiques est calculé à deux endroits | `backend/app.py` (envoi) et `backend/sentinel/database.py` (`save_analysis`) | gardé tel quel |
| 2 | `get_db()` est appelé deux fois au démarrage (création des tables, puis suppression des analyses de plus de 30 jours) | `backend/app.py` | gardé tel quel : deux lignes lisibles, coût négligeable |
| 3 | La constante `SAMPLES` (dossier des mini-journaux) est répétée dans trois fichiers de tests | `backend/tests/` | gardé tel quel : chaque fichier de tests reste lisible seul |

`SuspectIP.to_dict()` est conservé car il figure dans le diagramme de classes de la conception.

## 7. Vérification finale (27/10/2026)

Faite après la carte interactive (zoom, déplacement, infobulle des IP), la durée des attaques et la passe de lisibilité du front (boucles `for` explicites à la place de `reduce`, plus de `?.` ni de `??`, fonctions communes `worstSeverity` et `totalFailures` dans `format.js`, commentaires sur les lignes délicates).

| Vérification | Résultat |
|---|---|
| pytest (85 tests) + couverture de `sentinel` | ✅ 85 réussis, 100 % |
| pycodestyle / ESLint | ✅ 0 erreur |
| `npm run build` | ✅ sans avertissement (seuil relevé à 1,6 Mo dans `vite.config.js` : les contours des pays sont inclus pour une carte hors ligne) |
| `npm audit` / `pip check` | ✅ 0 vulnérabilité / dépendances cohérentes |
| Fonctions de `format.js` (17 cas, dont 29 février, passage de minuit, jour à un chiffre) | ✅ 17/17 |
| `cli.py` sur `demo-monde.log`, l'échantillon Loghub et le Loghub complet | ✅ 2 critiques, 8 élevées, 3 moyennes, 252 échecs ; 9 IP ; 655 147 lignes en 2,31 s, 467 IP |
| Postman (newman) sur une base temporaire | ✅ 21 requêtes, 36 vérifications, 0 échec |
| Navigateur : checklist + carte, fiche IP, légende, durée (21 scénarios) | ✅ 21/21, aucune erreur JavaScript |
| Navigateur : zoom (boutons, molette, double-clic), déplacement, infobulle zoomée, recentrage (10 scénarios) | ✅ 10/10 ; la page ne défile pas pendant le zoom à la molette |
| Débordement horizontal à 320, 375 et 390 px (connexion, confidentialité, accueil, 4 analyses dont vide et XSS) | ✅ 21/21 pages, 0 px |
| Page de présentation (D15) : redirection d'un visiteur non connecté, liens vers la connexion et retour, ancre « Comment ça marche », 3 étapes et 3 gravités, logo du bandeau et de la connexion vers la présentation, bouton « Analyser un journal » si connecté, aucun débordement à 1366, 375 et 320 px | ✅ 17/17 ; régression rejouée (21/21, scénario 1 : redirection vers `/presentation`) |
| Nouveau format de date (D16) : 5 tests ajoutés (lignes Failed et Accepted, date abîmée, fichier mélangeant les deux formats, R2 à cheval sur le Nouvel An avec `samples/iso.log`) | ✅ 90 tests, 100 % ; pycodestyle 0 erreur ; `cli.py tests/samples/iso.log` : 1 IP, R2, élevée |
| Accueil enrichi : vue d'ensemble (4 chiffres), aide « Où trouver le fichier auth.log ? », légende des gravités dans la colonne de droite, fin trait rouge sur la case « alertes critiques » s'il y en a | ✅ ESLint 0, build OK ; régression 21/21, présentation 17/17, débordement 21/21 pages (320, 375, 390 px) |
| Aide sous la commande de blocage (`BlockCommandHelp`) : où la taper, `sudo`, explication mot par mot, vérifier (`-L`), annuler (`-D`), règle perdue au redémarrage | ✅ commandes affichées justes pour 203.0.113.20 ; 0 px de débordement à 1366 et 375 px ; régression 21/21 |

## 8. Vérification générale (27/10/2026, après D16 et D17)

Tout le projet revu (code, documentation, configuration) puis retesté, après le nouveau format de date, l'accueil enrichi, les couleurs, la limite de 50 Mo et les 4 corrections de la section 5.

| Vérification | Résultat |
|---|---|
| Installation sur une machine neuve (copie des seuls fichiers du dépôt, `pip install`, `npm ci`), puis les étapes de la CI | ✅ pycodestyle 0 erreur ; 93 tests réussis, couverture 100 % ; ESLint 0 erreur ; build OK |
| pytest (93 tests) + couverture de `sentinel` | ✅ 93 réussis, 100 % (235 instructions) |
| Première installation : `SECRET_KEY` absente ; `create-admin` avec mot de passe court, bon mot de passe, compte en double | ✅ refus clair au démarrage ; refus (12 caractères minimum) ; compte créé, hachage `scrypt` ; « Ce compte existe déjà » |
| Purge des 30 jours (D11) : une analyse de 31 jours et une de 29 jours, puis redémarrage | ✅ la première est supprimée avec ses IP (cascade), la seconde est gardée |
| Production (Gunicorn + front construit) **sans** bases de géolocalisation | ✅ présentation, connexion, envoi de `demo-monde.log`, verdict, tableau ; carte : « 13 IP non placées… base de géolocalisation non installée » ; aucune erreur JavaScript |
| Sécurité de l'API à la main (`curl`) : traversée de chemin (`../backend/.env`, encodée, via `assets/`), route inconnue, sans session, JSON cassé, mauvais types, injection SQL au login, id négatif, texte ou trop grand, méthode PUT, champ manquant, `.log.exe`, nom de fichier piégé, suppression inconnue, après déconnexion | ✅ aucune fuite de fichier (la page React est renvoyée) ; 400/401/404/405 en JSON ; même message « Identifiants incorrects » ; cookie `HttpOnly; SameSite=Lax` ; id trop grand : 500 → corrigé en 404 |
| Limite de 50 Mo (D17) : envoi de 45 Mo puis de 51 Mo à l'API | ✅ 201 en 1,74 s ; 413 « Fichier trop volumineux (50 Mo maximum) » |
| Postman (newman), base temporaire, fichier de plus de 50 Mo pour le 413 | ✅ 21 requêtes, 36 vérifications, 0 échec |
| Navigateur : régression (21), zoom (10), débordement à 320/375/390 px (21 pages), présentation (17), accueil, aide de la commande | ✅ 21/21, 10/10, 21/21, 17/17 ; 0 px de débordement ; aucune erreur JavaScript |
| Navigateur : analyse de 45 Mo (372 lignes, 373 points sur la carte) | ✅ 0,85 s (6,5 s avant la correction de la carte) ; fiche IP OK ; aucune erreur |
| `cli.py` : `demo.log`, `demo-monde.log`, `iso.log`, `clean.log`, sans argument, fichier absent, Loghub complet | ✅ 3, 13 (2 critiques, 8 élevées, 3 moyennes), 1 et 0 IP ; codes de sortie 1 avec message ; 655 147 lignes en 2,3 s, 245 Mo |
| `format.js` (17 cas) / `npm audit` / `pip check` | ✅ 17/17 / 0 vulnérabilité / dépendances cohérentes |
| Code : `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `console.log`, SQL construit par f-string ou concaténation, `debug=True`, TODO | ✅ aucun |
| Historique Git : `.env`, `.db`, `.mmdb`, `node_modules`, clé secrète | ✅ jamais commités |
| Fichiers de démo de plusieurs tailles (`demo/make_demo_files.sh`, découpés dans Loghub) envoyés à l'API | ✅ 0,2 Mo : 9 IP en 0,02 s ; 1 Mo : 12 IP en 0,05 s ; 11 Mo : 61 IP en 0,43 s ; 45 Mo : 370 IP (2 critiques) en 1,72 s ; 70 Mo : 413 en 0,001 s |
