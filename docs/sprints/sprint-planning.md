# Plan des sprints

Sprints d'une semaine, du lundi au dimanche. Points : 1 = petite tâche, 2 = moyenne, 3 = difficile, 5 = très grosse. Les tâches « Could » ne comptent pas dans les points prévus.

Rôles (projet individuel, Anil AKER) : PM = chef de projet, SCM = gestion du code source, QA = qualité, Dev = développement.

## Vue d'ensemble

| Sprint | Dates | Objectif | Points prévus | Jalon |
|---|---|---|---|---|
| Sprint 0 — Préparation | 2 → 4 oct. 2026 | Le dépôt, les outils de suivi et l'environnement de travail sont prêts. | — | J3 — 04/10 |
| Sprint 1 — Moteur d'analyse | lun. 5 → dim. 11 oct. | Le moteur d'analyse repère les 3 types d'attaques sur des fichiers d'essai et s'utilise en ligne de commande. | 26 | J4 — 11/10 |
| Sprint 2 — Base de données, API et connexion | lun. 12 → dim. 18 oct. | Les résultats sont enregistrés et accessibles par l'API ; seul l'administrateur connecté y a accès. | 29 | J5 — 18/10 |
| Sprint 3 — Interface React | lun. 19 → dim. 25 oct. | L'application complète fonctionne dans le navigateur, sur ordinateur et sur téléphone. | 25 | J6 — 25/10 |
| Sprint 4 — Intégration finale, QA et mise en service | lun. 26 oct. → dim. 1er nov. | La version 1.0 est stable, testée, documentée et lancée en production. | 22 | J7 — 01/11 |

## Sprint 0 — Préparation (2 → 4 oct. 2026)

**Objectif :** Le dépôt, les outils de suivi et l'environnement de travail sont prêts.  
**Incrément :** Dépôt GitHub public avec main et develop, kanban, labels, milestones, modèles d'issue et de PR

| ID | Tâche | US | Priorité | Pts | Dépend de | Échéance | Rôle |
|---|---|---|---|---|---|---|---|
| T0.1 | Créer le dépôt public sentinelssh, les branches main et develop, protéger main | — | Must | 1 | — | ven. 2/10 | SCM |
| T0.2 | Configurer GitHub Projects (kanban), les labels, les milestones Sprint 1 à 4, les modèles d'issue et de PR | — | Must | 1 | T0.1 | sam. 3/10 | PM, SCM |
| T0.3 | Créer les issues du sprint 1 à partir de ce plan | — | Must | 1 | T0.2 | sam. 3/10 | PM |
| T0.4 | Environnement : venv Python, Node.js LTS, structure des dossiers, .gitignore, README initial | — | Must | 1 | T0.1 | dim. 4/10 | Dev |

## Sprint 1 — Moteur d'analyse (lun. 5 → dim. 11 oct.)

**Objectif :** Le moteur d'analyse repère les 3 types d'attaques sur des fichiers d'essai et s'utilise en ligne de commande.  
**Incrément :** LogParser, Detector, cli.py et leurs tests unitaires ; tag v0.1.0

