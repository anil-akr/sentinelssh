"""Limitation des tentatives (connexion, inscription) par adresse IP.

Même idée que la règle R2 du Detector, appliquée au site lui-même : trop
d'essais d'une même IP dans une fenêtre de temps = blocage temporaire.
"""

import time


class RateLimiter:
    """Compte les tentatives de chaque clé (une IP) dans une fenêtre.

    Les compteurs sont en mémoire : ils repartent à zéro au redémarrage et
    chaque processus Gunicorn a les siens. Suffisant pour freiner un robot
    sur un petit site ; un site très fréquenté les mettrait dans une base
    partagée (Redis, par exemple).
    """

    def __init__(self, max_attempts, window, clock=time.monotonic):
        """max_attempts tentatives au plus par fenêtre de window secondes.

        clock donne l'heure ; les tests passent une fausse horloge.
        monotonic : une horloge qui ne recule jamais, même si l'heure du
        système change.
        """
        self.max_attempts = max_attempts
        self.window = window
        self.clock = clock
        self.attempts = {}  # clé -> liste des heures des tentatives

    def _recent(self, key):
        """Garde seulement les tentatives encore dans la fenêtre."""
        limit = self.clock() - self.window
        recent = [t for t in self.attempts.get(key, []) if t > limit]
        if recent:
            self.attempts[key] = recent
        else:
            # Plus rien de récent : on oublie la clé (la mémoire ne grossit
            # pas avec toutes les IP vues un jour).
            self.attempts.pop(key, None)
        return recent

    def is_blocked(self, key):
        """True si la clé a déjà atteint le maximum dans la fenêtre."""
        return len(self._recent(key)) >= self.max_attempts

    def record(self, key):
        """Note une tentative de la clé, maintenant."""
        self._recent(key)
        self.attempts.setdefault(key, []).append(self.clock())

    def reset(self, key):
        """Oublie les tentatives de la clé (ex. après une connexion
        réussie)."""
        self.attempts.pop(key, None)
