import { Link } from 'react-router-dom'

// Date ISO de l'API (« 2026-10-12T14:30:00 ») → « 12/10 14:30 ».
function formatDate(iso) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

// Tableau des analyses passées, avec Voir et Supprimer.
export default function HistoryTable({ analyses, onDelete }) {
  if (analyses.length === 0) {
    return <p className="muted">Aucune analyse pour l'instant.</p>
  }

  function handleDelete(analysis) {
    // Confirmation avant suppression : l'action est définitive.
    if (window.confirm(`Supprimer l'analyse de ${analysis.filename} ?`)) {
      onDelete(analysis.id)
    }
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Fichier</th>
            <th scope="col">IP suspectes</th>
            <th scope="col">Critiques</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {analyses.map((analysis) => (
            <tr key={analysis.id}>
              {/* data-label : nom de la colonne, affiché devant la valeur sur
                  téléphone, où chaque ligne devient une petite fiche. */}
              <td data-label="Date">{formatDate(analysis.created_at)}</td>
              <td data-label="Fichier" className="file-name">{analysis.filename}</td>
              <td data-label="IP suspectes">{analysis.suspect_count}</td>
              <td data-label="Critiques">{analysis.critical_count}</td>
              <td data-label="Actions">
                {/* div : un <td> en flex casserait l'alignement du tableau. */}
                <div className="actions">
                  {/* Mêmes petites tailles : au survol, les deux boutons se
                      remplissent à la même hauteur. */}
                  <Link to={`/analyses/${analysis.id}`} className="button-link button-link-secondary button-small">
                    Voir
                  </Link>
                  <button
                    type="button"
                    className="button-danger button-small"
                    onClick={() => handleDelete(analysis)}
                  >
                    Supprimer
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
