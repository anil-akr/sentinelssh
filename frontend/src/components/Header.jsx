import { Link, NavLink } from 'react-router-dom'
import AccountPrompt from './AccountPrompt.jsx'
import LogoutButton from './LogoutButton.jsx'

// Bandeau du haut. À gauche la navigation, à droite la session.
// L'invite du compte (luca@sentinelssh:~$) est le lien vers « Mon compte ».
// L'onglet « Comptes » (la liste) n'existe que pour l'admin ; l'API refuse
// de toute façon /api/users à un user (403).
export default function Header({ username, role }) {
  const isAdmin = role === 'admin'

  return (
    <header className="header">
      <nav className="header-nav" aria-label="Navigation principale">
        {/* Le logo ramène à la page de présentation. */}
        <Link to="/" className="brand">
          {/* alt="" : image décorative, le nom est écrit juste à côté. */}
          <img src="/favicon.svg" alt="" width="28" height="28" />
          <span className="brand-name">SentinelSSH</span>
        </Link>
        <ul className="header-links">
          {/* NavLink ajoute la classe « active » et aria-current="page" au
              lien de la page ouverte. */}
          <li><NavLink to="/analyse" className="header-link">Analyses</NavLink></li>
          {isAdmin && <li><NavLink to="/comptes" className="header-link">Comptes</NavLink></li>}
        </ul>
      </nav>

      <div className="header-session">
        <AccountPrompt username={username} role={role} to="/compte" />
        <LogoutButton />
      </div>
    </header>
  )
}
