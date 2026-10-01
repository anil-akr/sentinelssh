# Journal des décisions

Chaque décision importante est notée ici, avec les options envisagées et la raison du choix.

| ID | Date | Décision | Options envisagées | Raison |
|---|---|---|---|---|
| D1 | 29/09/2026 | Idée retenue : SentinelSSH | Les 6 idées du Stage 1 | Meilleur score (26/30) ; défensif, complet, différent de fail2ban |
| D2 | 29/09/2026 | Analyse à la demande | Temps réel | Faisable en 4 semaines ; le temps réel passe en version future |
| D3 | 29/09/2026 | Front-end en React (Vite) | HTML/CSS simple, Vue | Technologie JavaScript exigée ; standard le plus répandu |
| D4 | 29/09/2026 | Back-end en Python/Flask | Node.js/Express, FastAPI, Django | Langage le mieux maîtrisé pour le cœur ; Flask est le plus léger |
| D5 | 29/09/2026 | Base de données SQLite | PostgreSQL, MongoDB | Usage local, un seul utilisateur, données reliées |
| D6 | 29/09/2026 | Blocage suggéré, pas automatique | Blocage automatique par iptables | Pas de droits root ; décision humaine ; différence avec fail2ban |
| D7 | 30/09/2026 | Connexion par un compte administrateur unique | Aucune connexion, plusieurs comptes | Application sécurisée attendue par le titre RNCP ; reste simple |
| D8 | 30/09/2026 | Mise en production locale avec Gunicorn | Serveurs de développement, Docker | Compétence « déploiement » ; une seule commande pour la démo |
| D9 | 01/10/2026 | Back-end organisé en classes | Fonctions dans des modules | Consigne du Stage 3 ; une responsabilité par classe ; tests plus simples |
| D10 | 01/10/2026 | Branches main / develop / feature | Tout sur main | main reste présentable ; chaque fusion passe par une PR et la CI |

<!-- Ajouter une ligne à chaque décision qui change le périmètre, une technologie ou le planning. -->
