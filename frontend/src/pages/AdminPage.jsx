import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { listUsers } from '../api.js'
import AccountPrompt from '../components/AccountPrompt.jsx'
import UsersTable from '../components/UsersTable.jsx'

// Comptes (/comptes, administrateur) : son propre compte en haut, à part,
// puis les autres comptes enregistrés. Un simple utilisateur qui tape
// cette adresse reçoit le message 403 de l'API.
export default function AdminPage() {
  // Le compte connecté, transmis par ProtectedRoute (<Outlet context>).
  const { username, role } = useOutletContext()
  const [users, setUsers] = useState(null) // null = pas encore chargé
  const [error, setError] = useState('')

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch((err) => setError(err.message))
  }, [])

  // Son propre compte est retiré de la liste : il a son bloc à lui.
  let others = null
  if (users !== null) {
    others = users.filter((user) => user.username !== username)
  }

  return (
    <main className="page">
      <h1>Comptes</h1>
      {error && <p className="error" role="alert">{error}</p>}

      <section className="card own-account">
        <h2>Mon compte</h2>
        <div className="own-account-row">
          <AccountPrompt username={username} role={role} />
          <Link to="/compte" className="button-link button-link-secondary button-small">
            Ouvrir mon profil
          </Link>
        </div>
      </section>

      <section className="card">
        <h2>Comptes enregistrés</h2>
        <p className="muted section-help">
          Vous gérez le nom, le mot de passe et la suppression des comptes utilisateurs ;
          leurs analyses restent privées.
        </p>
        {others === null && !error && <p>Chargement…</p>}
        {others !== null && <UsersTable users={others} />}
      </section>
    </main>
  )
}
