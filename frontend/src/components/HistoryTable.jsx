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
              <td>{formatDate(analysis.created_at)}</td>
              <td>{analysis.filename}</td>
              <td>{analysis.suspect_count}</td>
              <td>{analysis.critical_count}</td>
              <td>
                {/* div : un <td> en flex casserait l'alignement du tableau. */}
                <div className="actions">
                  <Link to={`/analyses/${analysis.id}`}>Voir</Link>
                  <button
                    type="button"
                    className="button-danger"
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
