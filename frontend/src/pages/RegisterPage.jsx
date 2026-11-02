import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api.js'

// Page d'inscription : nom + mot de passe (pas d'e-mail, D20). Le compte
// créé est toujours un simple « user » ; la session s'ouvre directement.
export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault() // pas de rechargement de la page
    setError('')
    // Vérifiée ici seulement : l'API n'a besoin que du mot de passe.
    if (password !== confirm) {
      setError('Les deux mots de passe ne sont pas identiques.')
      return
    }
    try {
      await register(username, password)
      navigate('/analyse', { replace: true })
    } catch (err) {
      // Message de l'API, ex. « Ce nom d'utilisateur est déjà pris ».
      setError(err.message)
    }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={handleSubmit}>
        {/* Le logo ramène à la page de présentation. */}
        <Link to="/" aria-label="Présentation de SentinelSSH">
          <img src="/favicon.svg" alt="" width="40" height="40" />
        </Link>
        <h1>Créer un compte</h1>
        <p className="muted">
          Un nom et un mot de passe suffisent : aucune adresse e-mail n'est demandée.
        </p>

        {/* pattern et minLength : le navigateur prévient tout de suite ;
            l'API refait les mêmes vérifications (on ne fait jamais
            confiance au navigateur). */}
        <label htmlFor="username">Nom d'utilisateur</label>
        <input
          id="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          pattern="[A-Za-z0-9._\-]{3,30}"
          title="3 à 30 caractères : lettres sans accent, chiffres, point, tiret, tiret bas"
          aria-describedby="username-help"
          required
        />
        <p id="username-help" className="muted field-help">
          3 à 30 caractères : lettres sans accent, chiffres, . - _
        </p>

        <label htmlFor="password">Mot de passe</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={12}
          maxLength={128}
          aria-describedby="password-help"
          required
        />
        <p id="password-help" className="muted field-help">12 à 128 caractères.</p>

        <label htmlFor="confirm">Confirmer le mot de passe</label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        <button type="submit">Créer mon compte</button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
      <p className="login-link">
        Déjà un compte ? <Link to="/login">Se connecter</Link> · <Link to="/confidentialite">Confidentialité</Link>
      </p>
    </main>
  )
}
