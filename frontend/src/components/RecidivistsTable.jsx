// Tableau des IP vues dans au moins 2 analyses.
export default function RecidivistsTable({ recidivists }) {
  if (recidivists.length === 0) {
    return <p className="muted">Aucune IP récidiviste pour l'instant.</p>
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th scope="col">IP</th>
            <th scope="col">Analyses</th>
            <th scope="col">Échecs au total</th>
          </tr>
        </thead>
        <tbody>
          {recidivists.map((r) => (
            <tr key={r.ip}>
              {/* data-label : nom de la colonne, affiché sur téléphone. */}
              <td className="mono" data-label="IP">{r.ip}</td>
              <td data-label="Analyses">{r.analyses_count}</td>
              <td data-label="Échecs au total">{r.total_failures}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