| ID | Tâche | US | Priorité | Pts | Dépend de | Échéance | Rôle |
|---|---|---|---|---|---|---|---|
| T1.1 | config.py et models.py (dataclasses Event et SuspectIP) | US1 | Must | 2 | T0.4 | lun. 5/10 | Dev |
| T1.2 | LogParser.parse_line : lignes Failed et Accepted, « invalid user », IPv6, date (année 2000) | US1 | Must | 3 | T1.1 | mar. 6/10 | Dev |
| T1.3 | LogParser.parse_text : compteurs de lignes lues et ignorées | US1 | Must | 1 | T1.2 | mar. 6/10 | Dev |
| T1.4 | Mini-journaux d'essai (tests/samples) et demo.log | US2, US3 | Must | 2 | — | mar. 6/10 | QA |
| T1.5 | Tests unitaires de LogParser | US1 | Must | 2 | T1.2, T1.4 | mer. 7/10 | QA |
| T1.6 | Detector : règle R1 (attaque persistante) | US2 | Must | 2 | T1.1 | mer. 7/10 | Dev |
| T1.7 | Detector : règle R2 (force brute rapide, fenêtre de 60 s) | US2 | Must | 3 | T1.6 | jeu. 8/10 | Dev |
| T1.8 | Detector : règle R3 (compromission possible) | US3 | Must | 3 | T1.6 | ven. 9/10 | Dev |
| T1.9 | Detector : gravité, tri, comptes les plus visés | US2 | Must | 2 | T1.7, T1.8 | ven. 9/10 | Dev |
| T1.10 | Tests unitaires de Detector | US2, US3 | Must | 3 | T1.9 | sam. 10/10 | QA |
| T1.11 | cli.py : analyse d'un fichier et tableau texte | US1 | Must | 2 | T1.3, T1.9 | sam. 10/10 | Dev |
| T1.12 | Essai sur l'échantillon Loghub (2 000 lignes) | — | Should | 1 | T1.11 | dim. 11/10 | QA |
| T1.13 | Tutoriel React officiel, environ 1 h par jour (préparation du sprint 3) | — | Should | — | — | en continu | Dev |

## Sprint 2 — Base de données, API et connexion (lun. 12 → dim. 18 oct.)

**Objectif :** Les résultats sont enregistrés et accessibles par l'API ; seul l'administrateur connecté y a accès.  
**Incrément :** Database, les 8 routes de l'API, la connexion, les tests d'intégration et la CI ; tag v0.2.0

| ID | Tâche | US | Priorité | Pts | Dépend de | Échéance | Rôle |
|---|---|---|---|---|---|---|---|
| T2.1 | schema.sql : 3 tables, clés, contraintes | US5 | Must | 2 | — | lun. 12/10 | Dev |
| T2.2 | Database : connect (clés étrangères) et init_db | US5 | Must | 1 | T2.1 | lun. 12/10 | Dev |
| T2.3 | Database : enregistrer, lister, lire et supprimer une analyse | US5, US8 | Must | 3 | T2.2 | mar. 13/10 | Dev |
| T2.4 | Database : récidivistes, lecture et création du compte | US7, US0 | Must | 2 | T2.2 | mar. 13/10 | Dev |
| T2.5 | Tests unitaires de Database (cascade, récidivistes) | US5, US7 | Must | 2 | T2.3, T2.4 | mer. 14/10 | QA |
| T2.6 | app.py : configuration, .env, taille maximale, erreurs en JSON | US1 | Must | 2 | — | mer. 14/10 | Dev |
| T2.7 | Connexion : login, logout, me, login_required, commande create-admin | US0 | Must | 3 | T2.4, T2.6 | jeu. 15/10 | Dev |
| T2.8 | Routes des analyses : envoi et vérifications, liste, détail, suppression | US1, US5, US8 | Must | 5 | T2.3, T2.7 | ven. 16/10 | Dev |
| T2.9 | Route des récidivistes et commande de blocage | US4, US7 | Must | 1 | T2.8 | ven. 16/10 | Dev |
| T2.10 | Tests d'intégration de l'API (test_api.py) | US0, US1 | Must | 3 | T2.9 | sam. 17/10 | QA |
| T2.11 | Collection Postman des 8 routes | — | Should | 1 | T2.9 | sam. 17/10 | QA |
| T2.12 | CI GitHub Actions : pycodestyle, pytest, couverture | — | Must | 2 | T2.5 | dim. 18/10 | SCM |
| T2.13 | Création du projet Vite et premier appel à l'API | US5 | Should | 2 | T2.8 | dim. 18/10 | Dev |

## Sprint 3 — Interface React (lun. 19 → dim. 25 oct.)

**Objectif :** L'application complète fonctionne dans le navigateur, sur ordinateur et sur téléphone.  
**Incrément :** Les 4 pages et les 10 composants, ESLint et construction du front dans la CI ; tag v0.3.0

