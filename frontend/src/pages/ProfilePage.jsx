import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { deleteAnalysis, listAnalyses, me, updateMe } from '../api.js'
import AccountInfo from '../components/AccountInfo.jsx'
import DeleteAccountForm from '../components/DeleteAccountForm.jsx'
import EditableRow from '../components/EditableRow.jsx'
import HistoryTable from '../components/HistoryTable.jsx'
import PasswordForm from '../components/PasswordForm.jsx'
import UsernameForm from '../components/UsernameForm.jsx'

// Mon compte (/compte), pour un user comme pour l'admin : l'en-tête du
// compte, les identifiants (fermés au repos), mes analyses, puis (user
// seulement) la suppression du compte.
export default function ProfilePage() {
  // setUsername : met à jour le nom affiché dans le bandeau (ProtectedRoute).
  const { setUsername } = useOutletContext()
  const [account, setAccount] = useState(null) // null = pas encore chargé
  const [analyses, setAnalyses] = useState(null)
  const [error, setError] = useState('')

  const loadData = useCallback(() => {
    return Promise.all([me(), listAnalyses()])
      .then(([accountData, analysesData]) => {
        setAccount(accountData)
        setAnalyses(analysesData)
        setError('')
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Enregistre une modification, puis met la page et le bandeau à jour.
  async function saveChanges(changes) {
    const updated = await updateMe(changes)
    setAccount(updated)
    setUsername(updated.username)
  }

  async function handleDeleteAnalysis(id) {
    try {
      await deleteAnalysis(id)
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  if (account === null) {
    return (
      <main className="page profile">
        {error ? <p className="error" role="alert">{error}</p> : <p>Chargement…</p>}
      </main>
    )
  }

  return (
    <main className="page profile">
      <AccountInfo account={account} title="Mon compte" />
      {error && <p className="error" role="alert">{error}</p>}

      <section className="card">
        <h2>Identifiants</h2>
        <EditableRow label="Nom d'utilisateur" value={account.username}>
          <UsernameForm currentUsername={account.username} askCurrent onSave={saveChanges} />
        </EditableRow>
        <EditableRow
          label="Mot de passe"
          value={<span className="muted">jamais affiché, seul son hachage est gardé</span>}
        >
          <PasswordForm askCurrent onSave={saveChanges} />
        </EditableRow>
      </section>

      <section className="card">
        <h2>Mes analyses ({analyses.length})</h2>
        <HistoryTable analyses={analyses} onDelete={handleDeleteAnalysis} />
      </section>

      {/* Un admin ne peut pas supprimer son compte (l'API refuse). */}
      {account.role === 'user' && (
        <section className="card card-danger">
          <h2>Supprimer mon compte</h2>
          <p className="muted section-help">
            Votre compte et toutes vos analyses seront effacés. Cette action est définitive.
          </p>
          <DeleteAccountForm />
        </section>
      )}
    </main>
  )
}
