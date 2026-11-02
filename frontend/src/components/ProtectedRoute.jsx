import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { me } from '../api.js'
import Header from './Header.jsx'

// Vérifie la session (me) avant d'afficher une page protégée.
// status : 'loading' → 'ok' (connecté), 'denied' (pas de session)
// ou 'error' (serveur injoignable).
export default function ProtectedRoute() {
  const [status, setStatus] = useState('loading')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    me()
      .then((data) => {
        setUsername(data.username)
        setRole(data.role)
        setStatus('ok')
      })
      .catch((err) => {
        if (err.message === 'Connexion requise') {
          setStatus('denied')
        } else {
          setError(err.message)
          setStatus('error')
        }
      })
  }, [])

  if (status === 'loading') {
    return <p className="page">Chargement…</p>
  }
  if (status === 'denied') {
    // Visiteur non connecté qui demande une page protégée : il voulait
    // analyser, on l'envoie se connecter (comme api.js après un 401).
    return <Navigate to="/login" replace />
  }
  if (status === 'error') {
    return <p className="page error" role="alert">{error}</p>
  }
  return (
    <>
      <Header username={username} role={role} />
      {/* Outlet = la page protégée demandée. context : le compte connecté,
          lu par la page avec useOutletContext ; setUsername permet à la page
          « Mon compte » de mettre le bandeau à jour après un changement. */}
      <Outlet context={{ username, role, setUsername }} />
    </>
  )
}