| ID | Tâche | US | Priorité | Pts | Dépend de | Échéance | Rôle |
|---|---|---|---|---|---|---|---|
| T3.1 | App.jsx (routes) et api.js (appels, gestion du 401) | US0 | Must | 3 | T2.13 | lun. 19/10 | Dev |
| T3.2 | LoginPage, ProtectedRoute et Header | US0 | Must | 3 | T3.1 | mar. 20/10 | Dev |
| T3.3 | UploadForm | US1 | Must | 2 | T3.1 | mar. 20/10 | Dev |
| T3.4 | HistoryTable avec suppression | US5, US8 | Must | 2 | T3.1 | mer. 21/10 | Dev |
| T3.5 | AnalysisPage et SummaryCards | US2 | Must | 2 | T3.1 | mer. 21/10 | Dev |
| T3.6 | SuspectsTable, SeverityBadge et CopyButton | US2, US3, US4 | Must | 3 | T3.5 | jeu. 22/10 | Dev |
| T3.7 | RecidivistsTable | US7 | Should | 1 | T3.4 | jeu. 22/10 | Dev |
| T3.8 | TopIpsChart (Recharts) | US6 | Should | 2 | T3.5 | ven. 23/10 | Dev |
| T3.9 | PrivacyPage | US10 | Should | 1 | — | ven. 23/10 | Dev |
| T3.10 | CSS responsive et accessibilité | US9 | Should | 3 | T3.6 | sam. 24/10 | Dev |
| T3.11 | ESLint et construction du front dans la CI | — | Must | 1 | T2.12 | sam. 24/10 | SCM |
| T3.12 | Premier passage complet de la checklist de bout en bout | Toutes | Must | 2 | T3.10 | dim. 25/10 | QA |

## Sprint 4 — Intégration finale, QA et mise en service (lun. 26 oct. → dim. 1er nov.)

**Objectif :** La version 1.0 est stable, testée, documentée et lancée en production.  
**Incrément :** Version finale v1.0.0, README complet, preuves de tests, environnement de production

| ID | Tâche | US | Priorité | Pts | Dépend de | Échéance | Rôle |
|---|---|---|---|---|---|---|---|
| T4.1 | Flask sert le front construit (dist) et renvoie index.html hors /api | — | Must | 2 | T3.12 | lun. 26/10 | Dev |
| T4.2 | Pré-production : Gunicorn, .env, base de test | — | Must | 2 | T4.1 | lun. 26/10 | SCM |
| T4.3 | Robustesse : 655 146 lignes Loghub ; 5 Mo en moins de 5 s | — | Must | 2 | — | mar. 27/10 | QA |
| T4.4 | Checklist complète en pré-production et correction des bugs | Toutes | Must | 5 | T4.2 | mer. 28/10 | QA, Dev |
| T4.5 | Couverture de tests d'au moins 80 % : compléter les tests manquants | — | Must | 2 | — | mer. 28/10 | QA |
| T4.6 | README complet : architecture, base, installation, tests, déploiement | — | Must | 3 | — | jeu. 29/10 | Dev |
| T4.7 | Docstrings et commentaires du code | — | Must | 2 | — | jeu. 29/10 | Dev |
| T4.8 | Fusion dans main, tag v1.0.0, installation en production | — | Must | 1 | T4.4 | ven. 30/10 | SCM |
| T4.9 | Vidéo de démonstration en production | — | Should | 1 | T4.8 | ven. 30/10 | PM |
| T4.10 | Préparation de la revue technique (MR) | — | Must | 2 | T4.8 | sam. 31/10 | PM |
| T4.11 | Bonus : limitation des tentatives de connexion, export CSV | US11 | Could | 3 | — | si avance | Dev |

## Règles d'ajustement

- **Jeudi (mi-sprint)** : si moins de la moitié des points sont terminés, les tâches Should passent au sprint suivant.
- **Tâche qui déborde** (plus du double de son estimation) : découpée en deux issues.
- **Bug bloquant** : corrigé avant toute nouvelle fonctionnalité.
- **Ordre de coupe** en cas de retard : bonus, puis graphique, puis récidivistes.
