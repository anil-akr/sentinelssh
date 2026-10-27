// Texte affiché pour chaque valeur de gravité renvoyée par l'API.
const LABELS = { moyenne: 'Moyenne', elevee: 'Élevée', critique: 'Critique' }

// Pastille de gravité : couleur ET texte (lisible sans voir les couleurs).
export default function SeverityBadge({ severity }) {
  return (
    <span className={`badge badge-${severity}`}>
      {LABELS[severity] || severity}
    </span>
  )
}
