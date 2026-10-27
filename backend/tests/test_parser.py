"""Tests unitaires de LogParser."""

from datetime import datetime
from pathlib import Path

from sentinel.parser import LogParser

SAMPLES = Path(__file__).parent / "samples"


def read_sample(name):
    """Renvoie le texte d'un mini-journal de tests/samples."""
    return (SAMPLES / name).read_text(encoding="utf-8")


def test_failed_line():
    line = ("Oct 12 14:03:21 srv sshd[1234]: Failed password for root "
            "from 203.0.113.10 port 51122 ssh2")
    event = LogParser().parse_line(line)
    assert event.kind == "fail"
    assert event.user == "root"
    assert event.ip == "203.0.113.10"
    assert event.time == datetime(2000, 10, 12, 14, 3, 21)


def test_failed_invalid_user_line():
    line = ("Oct 12 14:03:41 srv sshd[1234]: Failed password for invalid "
            "user admin from 203.0.113.10 port 51122 ssh2")
    event = LogParser().parse_line(line)
    assert event.kind == "fail"
    assert event.user == "admin"


def test_accepted_password_line():
    line = ("Oct 12 09:02:00 srv sshd[2002]: Accepted password for root "
            "from 198.51.100.7 port 40010 ssh2")
    event = LogParser().parse_line(line)
    assert event.kind == "success"
    assert event.user == "root"
    assert event.ip == "198.51.100.7"


def test_accepted_publickey_line():
    line = ("Oct 12 09:15:00 srv sshd[2004]: Accepted publickey for anil "
            "from 198.51.100.8 port 40102 ssh2")
    event = LogParser().parse_line(line)
    assert event.kind == "success"
    assert event.user == "anil"


def test_invalid_user_line_is_ignored():
    # Elle décrit la même tentative que « Failed password for invalid
    # user » : la compter doublerait les échecs.
    line = ("Oct 12 09:01:00 srv sshd[2001]: Invalid user test "
            "from 198.51.100.7 port 40002")
    assert LogParser().parse_line(line) is None


def test_unrelated_line_is_ignored():
    line = ("Oct 12 09:00:00 srv sshd[2000]: Connection closed "
            "by 198.51.100.7 port 40000")
    assert LogParser().parse_line(line) is None


def test_ipv6():
    line = ("Oct 12 14:03:21 srv sshd[1234]: Failed password for root "
            "from 2001:db8::ab port 51122 ssh2")
    assert LogParser().parse_line(line).ip == "2001:db8::ab"


def test_february_29():
    events, _, _ = LogParser().parse_text(read_sample("leap_day.log"))
    assert len(events) == 2
    assert events[0].time == datetime(2000, 2, 29, 10, 0, 0)


def test_single_digit_day():
    line = ("Oct  2 14:03:21 srv sshd[1]: Failed password for root "
            "from 203.0.113.9 port 1 ssh2")
    assert LogParser().parse_line(line).time == datetime(2000, 10, 2,
                                                         14, 3, 21)


def test_unreadable_date_is_ignored():
    line = "garbage: Failed password for root from 203.0.113.9 port 1 ssh2"
    assert LogParser().parse_line(line) is None


def test_other_year():
    line = ("Feb 28 10:00:00 srv sshd[1]: Failed password for root "
            "from 203.0.113.9 port 1 ssh2")
    assert LogParser(year=1996).parse_line(line).time.year == 1996


# --- Nouveau format de date (ISO 8601, Ubuntu 23.10 et plus) ----------

def test_iso_failed_line():
    line = ("2026-10-25T17:17:03.249675+01:00 srv sshd[1234]: Failed password "
            "for root from 203.0.113.10 port 51122 ssh2")
    event = LogParser().parse_line(line)
    assert event.kind == "fail"
    assert event.user == "root"
    assert event.ip == "203.0.113.10"
    # Vraie année gardée (pas 2000) ; microsecondes et fuseau retirés.
    assert event.time == datetime(2026, 10, 25, 17, 17, 3)


def test_iso_accepted_line():
    line = ("2026-10-25T17:20:00.000001+01:00 srv sshd[1240]: Accepted "
            "publickey for anil from 192.0.2.7 port 40000 ssh2")
    event = LogParser().parse_line(line)
    assert event.kind == "success"
    assert event.time == datetime(2026, 10, 25, 17, 20, 0)


def test_iso_unreadable_date_is_ignored():
    # Mois 13 : commence par 4 chiffres mais la date n'existe pas.
    line = ("2026-13-25T17:17:03.249675+01:00 srv sshd[1]: Failed password "
            "for root from 203.0.113.9 port 1 ssh2")
    assert LogParser().parse_line(line) is None


def test_mixed_formats_in_one_file():
    text = ("Oct 12 14:03:21 srv sshd[1]: Failed password for root "
            "from 203.0.113.9 port 1 ssh2\n"
            "2026-10-12T14:03:31.5+02:00 srv sshd[1]: Failed password "
            "for root from 203.0.113.9 port 1 ssh2\n")
    events, total_lines, ignored_lines = LogParser().parse_text(text)
    assert [e.time.year for e in events] == [2000, 2026]
    assert (total_lines, ignored_lines) == (2, 0)


def test_parse_text_counters():
    events, total_lines, ignored_lines = LogParser().parse_text(
        read_sample("clean.log"))
    assert len(events) == 4
    assert total_lines == 6
    assert ignored_lines == 2


def test_parse_text_empty():
    assert LogParser().parse_text("") == ([], 0, 0)
