import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { me } from '../api.js'
import SeverityBadge from '../components/SeverityBadge.jsx'
import AccountPrompt from '../components/AccountPrompt.jsx'
import LogoutButton from '../components/LogoutButton.jsx'
import SeverityLegend from '../components/SeverityLegend.jsx'

// Extrait d'un journal SSH montré en exemple. Adresses de documentation
// (203.0.113.x, réservées aux exemples) : aucune vraie IP.
const LOG_LINES = [
  'Oct 26 02:30:05 srv sshd[812]: Failed password for root from 203.0.113.20 port 52214 ssh2',
  'Oct 26 02:30:09 srv sshd[812]: Failed password for admin from 203.0.113.20 port 52230 ssh2',
  'Oct 26 02:30:14 srv sshd[812]: Failed password for invalid user test from 203.0.113.20 port 52241 ssh2',
  'Oct 26 02:30:18 srv sshd[812]: Failed password for root from 203.0.113.20 port 52256 ssh2',
  'Oct 26 02:30:22 srv sshd[812]: Failed password for ubuntu from 203.0.113.20 port 52263 ssh2',
  'Oct 26 02:30:31 srv sshd[812]: Accepted password for ubuntu from 203.0.113.20 port 52270 ssh2',
]

// Les étapes d'une analyse, dans l'ordre (d'où la liste numérotée <ol>).
const STEPS = [
  {
    title: 'Envoyer le journal',
    text: 'Créez un compte, puis envoyez depuis votre navigateur le journal SSH de votre serveur Linux (auth.log ou secure, .log ou .txt, 50 Mo maximum).',
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

// Mesures de sécurité du site (D20, D22). threat : l'attaque dont la
// mesure protège ; tech : la technologie qui la contre. Rien n'est promis
// qui ne soit codé et testé (pas encore de HTTPS : le site n'est pas en
// ligne).
const SECURITY = [
  {
    title: 'Base de données chiffrée',
    text: 'Tout ce que le site enregistre est chiffré. Sans la clé, gardée à part sur le serveur, une copie de la base est illisible.',
    threat: 'vol ou fuite de la base',
    tech: 'SQLCipher (AES 256)',
  },
  {
    title: 'Mots de passe hachés',
    text: 'Votre mot de passe n\'est jamais enregistré : il est haché, transformé en un code d\'où on ne peut pas le retrouver. 12 caractères minimum.',
    threat: 'fuite des mots de passe',
    tech: 'scrypt (Werkzeug)',
  },
  {
    title: 'Session protégée',
    text: 'Le cookie de connexion est inaccessible aux scripts et aux autres sites. Il expire après 60 minutes d\'inactivité.',
    threat: 'vol de session, CSRF',
    tech: 'cookie HttpOnly et SameSite',
  },
  {
    title: 'Force brute freinée',
    text: 'Après 5 mots de passe faux en 15 minutes, l\'adresse IP est bloquée : SentinelSSH se protège des attaques qu\'il détecte.',
    threat: 'force brute',
    tech: 'limite par adresse IP',
  },
  {
    title: 'Comptes cloisonnés',
    text: 'Chaque compte ne voit que ses propres analyses. L\'administrateur gère les comptes, sans jamais lire leur contenu.',
    threat: 'accès aux données d\'un autre compte (IDOR)',
    tech: 'filtre SQL par compte',
  },
  {
    title: 'Injections bloquées',
    text: 'Votre journal est toujours traité comme du simple texte : il ne peut devenir ni du code SQL, ni une page, ni une commande.',
    threat: 'injection SQL, XSS, injection de commande',
    tech: 'requêtes paramétrées, React, ipaddress',
  },
]

// Garanties sur les données personnelles (RGPD).
const PROMISES = [
  {
    title: 'Aucun service extérieur',
    text: 'Vos journaux ne sont transmis à aucun tiers. Même la géolocalisation est faite par SentinelSSH, avec une base installée sur son propre serveur.',
  },
  {
    title: 'Le fichier n\'est jamais enregistré',
    text: 'Il est analysé en mémoire, sans fichier temporaire, puis oublié. Seules les IP suspectes sont gardées : pour rouvrir vos analyses et repérer les récidivistes, ces IP qui reviennent d\'un journal à l\'autre. Elles sont supprimées après 30 jours (au démarrage du site).',
  },
  {
    title: 'L\'humain décide',
    text: 'La commande de blocage est proposée, jamais exécutée : c\'est vous qui choisissez de bloquer, sur votre serveur.',
  },
  {
    title: 'Vos analyses restent à vous',
    text: 'Elles ne servent qu\'à vous. Vous les supprimez quand vous voulez, comme votre compte, et aucune adresse e-mail n\'est demandée.',
  },
]

// Page publique de présentation : ce que fait SentinelSSH, puis l'inscription.
export default function LandingPage() {
  // Le visiteur est-il déjà connecté ? On demande à l'API (me).
  // account : le compte connecté, ou null.
  const [account, setAccount] = useState(null)
  const connected = account !== null

  useEffect(() => {
    me()
      .then(setAccount)
      // Pas de session (ou serveur injoignable) : on garde « Se connecter ».
      .catch(() => setAccount(null))
  }, [])

  // Bouton principal : vers ses analyses si connecté, sinon l'inscription.
  let mainLink = { to: '/inscription', label: 'Créer un compte' }
  if (connected) {
    mainLink = { to: '/analyse', label: 'Analyser un journal' }
  }

  return (
    <main className="page landing">
      {/* Connecté seulement : le compte et le bouton Déconnexion, en haut
          à droite (pas tout le bandeau : la page reste une présentation). */}
      {connected && (
        <div className="landing-top">
          <AccountPrompt username={account.username} role={account.role} to="/compte" />
          <LogoutButton />
        </div>
      )}
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
            serveurs ouverts à Internet. Envoyez le journal de votre serveur :
            SentinelSSH repère les adresses IP qui attaquent, leur donne une
            gravité et propose une commande pour les bloquer.
          </p>
          <div className="hero-actions">
            {/* Link avec l'apparence d'un bouton : c'est une navigation, pas une action. */}
            <Link to={mainLink.to} className="button-link">{mainLink.label}</Link>
            {/* Connecté : l'ancre vers les étapes (un <a>, car Link ne
                fait pas défiler jusqu'à l'ancre). Sinon : la connexion. */}
            {connected ? (
              <a href="#fonctionnement" className="button-link button-link-secondary">Comment ça marche</a>
            ) : (
              <Link to="/login" className="button-link button-link-secondary">Se connecter</Link>
            )}
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
        <h2>Sécurité du site</h2>
        <p className="muted section-help">
          Un outil de sécurité doit d'abord être sûr lui-même.
        </p>
        <ul className="security-list">
          {SECURITY.map((measure) => (
            <li key={measure.title}>
              <h3>{measure.title}</h3>
              <p>{measure.text}</p>
              <p className="security-threat">Contre : {measure.threat} · avec {measure.tech}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Vos données (RGPD)</h2>
        <p className="muted section-help">
          Le détail est dans la page <Link to="/confidentialite">Confidentialité</Link>.
        </p>
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
          Projet de fin d'année d'Anil AKER, Holberton School Bordeaux, 2026 ·{' '}
          <a href="https://github.com/anil-akr" target="_blank" rel="noreferrer">github.com/anil-akr</a>.
          Python et Flask,
          SQLite chiffrée (SQLCipher), React.
        </p>
        <p>
          {/* Attribution exigée par la licence CC BY 4.0 de DB-IP. */}
          Géolocalisation : <a href="https://db-ip.com" target="_blank" rel="noreferrer">IP Geolocation by DB-IP</a>{' '}
          (base DB-IP Lite, licence CC BY 4.0).
        </p>
        <p>
          <Link to={mainLink.to}>{mainLink.label}</Link> · <Link to="/confidentialite">Confidentialité</Link>
        </p>
      </footer>
    </main>
  )
}
