"""Lecture du journal SSH : transforme les lignes en événements Event."""

import re
from datetime import datetime
from sentinel.models import Event


class LogParser:
    """Transforme les lignes d'un journal SSH en événements Event."""
    _FAILED = re.compile(
        r"Failed password for (?:invalid user )?(\S+) from (\S+)")
    _ACCEPTED = re.compile(
        r"Accepted (?:password|publickey) for (\S+) from (\S+)")

    def __init__(self, year=2000):
        """Garde l'année ajoutée aux dates de l'ancien format, sans année."""
        self.year = year

    def _read_time(self, line):
        """Renvoie la date du début de la ligne (lève ValueError si illisible).

        Deux formats existent :
        - nouveau (Ubuntu 23.10 et plus) : 2026-10-25T17:17:03.249675+01:00
        - ancien (syslog classique) : Oct 25 17:17:03, sans année
        """
        if line[:4].isdigit():
            # Les 19 premiers caractères : 2026-10-25T17:17:03.
            # Microsecondes et fuseau sont retirés : les règles comptent en
            # secondes, et une date avec fuseau ne peut pas être comparée
            # à une date sans fuseau (TypeError).
            return datetime.strptime(line[:19], "%Y-%m-%dT%H:%M:%S")
        stamp = str(self.year) + " " + line[:15]
        return datetime.strptime(stamp, "%Y %b %d %H:%M:%S")

    def parse_line(self, line):
        """Renvoie l'Event lu dans la ligne, ou None si elle ne compte pas."""
        match = self._FAILED.search(line)
        if match:
            kind = "fail"
        else:
            match = self._ACCEPTED.search(line)
            if match is None:
                return None
            kind = "success"
        try:
            time = self._read_time(line)
        except ValueError:
            # Date illisible (ligne coupée, autre format) : ligne ignorée
            # plutôt que de faire planter toute l'analyse.
            return None
        return Event(
            time=time, kind=kind, user=match.group(1), ip=match.group(2))

    def parse_text(self, text):
        """Renvoie les events, le nombre de lignes lues et ignorées.

        Ancien format, sans année : si le mois recule (décembre puis
        janvier), le journal a passé le Nouvel An. La dernière année du
        fichier reste self.year (2000, bissextile) et les années
        précédentes reculent d'un an à chaque passage.
        """
        lines = text.splitlines()
        found = []  # (event, numéro de l'année ou None pour le format ISO)
        year_number = 0
        last_month = None
        for line in lines:
            event = self.parse_line(line)
            if event is None:
                continue
            if line[:4].isdigit():
                found.append((event, None))  # vraie année déjà lue
                continue
            if last_month is not None and event.time.month < last_month:
                year_number += 1
            last_month = event.time.month
            found.append((event, year_number))

        events = []
        for event, number in found:
            if number is not None:
                year = self.year - (year_number - number)
                try:
                    event.time = event.time.replace(year=year)
                except ValueError:
                    # 29 février tombé dans une année non bissextile
                    # (journal de plus de 10 mois) : ligne ignorée.
                    continue
            events.append(event)
        return events, len(lines), len(lines) - len(events)
