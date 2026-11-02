"""Tests unitaires de GeoLocator (avec une fausse base, sans fichier)."""

import maxminddb
import pytest

from sentinel.geo import GeoLocator


class FakeReader:
    """Remplace une base .mmdb : get(ip) lit un simple dictionnaire."""

    def __init__(self, records):
        self.records = records

    def get(self, ip):
        return self.records.get(ip)


CITY = {"8.8.8.8": {
    "country": {"iso_code": "US", "names": {"en": "United States",
                                            "fr": "États-Unis"}},
    "city": {"names": {"en": "Mountain View"}},
    "location": {"latitude": 37.4, "longitude": -122.1},
}}
ASN = {"8.8.8.8": {"autonomous_system_number": 15169,
                   "autonomous_system_organization": "Google LLC"}}


def locator(city=CITY, asn=ASN):
    """GeoLocator branché sur les fausses bases."""
    geo = GeoLocator("absent.mmdb", "absent.mmdb")
    geo.city_db = FakeReader(city) if city is not None else None
    geo.asn_db = FakeReader(asn) if asn is not None else None
    return geo


def test_missing_files_give_no_database():
    geo = GeoLocator("absent.mmdb", "absent.mmdb")
    assert geo.city_db is None and geo.asn_db is None
    assert geo.locate("8.8.8.8") is None


def test_locate_public_ip():
    assert locator().locate("8.8.8.8") == {
        "reserved": False, "country_code": "US", "country": "États-Unis",
        "city": "Mountain View", "latitude": 37.4, "longitude": -122.1,
        "asn": 15169, "as_org": "Google LLC"}


def test_english_name_when_no_french_name():
    city = {"8.8.8.8": {"country": {"iso_code": "US",
                                    "names": {"en": "United States"}}}}
    assert locator(city=city).locate("8.8.8.8")["country"] == "United States"


def test_ip_not_in_database():
    geo = locator().locate("1.1.1.1")
    assert geo["reserved"] is False
    assert geo["country"] is None and geo["asn"] is None


def test_reserved_ips_have_no_position():
    for ip in ("192.168.1.10", "203.0.113.20", "::1"):
        geo = locator().locate(ip)
        assert geo["reserved"] is True
        assert geo["latitude"] is None


def test_invalid_ip():
    assert locator().locate("pas-une-ip") is None


def test_without_asn_database():
    geo = locator(asn=None).locate("8.8.8.8")
    assert geo["country_code"] == "US"
    assert geo["asn"] is None


def test_real_file_is_read(tmp_path):
    # Un faux fichier .mmdb prouve que _open lit vraiment le fichier.
    bad = tmp_path / "bad.mmdb"
    bad.write_bytes(b"pas une base")
    with pytest.raises(maxminddb.InvalidDatabaseError):
        GeoLocator(bad, bad)
