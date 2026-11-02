import { attackSeconds, formatDuration, formatLogTime, parseLogTime, totalFailures } from '../format.js'
import SeverityBadge from './SeverityBadge.jsx'

// Verdict de l'analyse : un titre et une phrase pour la gravité la plus
// haute. L'API trie déjà les IP (critique d'abord), donc la première IP
// donne la gravité la plus haute.
const VERDICTS = {
  critique: {
    title: 'Compromission possible',
    text: 'Au moins une IP a réussi à se connecter après une série d\'échecs. Vérifiez ces comptes en priorité.',
  },
  elevee: {
    title: 'Force brute rapide détectée',
    text: 'Des IP ont enchaîné les échecs en moins d\'une minute. Bloquez-les avec la commande proposée.',
  },
  moyenne: {
    title: 'Attaques persistantes à surveiller',
    text: 'Des IP échouent souvent, mais lentement. Aucun blocage proposé pour l\'instant.',
  },
  aucune: {
    title: 'Rien de suspect',
    text: 'Aucune IP suspecte dans ce fichier.',
  },
}

// Verdict + chiffres clés d'une analyse.
export default function SummaryCards({ analysis }) {
  const suspects = analysis.suspects
  const worst = suspects.length > 0 ? suspects[0].severity : 'aucune'
  const verdict = VERDICTS[worst]

  // Nombre d'IP par gravité, pour les pastilles du verdict.
  const counts = { critique: 0, elevee: 0, moyenne: 0 }
  for (const s of suspects) {
    counts[s.severity] += 1
  }

  // Pays d'origine : un Set ne garde chaque code pays qu'une seule fois.
  const countries = new Set()
  for (const s of suspects) {
    if (s.geo && s.geo.country_code) {
      countries.add(s.geo.country_code)
    }
  }

  const failures = totalFailures(suspects)

  // Période des attaques : la première tentative et la dernière, toutes
  // IP confondues. On compare des dates (parseLogTime), pas du texte.
  let first = null
  let last = null
  for (const s of suspects) {
    if (first === null || parseLogTime(s.first_seen) < parseLogTime(first)) {
      first = s.first_seen
    }
    if (last === null || parseLogTime(s.last_seen) > parseLogTime(last)) {
      last = s.last_seen
    }
  }

  // Gravités à afficher dans le verdict, de la plus grave à la moins grave,
  // sans celles qui n'ont aucune IP.
  const shownSeverities = []
  for (const severity of ['critique', 'elevee', 'moyenne']) {
    if (counts[severity] > 0) {
      shownSeverities.push(severity)
    }
  }

  const figures = [
    { label: 'lignes lues', value: analysis.total_lines },
    { label: 'lignes ignorées', value: analysis.ignored_lines },
    { label: 'IP suspectes', value: analysis.suspect_count },
    { label: 'échecs de connexion', value: failures },
    { label: 'pays d\'origine', value: countries.size },
    { label: 'alertes critiques', value: analysis.critical_count },
  ]

  return (
    <>
      {/* La classe donne la couleur du bandeau (verdict-critique, etc.). */}
      <section className={`verdict verdict-${worst}`}>
        <div>
          <h2>{verdict.title}</h2>
          <p>{verdict.text}</p>
          {first !== null && (
            <p className="verdict-period">
              {/* {' '} : espace forcé, car JSX supprime l'espace en fin de ligne. */}
              {failures.toLocaleString('fr-FR')} échecs en{' '}
              <strong>{formatDuration(attackSeconds(first, last))}</strong>, du{' '}
              {formatLogTime(first)} au {formatLogTime(last)}.
            </p>
          )}
        </div>
        {suspects.length > 0 && (
          <ul className="verdict-counts" aria-label="IP par gravité">
            {shownSeverities.map((severity) => (
              <li key={severity}>
                <span className="verdict-count">{counts[severity]}</span>
                <SeverityBadge severity={severity} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <dl className="summary">
        {figures.map((figure) => (
          <div className="summary-item" key={figure.label}>
            <dt>{figure.label}</dt>
            {/* toLocaleString : « 1240 » s'affiche « 1 240 ». */}
            <dd>{figure.value.toLocaleString('fr-FR')}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}
