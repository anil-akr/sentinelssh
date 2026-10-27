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
              <td className="mono">{r.ip}</td>
              <td>{r.analyses_count}</td>
              <td>{r.total_failures}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
