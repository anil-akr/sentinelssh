import { formatDate } from '../format.js'

// En-tête d'un profil : l'invite du compte en grand (comme dans le
// bandeau), puis le rôle et les dates. title : le vrai titre de la page,
// lu par les lecteurs d'écran (« Mon compte », « Compte de luca »).
// Jamais le mot de passe : la base ne garde que son hachage (RGPD).
export default function AccountInfo({ account, title }) {
  const isAdmin = account.role === 'admin'
  return (
    <header className="profile-head">
      <h1 className="profile-prompt">
        <span className="visually-hidden">{title}</span>
        <span aria-hidden="true">
          {account.username}<span className="prompt-host">@sentinelssh:~</span>
          <span className="prompt-sign">{isAdmin ? '#' : '$'}</span>
        </span>
      </h1>
      <dl className="profile-facts">
        <div>
          <dt>Rôle</dt>
          <dd>{isAdmin ? 'Administrateur' : 'Utilisateur'}</dd>
        </div>
        <div>
          <dt>Inscrit le</dt>
          <dd>{formatDate(account.created_at)}</dd>
        </div>
        <div>
          <dt>Dernière modification</dt>
          <dd>{formatDate(account.updated_at)}</dd>
        </div>
      </dl>
    </header>
  )
}
