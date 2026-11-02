import { useState } from 'react'
import { countryName, totalFailures, worstSeverity } from '../format.js'

// Pays affichés au départ, puis à chaque clic sur « Afficher 10 pays de
// plus » (sinon 39 lignes d'un coup, dont 30 à « < 1 % »).
const STEP = 10

// Classement des pays d'origine : nombre d'IP et d'échecs par pays.
export default function CountryList({ suspects }) {
  // Nombre de pays affichés ; grandit de 10 à chaque clic.
  const [visible, setVisible] = useState(STEP)

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

  // Total des échecs de tous les pays : la barre montre la part de chacun.
  // totalFailures additionne le champ failures de chaque ligne.
  const total = totalFailures(rows)

  const shown = rows.slice(0, visible)
  const remaining = rows.length - shown.length

  return (
    <>
      {/* fill : la liste prend la hauteur de la carte voisine et défile. */}
      <div className="fill">
        <ol className="country-list">
          {shown.map((row) => {
            // Part du pays en % ; « < 1 % » plutôt qu'un « 0 % » trompeur.
            const share = (row.failures / total) * 100
            const shareText = share < 1 ? '< 1 %' : Math.round(share) + ' %'
            return (
              <li key={row.code}>
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
      </div>
      {/* Encore des pays cachés : on en montre 10 de plus. Tous visibles
          (et plus de 10) : on peut revenir aux 10 premiers. */}
      {remaining > 0 && (
        <button type="button" className="button-secondary country-more" onClick={() => setVisible(visible + STEP)}>
          Afficher {Math.min(STEP, remaining)} pays de plus ({remaining} restants)
        </button>
      )}
      {remaining === 0 && rows.length > STEP && (
        <button type="button" className="button-secondary country-more" onClick={() => setVisible(STEP)}>
          Réduire la liste
        </button>
      )}
    </>
  )
}
