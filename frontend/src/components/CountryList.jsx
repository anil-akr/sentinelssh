import { countryName, totalFailures, worstSeverity } from '../format.js'

// Pays montrés un par un ; les suivants sont regroupés en une seule ligne
// (sinon 30 lignes « < 1 % » qui n'apprennent rien).
const TOP = 10

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
      list: ips,
    })
  }
  rows.sort((a, b) => b.failures - a.failures)

  if (rows.length === 0) {
    return <p className="muted">Aucune IP localisée.</p>
  }

  // Total des échecs de tous les pays : la barre montre la part de chacun.
  let total = 0
  for (const row of rows) {
    total += row.failures
  }

  // Les 10 premiers pays, puis une ligne « N autres pays » pour le reste.
  const shown = rows.slice(0, TOP)
  const others = rows.slice(TOP)
  if (others.length > 0) {
    const otherIps = []
    for (const row of others) {
      otherIps.push(...row.list)
    }
    shown.push({
      code: '',
      name: others.length + ' autres pays',
      ips: otherIps.length,
      failures: totalFailures(otherIps),
      worst: worstSeverity(otherIps),
    })
  }

  return (
    <ol className="country-list">
      {shown.map((row) => {
        // Part du pays en % ; « < 1 % » plutôt qu'un « 0 % » trompeur.
        const share = (row.failures / total) * 100
        const shareText = share < 1 ? '< 1 %' : Math.round(share) + ' %'
        return (
          <li key={row.name}>
            <div className="country-line">
              <span className="country-code">{row.code}</span>
              <span className="country-name">{row.name}</span>
              <span className="country-figures">
                {row.ips} IP, {row.failures.toLocaleString('fr-FR')} échecs
              </span>
            </div>
            <div className="country-share-line">
              {/* Rail gris + barre : part du pays dans le total des échecs. */}
              <div className="country-track">
                {/* Couleur de la barre : gravité la plus haute du pays (comme la carte). */}
                <div
                  className={`country-bar swatch-${row.worst}`}
                  style={{ width: `${share}%` }}
                />
              </div>
              <span className="country-share">{shareText}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
