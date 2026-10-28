import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteMyAccount } from '../api.js'

// Suppression de son propre compte (droit à l'effacement, RGPD).
// Le mot de passe est redemandé, puis une confirmation.
export default function DeleteAccountForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault() // pas de rechargement de la page
    setError('')
    if (!window.confirm('Supprimer définitivement votre compte et toutes vos analyses ?')) {
      return
    }
    try {
      await deleteMyAccount(password)
      navigate('/', { replace: true })
    } catch (err) {
      // Message de l'API, ex. « Mot de passe incorrect ».
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="delete-password">Votre mot de passe, pour confirmer</label>
      {/* Champ et bouton côte à côte (l'un sous l'autre sur téléphone). */}
      <div className="danger-inline">
        <input
          id="delete-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="button-danger delete-account-button">
          Supprimer mon compte
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  )
}
