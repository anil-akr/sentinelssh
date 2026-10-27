import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { me } from '../api.js'
import SeverityBadge from '../components/SeverityBadge.jsx'
import SeverityLegend from '../components/SeverityLegend.jsx'

// Extrait d'un journal SSH montré en exemple. Adresses de documentation
// (203.0.113.x, réservées aux exemples) : aucune vraie IP.
const LOG_LINES = [
  'Oct 26 02:30:05 srv sshd[812]: Failed password for root from 203.0.113.20',
  'Oct 26 02:30:09 srv sshd[812]: Failed password for admin from 203.0.113.20',
  'Oct 26 02:30:14 srv sshd[812]: Failed password for invalid user test from 203.0.113.20',
  'Oct 26 02:30:18 srv sshd[812]: Failed password for root from 203.0.113.20',
  'Oct 26 02:30:22 srv sshd[812]: Failed password for ubuntu from 203.0.113.20',
  'Oct 26 02:30:31 srv sshd[812]: Accepted password for ubuntu from 203.0.113.20',
]

// Les étapes d'une analyse, dans l'ordre (d'où la liste numérotée <ol>).
const STEPS = [
  {
    title: 'Envoyer le journal',
    text: 'L\'administrateur envoie le fichier auth.log du serveur (.log ou .txt, 5 Mo maximum).',
  },
  {
    title: 'Analyser',
    text: 'SentinelSSH lit chaque tentative de connexion et applique 3 règles de détection à chaque adresse IP.',
  },
  {
    title: 'Réagir',
    text: 'Les IP suspectes sont classées par gravité, situées sur une carte, avec une commande de blocage prête à copier.',
  },
]

// Garanties de l'application (sécurité et RGPD).
const PROMISES = [
  {
    title: 'Tout reste en local',
    text: 'L\'application tourne sur 127.0.0.1 : aucune donnée n\'est envoyée à un service extérieur, même la géolocalisation.',
  },
  {
    title: 'Le fichier n\'est jamais enregistré',
    text: 'Il est analysé en mémoire puis oublié. Seules les IP suspectes sont gardées, 30 jours au plus.',
  },
  {
    title: 'L\'humain décide',
    text: 'La commande de blocage est proposée, jamais exécutée : c\'est l\'administrateur qui choisit de bloquer.',
  },
  {
    title: 'Accès protégé',
    text: 'Un seul compte administrateur, mot de passe haché ; les résultats ne sont visibles qu\'après connexion.',
  },
]

// Page publique de présentation : ce que fait SentinelSSH, puis la connexion.
export default function LandingPage() {
  // L'administrateur est-il déjà connecté ? On demande à l'API (me).
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    me()
      .then(() => setConnected(true))
      // Pas de session (ou serveur injoignable) : on garde « Se connecter ».
      .catch(() => setConnected(false))
  }, [])

  // Bouton principal : vers l'application si connecté, sinon vers la connexion.
  let mainLink = { to: '/login', label: 'Se connecter' }
  if (connected) {
    mainLink = { to: '/', label: 'Ouvrir l\'application' }
  }

  return (
    <main className="page landing">
      <section className="hero">
        <div className="hero-text">
          <div className="hero-brand">
            {/* alt="" : image décorative, le nom est écrit juste à côté. */}
            <img src="/favicon.svg" alt="" width="36" height="36" />
            <span>SentinelSSH</span>
          </div>
          <h1>Repérez les attaques SSH cachées dans vos journaux.</h1>
          <p className="hero-lead">
            Chaque jour, des robots essaient des milliers de mots de passe sur les
            serveurs ouverts à Internet. SentinelSSH lit le journal du serveur,
            repère les adresses IP qui attaquent, leur donne une gravité et
            propose une commande pour les bloquer.
          </p>
          <div className="hero-actions">
            {/* Link avec l'apparence d'un bouton : c'est une navigation, pas une action. */}
            <Link to={mainLink.to} className="button-link">{mainLink.label}</Link>
            <a href="#fonctionnement" className="button-link button-link-secondary">Comment ça marche</a>
          </div>
        </div>

        {/* Exemple : 5 échecs puis une réussite de la même IP = règle R3. */}
        <figure className="log-sample">
          <figcaption className="muted">Extrait d'un journal auth.log</figcaption>
          <pre>
            {LOG_LINES.map((line) => (
              // La ligne « Accepted » (connexion réussie) est mise en avant.
              <span key={line} className={line.includes('Accepted') ? 'log-line log-accepted' : 'log-line'}>
                {line}
              </span>
            ))}
          </pre>
          <p className="log-verdict">
            <span className="mono">203.0.113.20</span>
            <SeverityBadge severity="critique" />
            <span className="muted">5 échecs, puis une connexion réussie</span>
          </p>
        </figure>
      </section>

      <section id="fonctionnement" className="card">
        <h2>Comment ça marche</h2>
        <ol className="steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="step-number">{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2>Les 3 niveaux de gravité</h2>
        <p className="muted section-help">
          Une IP qui déclenche plusieurs règles prend la gravité la plus haute.
        </p>
        <SeverityLegend />
      </section>

      <section className="card">
        <h2>Ce que SentinelSSH garantit</h2>
        <ul className="promises">
          {PROMISES.map((promise) => (
            <li key={promise.title}>
              <h3>{promise.title}</h3>
              <p>{promise.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="landing-footer muted">
        <p>
          Projet de fin d'année, Holberton School Bordeaux, 2026. Python et Flask,
          SQLite, React.
        </p>
        <p>
          <Link to={mainLink.to}>{mainLink.label}</Link> ·<Link to="/confidentialite">Confidentialité</Link>
        </p>
      </footer>
    </main>
  )
}
