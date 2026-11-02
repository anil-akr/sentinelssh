import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteAnalysis, listAnalyses, listRecidivists } from '../api.js'
import HistoryTable from '../components/HistoryTable.jsx'
import LogFileHelp from '../components/LogFileHelp.jsx'
import RecidivistsTable from '../components/RecidivistsTable.jsx'
import SeverityLegend from '../components/SeverityLegend.jsx'
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

  // Vue d'ensemble : on additionne les chiffres de toutes les analyses.
  let totalLines = 0
  let totalSuspects = 0
  let totalCritical = 0
  if (analyses !== null) {
    for (const analysis of analyses) {
      totalLines += analysis.total_lines
      totalSuspects += analysis.suspect_count
      totalCritical += analysis.critical_count
    }
  }

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
          Envoyez le journal SSH de votre serveur (auth.log ou secure) : SentinelSSH
          repère les IP qui attaquent le serveur et propose une commande pour les bloquer.
        </p>
        <UploadForm />
        <LogFileHelp />
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      {analyses !== null && (
        <section aria-label="Vue d'ensemble">
          <ul className="overview">
            <li>
              <strong>{analyses.length}</strong>
              <span>analyses gardées</span>
            </li>
            <li>
              {/* toLocaleString : « 1240 » s'affiche « 1 240 ». */}
              <strong>{totalLines.toLocaleString('fr-FR')}</strong>
              <span>lignes lues</span>
            </li>
            <li>
              <strong>{totalSuspects}</strong>
              <span>IP suspectes</span>
            </li>
            {/* Trait rouge en haut seulement s'il y a au moins une alerte critique. */}
            <li className={totalCritical > 0 ? 'overview-critique' : ''}>
              <strong>{totalCritical}</strong>
              <span>alertes critiques</span>
            </li>
          </ul>
          <p className="muted overview-note">
            Les analyses de plus de 30 jours sont supprimées à chaque démarrage du site.
          </p>
        </section>
      )}

      {/* 2 cases côte à côte, de la même hauteur : l'historique (qui défile
          au-delà de 70 % de l'écran) et les récidivistes (qui remplissent
          la hauteur de l'historique et défilent). */}
      <div className="home-grid">
        <section className="card">
          <h2>Historique des analyses</h2>
          {analyses === null && !error && <p>Chargement…</p>}
          {analyses !== null && (
            <div className="scroll-list">
              <HistoryTable analyses={analyses} onDelete={handleDelete} />
            </div>
          )}
        </section>

        <section className="card card-fill">
          <h2>IP récidivistes</h2>
          <p className="muted section-help">IP vues dans au moins 2 analyses.</p>
          {recidivists === null && !error && <p>Chargement…</p>}
          {recidivists !== null && (
            <div className="fill">
              <RecidivistsTable recidivists={recidivists} />
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Les 3 niveaux de gravité</h2>
        <SeverityLegend />
      </section>

      <footer className="footer">
        <Link to="/confidentialite">Confidentialité</Link>
      </footer>
    </main>
  )
}
