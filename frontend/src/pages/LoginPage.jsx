import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api.js'

// Page de connexion : envoie nom + mot de passe, puis ouvre l'accueil.
export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault() // pas de rechargement de la page
    setError('')
    try {
      await login(username, password)
      navigate('/analyse', { replace: true })
    } catch (err) {
      // Message de l'API, ex. « Identifiants incorrects ».
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
        <h1>SentinelSSH</h1>
        <p className="muted">
          Connectez-vous pour analyser les journaux SSH de vos serveurs.
        </p>

        <label htmlFor="username">Nom d'utilisateur</label>
        <input
          id="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <label htmlFor="password">Mot de passe</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">Se connecter</button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
      <p className="login-link">
        Pas encore de compte ? <Link to="/inscription">Créer un compte</Link> · <Link to="/confidentialite">Confidentialité</Link>
      </p>
    </main>
  )
}
