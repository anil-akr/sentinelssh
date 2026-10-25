"""Tests unitaires de Detector."""

from datetime import datetime, timedelta
from pathlib import Path

from sentinel.detector import Detector
from sentinel.models import Event
from sentinel.parser import LogParser

SAMPLES = Path(__file__).parent / "samples"
START = datetime(2000, 10, 12, 14, 0, 0)


def fails(count, every, ip="203.0.113.1", user="root", start=START):
    """Fabrique count échecs de la même IP, espacés de every secondes."""
    return [Event(start + timedelta(seconds=i * every), "fail", user, ip)
            for i in range(count)]


def success(seconds, ip="203.0.113.1", user="root"):
    """Fabrique un succès, seconds secondes après START."""
    return Event(START + timedelta(seconds=seconds), "success", user, ip)


def detect_sample(name):
    """Analyse un mini-journal de tests/samples."""
    text = (SAMPLES / name).read_text(encoding="utf-8")
    events, _, _ = LogParser().parse_text(text)
    return Detector().detect(events)


# --- R2 : force brute rapide -------------------------------------------

def test_five_failures_in_50_seconds_is_fast():
    suspects = Detector().detect(fails(5, 10))  # 0 s -> 40 s
    assert len(suspects) == 1
    assert suspects[0].rules == ["R2"]
    assert suspects[0].severity == "elevee"


def test_five_failures_in_exactly_60_seconds_is_fast():
    assert Detector().detect(fails(5, 15))[0].rules == ["R2"]


def test_five_failures_in_5_minutes_is_not_fast():
    assert Detector().detect(fails(5, 75)) == []


def test_four_failures_is_not_fast():
    assert Detector().detect(fails(4, 1)) == []


# --- R1 : attaque persistante ------------------------------------------

def test_twenty_spread_failures_is_persistent():
    suspects = Detector().detect(fails(20, 60))
    assert suspects[0].rules == ["R1"]
    assert suspects[0].severity == "moyenne"


def test_nineteen_failures_is_not_persistent():
    assert Detector().detect(fails(19, 60)) == []


# --- R3 : compromission possible ---------------------------------------

def test_success_after_five_failures_is_compromised():
    events = fails(5, 120) + [success(700)]
    suspects = Detector().detect(events)
    assert suspects[0].rules == ["R3"]
    assert suspects[0].severity == "critique"


def test_success_alone_is_nothing():
    assert Detector().detect([success(0)]) == []


def test_success_before_failures_is_not_compromised():
    events = [success(0)] + fails(5, 120, start=START + timedelta(hours=1))
    assert Detector().detect(events) == []


def test_failures_of_another_ip_do_not_count():
    events = fails(5, 120, ip="203.0.113.1") + [success(700, ip="203.0.113.2")]
    assert Detector().detect(events) == []


# --- Gravité, tri, comptes ---------------------------------------------

def test_several_rules_keep_highest_severity():
    events = fails(20, 1) + [success(30)]
    suspect = Detector().detect(events)[0]
    assert suspect.rules == ["R1", "R2", "R3"]
    assert suspect.severity == "critique"


def test_severity_of():
    detector = Detector()
    assert detector.severity_of(["R1"]) == "moyenne"
    assert detector.severity_of(["R1", "R2"]) == "elevee"
    assert detector.severity_of(["R2", "R3"]) == "critique"


def test_sorted_by_severity_then_failures():
    events = (fails(20, 60, ip="203.0.113.1")           # moyenne
              + fails(6, 1, ip="203.0.113.2")           # elevee, 6 échecs
              + fails(9, 1, ip="203.0.113.3"))          # elevee, 9 échecs
    ips = [s.ip for s in Detector().detect(events)]
    assert ips == ["203.0.113.3", "203.0.113.2", "203.0.113.1"]


def test_three_most_targeted_users():
    events = (fails(3, 1, user="root") + fails(2, 1, user="admin")
              + fails(1, 1, user="test") + fails(1, 1, user="pi"))
    suspect = Detector().detect(events)[0]
    assert suspect.users[:2] == ["root", "admin"]
    assert len(suspect.users) == 3


def test_first_and_last_seen():
    suspect = Detector().detect(fails(5, 10))[0]
    assert suspect.first_seen == "Oct 12 14:00:00"
    assert suspect.last_seen == "Oct 12 14:00:40"


def test_custom_thresholds():
    detector = Detector(fast_threshold=3, fast_window=10)
    assert detector.detect(fails(3, 5))[0].rules == ["R2"]


# --- Mini-journaux -----------------------------------------------------

def test_sample_r1():
    suspects = detect_sample("r1_persistent.log")
    assert [(s.ip, s.rules) for s in suspects] == [("203.0.113.30", ["R1"])]


def test_sample_r2():
    suspects = detect_sample("r2_fast.log")
    assert [(s.ip, s.rules) for s in suspects] == [("203.0.113.10", ["R2"])]


def test_sample_r3():
    suspects = detect_sample("r3_compromise.log")
    assert [(s.ip, s.rules) for s in suspects] == [("203.0.113.20", ["R3"])]


def test_sample_clean():
    assert detect_sample("clean.log") == []


def test_sample_ipv6():
    suspects = detect_sample("ipv6.log")
    assert suspects[0].ip == "2001:db8::ab"
    assert suspects[0].severity == "elevee"
