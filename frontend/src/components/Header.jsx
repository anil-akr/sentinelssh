import { Link, useNavigate } from 'react-router-dom'
import { logout } from '../api.js'

// Bandeau du haut : titre, nom de l'administrateur, bouton Déconnexion.
export default function Header({ username }) {
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logout()
    } finally {
      // Même si le serveur ne répond pas, on quitte les pages protégées.
      navigate('/login', { replace: true })
    }
  }

  return (
    <header className="header">
      {/* Le logo ramène à la page de présentation. */}
      <Link to="/presentation" className="brand">
        {/* alt="" : image décorative, le nom est écrit juste à côté. */}
        <img src="/favicon.svg" alt="" width="28" height="28" />
        <span>SentinelSSH</span>
      </Link>
      <div className="header-user">
        <span className="header-username">{username}</span>
        <button type="button" className="button-secondary" onClick={handleLogout}>
          Déconnexion
        </button>
      </div>
    </header>
  )
}
