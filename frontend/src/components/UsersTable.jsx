import { Link } from 'react-router-dom'
import { formatDate } from '../format.js'

// Comptes enregistrés (page de l'administrateur, sans son propre compte).
// « Gérer » ouvre le profil d'un user ; un autre admin ne se gère pas ici
// (l'API répond 403).
export default function UsersTable({ users }) {
  if (users.length === 0) {
    return <p className="muted">Aucun autre compte pour l'instant.</p>
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Rôle</th>
            <th scope="col">Inscrit le</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              {/* data-label : nom de la colonne, affiché sur téléphone. */}
              <td data-label="Nom">{user.username}</td>
              <td data-label="Rôle">{user.role === 'admin' ? 'Administrateur' : 'Utilisateur'}</td>
              <td data-label="Inscrit le">{formatDate(user.created_at)}</td>
              <td data-label="Action">
                {user.role === 'admin' ? (
                  <span className="muted">—</span>
                ) : (
                  <Link to={`/comptes/${user.id}`} className="button-link button-link-secondary button-small">
                    Gérer
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
