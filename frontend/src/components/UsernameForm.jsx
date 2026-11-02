import { useState } from 'react'

// Formulaire « changer le nom d'utilisateur », ouvert dans une ligne de
// réglage (EditableRow). onSave(changes) envoie la modification à l'API
// (son compte ou, pour l'admin, celui d'un user).
// askCurrent : pour son propre compte, le mot de passe actuel est demandé ;
// l'admin qui renomme un user ne le connaît pas (false).
export default function UsernameForm({ currentUsername, askCurrent, onSave }) {
  const [username, setUsername] = useState(currentUsername)
  const [current, setCurrent] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault() // pas de rechargement de la page
    setMessage('')
    setError('')
    const changes = { username }
    if (askCurrent) {
      changes.current_password = current
    }
    try {
      await onSave(changes)
      setCurrent('') // un mot de passe ne reste pas affiché dans la page
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
      {askCurrent && (
        <>
          <label htmlFor="rename-password">Mot de passe actuel</label>
          <input
            id="rename-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </>
      )}
      <button type="submit">Enregistrer le nom</button>
      {/* role="status" : le lecteur d'écran annonce la réussite. */}
      {message && <p className="success" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  )
}
