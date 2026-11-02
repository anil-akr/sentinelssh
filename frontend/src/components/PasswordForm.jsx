import { useState } from 'react'

// Formulaire « changer le mot de passe », ouvert dans une ligne de
// réglage (EditableRow).
// askCurrent : pour son propre compte, l'ancien mot de passe est demandé ;
// l'admin qui réinitialise celui d'un user ne le connaît pas (false).
export default function PasswordForm({ askCurrent, onSave }) {
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault() // pas de rechargement de la page
    setMessage('')
    setError('')
    if (password !== confirm) {
      setError('Les deux mots de passe ne sont pas identiques.')
      return
    }
    const changes = { password }
    if (askCurrent) {
      changes.current_password = current
    }
    try {
      await onSave(changes)
      // Champs vidés : un mot de passe ne reste pas affiché dans la page.
      setCurrent('')
      setPassword('')
      setConfirm('')
      setMessage(askCurrent ? 'Mot de passe modifié.' : 'Mot de passe réinitialisé.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      {askCurrent && (
        <>
          <label htmlFor="current-password">Mot de passe actuel</label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </>
      )}
      <label htmlFor="new-password">Nouveau mot de passe</label>
      <input
        id="new-password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={12}
        maxLength={128}
        required
      />
      <label htmlFor="confirm-password">Confirmer le nouveau mot de passe</label>
      <input
        id="confirm-password"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
      />
      <button type="submit">
        {askCurrent ? 'Enregistrer le mot de passe' : 'Réinitialiser le mot de passe'}
      </button>
      {message && <p className="success" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  )
}
