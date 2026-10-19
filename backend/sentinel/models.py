"""Dataclasses partagées : Event et SuspectIP."""

from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class Event:
    """Une tentative de connexion SSH lue dans le journal."""

    time: datetime
    kind: str  # "fail" ou "success"
    user: str
    ip: str


@dataclass
class SuspectIP:
    """Bilan d'une IP suspecte dans le journal."""

    ip: str
    failures: int
    severity: str  # "moyenne", "elevee" ou "critique"
    rules: list[str]
    users: list[str]
    first_seen: str
    last_seen: str

    def to_dict(self):
        """Prépare le JSON de l'API et l'enregistrement en base."""
        return asdict(self)
