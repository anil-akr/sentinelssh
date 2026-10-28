import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteUser, deleteUserAnalysis, getUser, updateUser } from '../api.js'
import AccountInfo from '../components/AccountInfo.jsx'
import AnalysisRefsTable from '../components/AnalysisRefsTable.jsx'
import EditableRow from '../components/EditableRow.jsx'
import PasswordForm from '../components/PasswordForm.jsx'
import UsernameForm from '../components/UsernameForm.jsx'

// Profil d'un user vu par l'admin (/comptes/:id, D21) : même structure que
// « Mon compte ». L'admin peut changer son nom, réinitialiser son mot de
// passe, supprimer ses analyses ou le compte ; il ne voit ni le mot de
// passe ni le contenu des analyses (RGPD).
export default function UserAdminPage() {
  const { id } = useParams() // l'UUID dans l'adresse
  const navigate = useNavigate()
  const [account, setAccount] = useState(null) // null = pas encore chargé
  const [error, setError] = useState('')

  const loadAccount = useCallback(() => {
    return getUser(id)
      .then((data) => {
        setAccount(data)
        setError('')
      })
      .catch((err) => setError(err.message))
  }, [id])

  useEffect(() => {
    loadAccount()
  }, [loadAccount])

  // La réponse de l'API n'a pas la liste des analyses : on la garde.
  async function saveChanges(changes) {
    const updated = await updateUser(id, changes)
    setAccount({ ...updated, analyses: account.analyses })
  }

  async function handleDeleteAnalysis(analysisId) {
    try {
      await deleteUserAnalysis(id, analysisId)
      await loadAccount()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteAccount() {
    if (!window.confirm(`Supprimer le compte ${account.username} et toutes ses analyses ?`)) {
      return
    }
    try {
      await deleteUser(id)
      navigate('/comptes', { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <main className="page profile">
      <Link to="/comptes" className="back-link">← Retour aux comptes</Link>
      {error && <p className="error" role="alert">{error}</p>}
      {account === null && !error && <p>Chargement…</p>}

      {account !== null && (
        <>
          <AccountInfo account={account} title={`Compte de ${account.username}`} />

          <section className="card">
            <h2>Identifiants</h2>
            <EditableRow label="Nom d'utilisateur" value={account.username}>
              <UsernameForm currentUsername={account.username} onSave={saveChanges} />
            </EditableRow>
            {/* Réinitialisation : l'admin ne connaît pas l'ancien mot de passe. */}
            <EditableRow
              label="Mot de passe"
              value={<span className="muted">jamais affiché, seul son hachage est gardé</span>}
              actionLabel="Réinitialiser"
            >
              <PasswordForm askCurrent={false} onSave={saveChanges} />
            </EditableRow>
          </section>

          <section className="card">
            <h2>Analyses du compte ({account.analyses.length})</h2>
            <p className="muted section-help">
              Seulement la date et le nom du fichier, pour supprimer une analyse à la
              demande de l'utilisateur. Leur contenu reste privé.
            </p>
            <AnalysisRefsTable analyses={account.analyses} onDelete={handleDeleteAnalysis} />
          </section>

          <section className="card card-danger">
            <h2>Supprimer le compte</h2>
            <p className="muted section-help">
              Le compte de {account.username} et toutes ses analyses seront effacés. Cette
              action est définitive.
            </p>
            <button type="button" className="button-danger delete-account-button" onClick={handleDeleteAccount}>
              Supprimer ce compte
            </button>
          </section>
        </>
      )}
    </main>
  )
}
