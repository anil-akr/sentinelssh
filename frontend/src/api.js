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

// Inscription : crée un compte « user » et ouvre sa session. Pas de
// redirection sur 401 : les erreurs (nom pris…) s'affichent dans la page.
export function register(username, password) {
  return postJson('/api/auth/register', { username, password }, false)
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

// Envoie du JSON avec une autre méthode (PATCH, DELETE).
function sendJson(url, method, body) {
  return request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Modifie son compte : { username } et/ou { password, current_password }.
export function updateMe(changes) {
  return sendJson('/api/auth/me', 'PATCH', changes)
}

// Suppression de son propre compte : le mot de passe est redemandé.
export function deleteMyAccount(password) {
  return sendJson('/api/auth/me', 'DELETE', { password })
}

// Gestion des comptes, réservée à l'administrateur (sinon 403).
export function listUsers() {
  return request('/api/users')
}

export function deleteUser(id) {
  return request(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// Profil d'un compte « user » vu par l'admin : jamais le mot de passe, et
// pour ses analyses seulement l'id, la date et le nom du fichier.
export function getUser(id) {
  return request(`/api/users/${encodeURIComponent(id)}`)
}

// L'admin change le nom et/ou réinitialise le mot de passe d'un user.
export function updateUser(id, changes) {
  return sendJson(`/api/users/${encodeURIComponent(id)}`, 'PATCH', changes)
}

// L'admin supprime une analyse d'un user, sans pouvoir la lire.
export function deleteUserAnalysis(userId, analysisId) {
  const url = `/api/users/${encodeURIComponent(userId)}/analyses/${encodeURIComponent(analysisId)}`
  return request(url, { method: 'DELETE' })
}
