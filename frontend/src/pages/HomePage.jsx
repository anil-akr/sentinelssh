import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteAnalysis, listAnalyses, listRecidivists } from '../api.js'
import HistoryTable from '../components/HistoryTable.jsx'
import RecidivistsTable from '../components/RecidivistsTable.jsx'
import UploadForm from '../components/UploadForm.jsx'

// Accueil : envoi d'un fichier, historique des analyses, IP récidivistes.
export default function HomePage() {
  const [analyses, setAnalyses] = useState(null) // null = pas encore chargé
  const [recidivists, setRecidivists] = useState(null)
  const [error, setError] = useState('')

  // Charge l'historique et les récidivistes (au début et après suppression).
  const loadData = useCallback(() => {
    return Promise.all([listAnalyses(), listRecidivists()])
      .then(([analysesData, recidivistsData]) => {
        setAnalyses(analysesData)
        setRecidivists(recidivistsData)
        setError('')
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleDelete(id) {
    try {
      await deleteAnalysis(id)
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <main className="page">
      <section className="card upload-card">
        <h1>Analyser un journal SSH</h1>
        <p className="muted">
          Envoyez un fichier auth.log : SentinelSSH repère les IP qui attaquent
          le serveur et propose une commande pour les bloquer.
        </p>
        <UploadForm />
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="home-grid">
        <section className="card">
          <h2>Historique des analyses</h2>
          {analyses === null && !error && <p>Chargement…</p>}
          {analyses !== null && (
            <HistoryTable analyses={analyses} onDelete={handleDelete} />
          )}
        </section>

        <section className="card">
          <h2>IP récidivistes</h2>
          <p className="muted section-help">IP vues dans au moins 2 analyses.</p>
          {recidivists === null && !error && <p>Chargement…</p>}
          {recidivists !== null && <RecidivistsTable recidivists={recidivists} />}
        </section>
      </div>

      <footer className="footer">
        <Link to="/confidentialite">Confidentialité</Link>
      </footer>
    </main>
  )
}
