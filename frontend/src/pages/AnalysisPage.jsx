import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAnalysis } from '../api.js'
import CountryList from '../components/CountryList.jsx'
import SeverityLegend from '../components/SeverityLegend.jsx'
import SummaryCards from '../components/SummaryCards.jsx'
import SuspectsTable from '../components/SuspectsTable.jsx'
import TopIpsChart from '../components/TopIpsChart.jsx'
import WorldMap from '../components/WorldMap.jsx'

// Détail d'une analyse : verdict, chiffres, carte, graphique, tableau.
export default function AnalysisPage() {
  const { id } = useParams() // l'id vient de l'adresse /analyses/:id
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getAnalysis(id)
      .then((data) => setAnalysis(data))
      .catch((err) => setError(err.message)) // ex. « Analyse introuvable »
      .finally(() => setLoading(false))
  }, [id])

  return (
    <main className="page">
      <Link to="/" className="back-link">← Retour à l'accueil</Link>

      {loading && <p>Chargement…</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {analysis && (
        <>
          <h1>
            {analysis.filename}
            <span className="title-detail">
              Analyse n°{analysis.id}, faite le{' '}
              {new Date(analysis.created_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
            </span>
          </h1>
          <SummaryCards analysis={analysis} />

          {/* Sans IP suspecte, le verdict suffit : ni carte ni tableau. */}
          {analysis.suspects.length > 0 && (
            <>
              <div className="map-grid">
                <section className="card">
                  <h2>Origine des attaques</h2>
                  <p className="muted section-help">
                    Un point par IP suspecte ; plus il est gros, plus l'IP a échoué. Survolez un pays colorié ou un point pour voir ses IP.
                    Molette, double-clic ou boutons pour zoomer ; glisser pour déplacer la carte.
                  </p>
                  <WorldMap suspects={analysis.suspects} />
                  {/* Attribution exigée par la licence CC BY 4.0 de DB-IP. */}
                  <p className="attribution">
                    <a href="https://db-ip.com" target="_blank" rel="noreferrer">IP Geolocation by DB-IP</a>
                  </p>
                </section>
                <section className="card">
                  <h2>Pays d'origine</h2>
                  <p className="muted section-help">Classés par nombre d'échecs.</p>
                  <CountryList suspects={analysis.suspects} />
                </section>
              </div>

              <section className="card">
                <h2>Top 10 des IP par nombre d'échecs</h2>
                <p className="muted section-help">Couleur de la barre : gravité de l'IP.</p>
                <TopIpsChart suspects={analysis.suspects} />
              </section>

              <section className="card">
                <h2>Niveaux de gravité</h2>
                <p className="muted section-help">
                  Une IP qui déclenche plusieurs règles prend la gravité la plus haute.
                </p>
                <SeverityLegend />
              </section>

              <section className="card">
                <h2>IP suspectes</h2>
                <p className="muted section-help">
                  Triées de la plus grave à la moins grave. « Détails » ouvre la fiche de l'IP :
                  localisation, opérateur, durée de l'attaque et réaction conseillée.
                </p>
                <SuspectsTable suspects={analysis.suspects} />
              </section>
            </>
          )}
        </>
      )}
    </main>
  )
}
