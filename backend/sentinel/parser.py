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
        """Garde l'année ajoutée aux dates du journal, qui n'en ont pas."""
        self.year = year

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
        stamp = str(self.year) + " " + line[:15]
        time = datetime.strptime(stamp, "%Y %b %d %H:%M:%S")
        return Event(
            time=time, kind=kind, user=match.group(1), ip=match.group(2))
