// Petites fonctions de mise en forme partagées par plusieurs composants.

// Nom du pays en français à partir de son code (« RU » → « Russie »).
// Intl.DisplayNames est intégré au navigateur ; si le code est inconnu,
// on garde le nom donné par la base DB-IP.
const regionNames = new Intl.DisplayNames(['fr'], { type: 'region' })

export function countryName(geo) {
  try {
    return regionNames.of(geo.country_code)
  } catch {
    return geo.country || geo.country_code
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Heure enregistrée par l'API → objet Date. Deux formats :
// - actuel, avec l'année : « 1999-12-31 23:59:40 » (une attaque qui passe
//   le Nouvel An garde une durée juste) ;
// - ancien, sans année : « Oct 26 02:30:05 » (analyses enregistrées avant
//   ce changement) ; on prend 2000, comme le back-end.
export function parseLogTime(text) {
  if (/^\d{4}-/.test(text)) {
    const [date, time] = text.split(' ')
    const [year, month, day] = date.split('-').map(Number)
    const [hours, minutes, seconds] = time.split(':').map(Number)
    // Les mois de Date vont de 0 (janvier) à 11 (décembre).
    return new Date(year, month - 1, day, hours, minutes, seconds)
  }
  const [month, day, time] = text.split(/\s+/)
  const [hours, minutes, seconds] = time.split(':').map(Number)
  return new Date(2000, MONTHS.indexOf(month), Number(day), hours, minutes, seconds)
}

// Nombre de secondes → « 45 s », « 3 min 20 s », « 2 h 05 min » ou « 28 j 04 h ».
export function formatDuration(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400)
  if (days > 0) {
    const restHours = Math.floor((totalSeconds % 86400) / 3600)
    return `${days} j ${String(restHours).padStart(2, '0')} h`
  }
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`
  if (minutes > 0) return `${minutes} min ${seconds} s`
  return `${seconds} s`
}

// Heure en français, sans l'année (elle est fictive dans l'ancien format) :
// « 1999-12-31 23:59:40 » ou « Dec 31 23:59:40 » → « 31 déc. 23:59:40 ».
export function formatLogTime(text) {
  const date = parseLogTime(text)
  const day = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  // L'heure est toujours le dernier morceau du texte.
  const time = text.split(/\s+/).pop()
  return `${day} ${time}`
}

// Durée d'une attaque en secondes, de la première à la dernière tentative.
export function attackSeconds(firstSeen, lastSeen) {
  return (parseLogTime(lastSeen) - parseLogTime(firstSeen)) / 1000
}

// Rang de chaque gravité : plus le nombre est grand, plus c'est grave.
const RANK = { moyenne: 1, elevee: 2, critique: 3 }

// Gravité la plus haute d'une liste d'IP (la liste n'est jamais vide).
export function worstSeverity(ips) {
  let worst = ips[0].severity
  for (const s of ips) {
    if (RANK[s.severity] > RANK[worst]) {
      worst = s.severity
    }
  }
  return worst
}

// Nombre total d'échecs d'une liste d'IP.
export function totalFailures(ips) {
  let total = 0
  for (const s of ips) {
    total += s.failures
  }
  return total
}

// Date ISO de l'API (« 2026-10-28T14:30:00 ») → « 28/10/2026 à 14:30 ».
export function formatDate(iso) {
  const date = new Date(iso)
  // Date absente ou illisible : un tiret plutôt que « Invalid Date ».
  if (!iso || Number.isNaN(date.getTime())) {
    return '—'
  }
  const day = date.toLocaleDateString('fr-FR')
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${day} à ${time}`
}
