// Toutes les requêtes vers l'API Flask sont ici : les composants
// n'appellent jamais fetch directement. Si une route change, on ne
// modifie que ce fichier.

// Envoie une requête et renvoie le JSON de la réponse.
// En cas d'erreur, lance une Error avec le message "error" de l'API.
async function request(url, options = {}, redirectOn401 = true) {
  const unreachable = 'Impossible de joindre le serveur. L\'API est-elle lancée ?'
  let response
  try {
    // credentials: 'same-origin' : le cookie de session part avec la requête.
    // « ...options » recopie les réglages reçus (méthode, corps…) dans l'objet.
    response = await fetch(url, { credentials: 'same-origin', ...options })
  } catch {
    // fetch échoue seulement si le serveur ne répond pas du tout.
    throw new Error(unreachable)
  }

  // 502, 503, 504 : un intermédiaire (le proxy de Vite en développement)
  // répond à la place de Flask, qui est arrêté.
  if ([502, 503, 504].includes(response.status)) {
    throw new Error(unreachable)
  }

  // Session absente ou expirée : retour à la page de connexion.
  if (response.status === 401 && redirectOn401) {
    window.location.assign('/login')
    throw new Error('Connexion requise')
  }

  // 204 = succès sans contenu (déconnexion, suppression).
  if (response.status === 204) {
    return null
  }

  // Si le serveur ne renvoie pas du JSON (proxy en panne…), data = null.
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    // Message de l'API s'il existe, sinon un message avec le code HTTP.
    if (data !== null && data.error) {
      throw new Error(data.error)
    }
    throw new Error(`Erreur du serveur (code ${response.status})`)
  }
  return data
}

// Envoie du JSON en POST.
function postJson(url, body, redirectOn401) {
  return request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, redirectOn401)
}

// Connexion : un 401 veut dire « Identifiants incorrects », on ne redirige
// donc pas, on laisse la page afficher le message.
export function login(username, password) {
  return postJson('/api/auth/login', { username, password }, false)
}

export function logout() {
  return request('/api/auth/logout', { method: 'POST' }, false)
}

// Qui est connecté ? Utilisé par ProtectedRoute, qui gère lui-même le 401.
export function me() {
  return request('/api/auth/me', {}, false)
}

// Envoi du fichier en multipart/form-data, champ "file".
export function uploadLog(file) {
  const formData = new FormData()
  formData.append('file', file)
  return request('/api/analyses', { method: 'POST', body: formData })
}

export function listAnalyses() {
  return request('/api/analyses')
}

export function getAnalysis(id) {
  return request(`/api/analyses/${encodeURIComponent(id)}`)
}

export function deleteAnalysis(id) {
  return request(`/api/analyses/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function listRecidivists() {
  return request('/api/recidivists')
}
