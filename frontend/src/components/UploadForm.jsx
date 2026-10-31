import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadLog } from '../api.js'

// Même limite que le serveur (MAX_UPLOAD_MB) : un fichier trop gros est
// refusé avant d'être envoyé, sans attendre la réponse 413.
const MAX_UPLOAD_MB = 50

// Choix du fichier et envoi ; ouvre ensuite la page de détail.
export default function UploadForm() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    if (!file) {
      setError('Choisissez un fichier.')
      return
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`Fichier trop volumineux (${MAX_UPLOAD_MB} Mo maximum).`)
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await uploadLog(file)
      navigate(`/analyses/${result.id}`)
    } catch (err) {
      // Message de l'API : extension refusée, fichier vide ou sans
      // tentative de connexion SSH…
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <label htmlFor="file">Fichier .log ou .txt, 50 Mo maximum</label>
      <div className="upload-row">
        <input
          id="file"
          type="file"
          accept=".log,.txt"
          onChange={(e) => setFile(e.target.files[0] || null)}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Analyse…' : 'Analyser'}
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  )
}
