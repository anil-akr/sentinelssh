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
  const [error, setError] = useState('')

  useEffect(() => {
    me()
      .then((data) => {
        setUsername(data.username)
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
    return <Navigate to="/login" replace />
  }
  if (status === 'error') {
    return <p className="page error" role="alert">{error}</p>
  }
  return (
    <>
      <Header username={username} />
      {/* Outlet = la page protégée demandée (HomePage ou AnalysisPage). */}
      <Outlet />
    </>
  )
}
