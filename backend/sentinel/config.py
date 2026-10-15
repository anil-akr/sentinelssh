"""Seuils des règles de détection de SentinelSSH."""

# R1 (attaque persistante) : nombre d'échecs dans le fichier à partir
# duquel une IP est signalée, même si ses essais sont espacés.
PERSISTENT_THRESHOLD = 20

# R2 (force brute rapide) : nombre d'échecs à observer dans la fenêtre
# FAST_WINDOW pour conclure à une attaque automatisée.
FAST_THRESHOLD = 5

# R2 : durée de la fenêtre, en secondes. Un humain ne rate pas 5 mots de
# passe en une minute, un robot si.
FAST_WINDOW = 60

# R3 (compromission possible) : nombre d'échecs de la même IP avant une
# connexion réussie pour signaler un compte peut-être compromis.
COMPROMISE_THRESHOLD = 5
