"""Tests unitaires de RateLimiter (avec une fausse horloge)."""

from sentinel.limiter import RateLimiter


class FakeClock:
    """Horloge réglée à la main : now est l'heure en secondes."""

    def __init__(self):
        """Commence à 0 s."""
        self.now = 0

    def __call__(self):
        """RateLimiter appelle clock() pour connaître l'heure."""
        return self.now


def test_blocked_after_max_attempts():
    limiter = RateLimiter(3, 60, FakeClock())
    for _ in range(2):
        limiter.record("203.0.113.1")
    assert limiter.is_blocked("203.0.113.1") is False
    limiter.record("203.0.113.1")
    assert limiter.is_blocked("203.0.113.1") is True


def test_other_ip_is_not_blocked():
    limiter = RateLimiter(1, 60, FakeClock())
    limiter.record("203.0.113.1")
    assert limiter.is_blocked("203.0.113.2") is False


def test_unblocked_when_window_has_passed():
    clock = FakeClock()
    limiter = RateLimiter(2, 60, clock)
    limiter.record("203.0.113.1")
    limiter.record("203.0.113.1")
    clock.now = 61
    assert limiter.is_blocked("203.0.113.1") is False
    # Les vieilles tentatives sont oubliées (la mémoire ne grossit pas).
    assert limiter.attempts == {}


def test_reset_forgets_attempts():
    limiter = RateLimiter(1, 60, FakeClock())
    limiter.record("203.0.113.1")
    limiter.reset("203.0.113.1")
    assert limiter.is_blocked("203.0.113.1") is False
