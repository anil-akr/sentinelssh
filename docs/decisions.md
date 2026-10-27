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
| D11 | 12/10/2026 | Conservation des analyses : 30 jours, supprimées par une requête `DELETE` au démarrage de l'application (les IP suivent par cascade) | Durée seulement écrite dans la page Confidentialité ; suppression manuelle uniquement | RGPD (limitation de la conservation) : la durée est appliquée par le code, pas seulement annoncée ; une seule requête à écrire et à expliquer |
| D12 | 12/10/2026 | Sprints 1 à 4 décalés d'une semaine, contenu inchangé ; marge du 9 au 12 novembre | Couper des fonctionnalités pour finir au 1er novembre | Une semaine perdue pour raison personnelle ; le demo day est le 13 novembre, ce qui laisse la place de tout livrer avec une marge |
| D13 | 25/10/2026 | Commande de blocage proposée seulement pour les gravités élevée et critique ; l'IP est validée (module `ipaddress`) avant d'être écrite dans la commande | Une commande pour toutes les IP, comme sur la maquette | Suit l'exigence EF5 (la maquette se contredisait) : « moyenne » = surveiller, pas bloquer. La validation empêche qu'un texte piégé du journal finisse dans une commande copiée par l'administrateur |
| D14 | 27/10/2026 | Géolocalisation des IP suspectes avec la base locale DB-IP Lite (fichiers `.mmdb` lus par `maxminddb`), calculée à chaque lecture d'une analyse et jamais stockée ; carte du monde hors ligne (d3-geo + world-atlas) | API en ligne (ipinfo.io) ; base MaxMind GeoLite2 (compte et clé de licence obligatoires) ; pas de géolocalisation | Demande d'une analyse plus détaillée pour la démo. La base locale n'envoie aucune IP à un tiers (RGPD), marche sans Internet et sans limite de requêtes. Rien n'est ajouté à la base SQLite (minimisation). Licence CC BY 4.0 : attribution « IP Geolocation by DB-IP » sous la carte et dans la page Confidentialité |
| D15 | 27/10/2026 | Page publique de présentation (`/presentation`) : un visiteur non connecté y arrive, puis va à la connexion. Pas de création de compte | Création de compte ouverte à tous ; inscription réservée à l'administrateur | La page explique le projet au jury et au visiteur sans rien changer à l'API. Une inscription ouverte permettrait à n'importe qui de voir les IP et les analyses (données personnelles, RGPD) et contredirait D7 ; le compte unique reste créé par `flask create-admin` |

<!-- Ajouter une ligne à chaque décision qui change le périmètre, une technologie ou le planning. -->
