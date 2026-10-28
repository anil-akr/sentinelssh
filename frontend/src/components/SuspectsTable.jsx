import { Fragment, useState } from 'react'
import { attackSeconds, countryName, formatDuration } from '../format.js'
import IpDetails from './IpDetails.jsx'
import SeverityBadge from './SeverityBadge.jsx'

// Tableau des IP suspectes, déjà triées par l'API (gravité puis échecs).
// Tout passe par le JSX { } : React échappe le texte, donc un nom de
// compte piégé comme <script> s'affiche sans s'exécuter (XSS).
export default function SuspectsTable({ suspects }) {
  // IP dont la fiche est ouverte (une seule à la fois), ou null.
  // La première IP (la plus grave) est ouverte au départ.
  const [openIp, setOpenIp] = useState(suspects.length > 0 ? suspects[0].ip : null)

  return (
    <div className="table-wrapper">
      <table className="suspects-table">
        <thead>
          <tr>
            <th scope="col">IP</th>
            <th scope="col">Gravité</th>
            <th scope="col">Échecs</th>
            <th scope="col">Durée</th>
            <th scope="col">Origine</th>
            <th scope="col">Règles</th>
            <th scope="col">Comptes visés</th>
            <th scope="col"><span className="visually-hidden">Fiche</span></th>
          </tr>
        </thead>
        <tbody>
          {suspects.map((s) => {
            const isOpen = openIp === s.ip
            return (
              // Fragment : deux <tr> par IP sans élément autour (interdit dans <tbody>).
              <Fragment key={s.ip}>
                <tr className={`row-${s.severity}${isOpen ? ' row-open' : ''}`}>
                  {/* data-label : nom de la colonne, affiché devant la valeur
                      sur téléphone, où chaque ligne devient une petite fiche. */}
                  <td className="mono" data-label="IP">{s.ip}</td>
                  <td data-label="Gravité"><SeverityBadge severity={s.severity} /></td>
                  <td data-label="Échecs">{s.failures}</td>
                  {/* Durée de la première à la dernière tentative de cette IP. */}
                  <td data-label="Durée">{formatDuration(attackSeconds(s.first_seen, s.last_seen))}</td>
                  <td data-label="Origine">{s.geo && s.geo.country_code ? countryName(s.geo) : <span className="muted">—</span>}</td>
                  <td data-label="Règles">{s.rules.join(', ')}</td>
                  <td data-label="Comptes visés">{s.users.join(', ')}</td>
                  <td data-label="Fiche">
                    <button
                      type="button"
                      className="button-secondary button-small"
                      aria-expanded={isOpen}
                      onClick={() => setOpenIp(isOpen ? null : s.ip)}
                    >
                      {isOpen ? 'Masquer' : 'Détails'}
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr className={`details-row row-${s.severity}`}>
                    <td colSpan={8}>
                      <IpDetails suspect={s} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
