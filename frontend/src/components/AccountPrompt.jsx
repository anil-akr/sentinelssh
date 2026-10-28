import { NavLink } from 'react-router-dom'

// Le compte connecté, écrit comme l'invite d'un terminal SSH :
// « luca@sentinelssh:~$ » pour un utilisateur, « # » pour un administrateur
// (comme root dans un shell).
// Avec to : c'est un lien vers « Mon compte » (bandeau, présentation),
// dessiné comme un bouton. Sans to : simple texte (page Comptes).
export default function AccountPrompt({ username, role, to }) {
  const isAdmin = role === 'admin'
  // L'invite est décorative (aria-hidden) : le lecteur d'écran lit la
  // phrase cachée à la place.
  const content = (
    <>
      <span aria-hidden="true">
        {username}<span className="prompt-host">@sentinelssh:~</span>{isAdmin ? '#' : '$'}
      </span>
      <span className="visually-hidden">
        {to ? 'Mon compte : ' : 'Connecté en tant que '}
        {username}{isAdmin ? ', administrateur' : ''}
      </span>
    </>
  )

  if (to) {
    // NavLink ajoute « active » quand la page Mon compte est ouverte.
    return <NavLink to={to} className="account-prompt account-prompt-link">{content}</NavLink>
  }
  return <span className="account-prompt">{content}</span>
}
