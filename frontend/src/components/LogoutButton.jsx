import { useNavigate } from 'react-router-dom'
import { logout } from '../api.js'

// Bouton Déconnexion : ferme la session puis ouvre la page de connexion.
// Utilisé par le bandeau (Header) et par la page de présentation.
export default function LogoutButton() {
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logout()
    } finally {
      // Même si le serveur ne répond pas, on quitte la session côté site.
      navigate('/login', { replace: true })
    }
  }

  return (
    <button type="button" className="button-secondary" onClick={handleLogout}>
      Déconnexion
    </button>
  )
}
