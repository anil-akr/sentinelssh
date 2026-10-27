"""Géolocalisation des IP suspectes avec les bases locales DB-IP Lite.

Les bases sont des fichiers .mmdb lus sur le disque : aucune IP n'est
envoyée à un service extérieur (RGPD), et tout marche sans Internet.
"""

import ipaddress
from pathlib import Path

import maxminddb


class GeoLocator:
    """Donne le pays, la ville, les coordonnées et l'opérateur d'une IP."""

    def __init__(self, city_path, asn_path):
        """Ouvre les deux bases ; une base absente est simplement ignorée."""
        self.city_db = self._open(city_path)
        self.asn_db = self._open(asn_path)

    @staticmethod
    def _open(path):
        """Ouvre une base .mmdb, ou renvoie None si le fichier n'existe pas."""
        if not Path(path).is_file():
            return None
        return maxminddb.open_database(str(path))

    def locate(self, ip):
        """Renvoie la position de l'IP (dict), ou None si c'est impossible.

        None : base non installée ou adresse invalide. Une IP privée ou de
        documentation (192.168.x.x, 203.0.113.x…) n'a pas de position :
        on renvoie alors reserved=True.
        """
        if self.city_db is None:
            return None
        try:
            address = ipaddress.ip_address(ip)
        except ValueError:
            return None

        geo = {"reserved": not address.is_global, "country_code": None,
               "country": None, "city": None, "latitude": None,
               "longitude": None, "asn": None, "as_org": None}
        if geo["reserved"]:
            return geo

        # get() renvoie None si l'IP n'est pas dans la base.
        city = self.city_db.get(str(address)) or {}
        country = city.get("country", {})
        names = country.get("names", {})
        location = city.get("location", {})
        geo["country_code"] = country.get("iso_code")
        geo["country"] = names.get("fr") or names.get("en")
        geo["city"] = city.get("city", {}).get("names", {}).get("en")
        geo["latitude"] = location.get("latitude")
        geo["longitude"] = location.get("longitude")

        if self.asn_db is not None:
            asn = self.asn_db.get(str(address)) or {}
            geo["asn"] = asn.get("autonomous_system_number")
            geo["as_org"] = asn.get("autonomous_system_organization")
        return geo
