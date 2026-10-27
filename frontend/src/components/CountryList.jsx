import { countryName, totalFailures, worstSeverity } from '../format.js'

// Classement des pays d'origine : nombre d'IP et d'échecs par pays.
export default function CountryList({ suspects }) {
  // Regroupe les IP par code pays (« CN », « FR »…) :
  // byCountry = { CN: [IP, IP], FR: [IP] }
  const byCountry = {}
  for (const s of suspects) {
    if (!s.geo || !s.geo.country_code) {
      continue // IP non localisée : on passe à la suivante
    }
    const code = s.geo.country_code
    if (!byCountry[code]) {
      byCountry[code] = []
    }
    byCountry[code].push(s)
  }

  // Une ligne par pays, puis tri du plus grand nombre d'échecs au plus petit.
  const rows = []
  for (const code in byCountry) {
    const ips = byCountry[code]
    rows.push({
      code,
      name: countryName(ips[0].geo),
      ips: ips.length,
      failures: totalFailures(ips),
      worst: worstSeverity(ips),
    })
  }
  rows.sort((a, b) => b.failures - a.failures)

  if (rows.length === 0) {
    return <p className="muted">Aucune IP localisée.</p>
  }

  // La barre la plus longue = le pays avec le plus d'échecs.
  const max = rows[0].failures
  return (
    <ol className="country-list">
      {rows.map((row) => (
        <li key={row.code}>
          <div className="country-line">
            <span className="country-code">{row.code}</span>
            <span className="country-name">{row.name}</span>
            <span className="country-figures">
              {row.ips} IP, {row.failures} échecs
            </span>
          </div>
          {/* Rail gris + barre dont la longueur suit le nombre d'échecs. */}
          <div className="country-track">
            {/* Couleur de la barre : gravité la plus haute du pays (comme la carte). */}
            <div
              className={`country-bar swatch-${row.worst}`}
              style={{ width: `${(row.failures / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}
