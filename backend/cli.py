"""Mode terminal de SentinelSSH : analyse un fichier sans base de données.

Usage : python cli.py <fichier>
"""

import sys
import time

from sentinel.detector import Detector
from sentinel.parser import LogParser


def main():
    """Analyse le fichier passé en argument et affiche un tableau texte."""
    if len(sys.argv) != 2:
        print("Usage : python cli.py <fichier>")
        return 1

    path = sys.argv[1]
    try:
        # errors="replace" : un octet illisible devient « � » au lieu de
        # faire planter la lecture.
        with open(path, encoding="utf-8", errors="replace") as f:
            text = f.read()
    except OSError:
        print("Fichier introuvable ou illisible :", path)
        return 1

    start = time.perf_counter()
    events, total_lines, ignored_lines = LogParser().parse_text(text)
    suspects = Detector().detect(events)
    duration = time.perf_counter() - start

    print("Fichier         :", path)
    print("Lignes lues     :", total_lines)
    print("Lignes ignorées :", ignored_lines)
    print("IP suspectes    :", len(suspects))
    print("Durée           : {:.2f} s".format(duration))
    print()

    if not suspects:
        print("Aucune IP suspecte dans ce fichier.")
        return 0

    row = "{:<40} {:>7}  {:<9} {:<9} {}"
    print(row.format("IP", "Échecs", "Gravité", "Règles", "Comptes visés"))
    print("-" * 90)
    for s in suspects:
        print(row.format(s.ip, s.failures, s.severity,
                         ",".join(s.rules), ",".join(s.users)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
