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

// Heure du journal (« Oct 26 02:30:05 ») → objet Date. Le journal ne donne
// pas l'année : on prend 2000, comme le back-end (année bissextile).
export function parseLogTime(text) {
  const [month, day, time] = text.split(/\s+/)
  const [hours, minutes, seconds] = time.split(':').map(Number)
  return new Date(2000, MONTHS.indexOf(month), Number(day), hours, minutes, seconds)
}

// Nombre de secondes → « 45 s », « 3 min 20 s » ou « 2 h 05 min ».
export function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`
  if (minutes > 0) return `${minutes} min ${seconds} s`
  return `${seconds} s`
}

// Heure du journal en français : « Oct 26 02:30:05 » → « 26 oct. 02:30:05 ».
export function formatLogTime(text) {
  const date = parseLogTime(text)
  const day = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return `${day} ${text.split(/\s+/)[2]}`
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
