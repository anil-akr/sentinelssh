import { formatDate } from '../format.js'

// Analyses d'un user vues par l'admin : date et nom du fichier, de quoi
// retrouver celle qu'il demande de supprimer. Pas de bouton « Voir » :
// l'admin ne peut pas lire une analyse (RGPD, D21).
export default function AnalysisRefsTable({ analyses, onDelete }) {
  if (analyses.length === 0) {
    return <p className="muted">Aucune analyse pour ce compte.</p>
  }

  function handleDelete(analysis) {
    if (window.confirm(`Supprimer l'analyse ${analysis.filename} de ce compte ?`)) {
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
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {analyses.map((analysis) => (
            <tr key={analysis.id}>
              {/* data-label : nom de la colonne, affiché sur téléphone. */}
              <td data-label="Date">{formatDate(analysis.created_at)}</td>
              <td data-label="Fichier" className="file-name">{analysis.filename}</td>
              <td data-label="Action">
                <button
                  type="button"
                  className="button-danger button-small"
                  onClick={() => handleDelete(analysis)}
                >
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
