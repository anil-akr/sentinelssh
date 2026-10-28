import { useState } from 'react'

// Formulaire « changer le nom d'utilisateur », ouvert dans une ligne de
// réglage (EditableRow). onSave(changes) envoie la modification à l'API
// (son compte ou, pour l'admin, celui d'un user).
export default function UsernameForm({ currentUsername, onSave }) {
  const [username, setUsername] = useState(currentUsername)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault() // pas de rechargement de la page
    setMessage('')
    setError('')
    try {
      await onSave({ username })
      setMessage('Nom d\'utilisateur modifié.')
    } catch (err) {
      // Message de l'API, ex. « Ce nom d'utilisateur est déjà pris ».
      setError(err.message)
    }
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <label htmlFor="new-username">Nouveau nom</label>
      <input
        id="new-username"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        pattern="[A-Za-z0-9._\-]{3,30}"
        title="3 à 30 caractères : lettres sans accent, chiffres, point, tiret, tiret bas"
        required
      />
      <button type="submit">Enregistrer le nom</button>
      {/* role="status" : le lecteur d'écran annonce la réussite. */}
      {message && <p className="success" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  )
}
