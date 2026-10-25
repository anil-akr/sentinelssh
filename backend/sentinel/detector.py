"""Détection des IP suspectes : applique les règles R1, R2 et R3."""

from collections import Counter

from sentinel import config
from sentinel.models import SuspectIP

# Gravité associée à chaque règle (valeurs du CHECK de la table suspect_ips).
SEVERITY_BY_RULE = {"R1": "moyenne", "R2": "elevee", "R3": "critique"}

# Rang de chaque gravité : plus le nombre est grand, plus c'est grave.
SEVERITY_RANK = {"moyenne": 1, "elevee": 2, "critique": 3}

# Format d'affichage des heures, le même que dans le journal (sans année).
TIME_FORMAT = "%b %d %H:%M:%S"


class Detector:
    """Regroupe les événements par IP et repère les IP suspectes."""

    def __init__(self, persistent_threshold=config.PERSISTENT_THRESHOLD,
                 fast_threshold=config.FAST_THRESHOLD,
                 fast_window=config.FAST_WINDOW,
                 compromise_threshold=config.COMPROMISE_THRESHOLD):
        """Garde les seuils ; un test peut en choisir d'autres."""
        self.persistent_threshold = persistent_threshold
        self.fast_threshold = fast_threshold
        self.fast_window = fast_window
        self.compromise_threshold = compromise_threshold

    def detect(self, events):
        """Renvoie la liste des SuspectIP, la plus grave en premier."""
        # 1. Regrouper les événements par IP, en gardant l'ordre du journal.
        events_by_ip = {}
        for event in events:
            events_by_ip.setdefault(event.ip, []).append(event)

        # 2. Appliquer les 3 règles à chaque IP.
        suspects = []
        for ip, ip_events in events_by_ip.items():
            fail_times = [e.time for e in ip_events if e.kind == "fail"]
            rules = []
            if self._is_persistent(fail_times):
                rules.append("R1")
            if self._is_fast(fail_times):
                rules.append("R2")
            if self._is_compromised(ip_events):
                rules.append("R3")
            if not rules:
                continue

            # Les 3 comptes les plus visés par les échecs de cette IP.
            targeted = Counter(e.user for e in ip_events if e.kind == "fail")
            users = [user for user, _ in targeted.most_common(3)]

            all_times = [e.time for e in ip_events]
            suspects.append(SuspectIP(
                ip=ip,
                failures=len(fail_times),
                severity=self.severity_of(rules),
                rules=rules,
                users=users,
                first_seen=min(all_times).strftime(TIME_FORMAT),
                last_seen=max(all_times).strftime(TIME_FORMAT),
            ))

        # 3. Trier : gravité décroissante, puis nombre d'échecs décroissant.
        suspects.sort(key=lambda s: (SEVERITY_RANK[s.severity], s.failures),
                      reverse=True)
        return suspects

    def _is_persistent(self, times):
        """R1 : au moins persistent_threshold échecs dans le fichier."""
        return len(times) >= self.persistent_threshold

    def _is_fast(self, times):
        """R2 : au moins fast_threshold échecs en fast_window secondes."""
        times = sorted(times)
        n = self.fast_threshold
        # Fenêtre glissante : on compare le 1er et le n-ième échec de
        # chaque groupe de n échecs consécutifs.
        for i in range(len(times) - n + 1):
            gap = (times[i + n - 1] - times[i]).total_seconds()
            if gap <= self.fast_window:
                return True
        return False

    def _is_compromised(self, events):
        """R3 : un succès après au moins compromise_threshold échecs."""
        failures = 0
        for event in events:
            if event.kind == "fail":
                failures += 1
            elif failures >= self.compromise_threshold:
                return True
        return False

    def severity_of(self, rules):
        """Renvoie la gravité la plus haute parmi les règles déclenchées."""
        severities = [SEVERITY_BY_RULE[rule] for rule in rules]
        return max(severities, key=lambda s: SEVERITY_RANK[s])
