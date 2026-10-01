# Rapport de tests

**Version testée :** v… — **Date :** …

## 1. Tests automatiques

| Suite | Nombre de tests | Résultat | Lien |
|---|---|---|---|
| Unitaires (LogParser, Detector, Database) | | ✅ / ❌ | exécution de la CI : lien |
| Intégration (8 routes de l'API) | | ✅ / ❌ | exécution de la CI : lien |
| Couverture du package `sentinel` | — | … % (objectif ≥ 80 %) | capture ou rapport |
| pycodestyle / ESLint | — | 0 erreur ? | |

## 2. Tests manuels de l'API (Postman)

Collection : `docs/testing/sentinelssh.postman_collection.json`

| Route | Cas testés | Résultat |
|---|---|---|
| POST /api/auth/login | bon mot de passe → 200 ; mauvais → 401 ; champ manquant → 400 | |
| GET /api/analyses (sans session) | → 401 | |
| POST /api/analyses | fichier valide → 201 ; .exe → 400 ; > 5 Mo → 413 | |
| GET /api/analyses/<id> | existant → 200 ; inconnu → 404 | |
| DELETE /api/analyses/<id> | → 204 puis GET → 404 | |
| GET /api/recidivists | après 2 analyses du même fichier → IP présente | |

## 3. Checklist de bout en bout

Environnement : développement / pré-production — Navigateur : …

| # | Scénario | Résultat attendu | Résultat | Date |
|---|---|---|---|---|
| 1 | Ouvrir l'accueil sans être connecté | Redirection vers la connexion | | |
| 2 | Mauvais mot de passe | « Identifiants incorrects » | | |
| 3 | Envoyer demo.log | Les 3 niveaux de gravité apparaissent | | |
| 4 | Fichier .exe / de plus de 5 Mo / vide | Messages clairs / « Aucune IP suspecte » | | |
| 5 | Utilisateur `<script>alert(1)</script>` dans un journal | Affiché comme du texte | | |
| 6 | Bouton « Copier » | « Copié ! » et commande copiée | | |
| 7 | Supprimer une analyse | Disparaît après confirmation | | |
| 8 | Envoyer 2 fois le même fichier | IP dans les récidivistes | | |
| 9 | Recharger la page de détail | Toujours affichée | | |
| 10 | Serveur arrêté puis rechargement | Message d'erreur clair | | |
| 11 | Chaque page en mode mobile | Lisible, sans débordement | | |
| 12 | Déconnexion puis retour arrière | Retour à la connexion | | |
| 13 | /confidentialite sans connexion | La page s'affiche | | |

## 4. Robustesse et performance

| Test | Mesure | Objectif | Résultat |
|---|---|---|---|
| Dataset OpenSSH Loghub complet (cli.py) | temps, plantage ? | 655 146 lignes sans plantage | |
| Fichier de 5 Mo | temps d'analyse | moins de 5 s | |

## 5. Bugs trouvés

| Issue | Gravité | État |
|---|---|---|
| #… | bloquant / majeur / mineur | ouvert / corrigé |
