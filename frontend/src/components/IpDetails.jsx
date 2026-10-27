import { attackSeconds, countryName, formatDuration, formatLogTime } from '../format.js'
import CopyButton from './CopyButton.jsx'

// Explication en mots de chaque règle de détection.
const RULES = {
  R1: 'Attaque persistante : au moins 20 échecs dans le fichier.',
  R2: 'Force brute rapide : au moins 5 échecs en 60 secondes.',
  R3: 'Compromission possible : connexion réussie après au moins 5 échecs.',
}

// Fiche détaillée d'une IP, affichée sous sa ligne dans le tableau.
export default function IpDetails({ suspect }) {
  // geo est vide (null) si la base de géolocalisation n'est pas installée.
  const geo = suspect.geo

  // Durée de l'attaque, calculée à partir des heures du journal.
  const seconds = attackSeconds(suspect.first_seen, suspect.last_seen)

  // Rythme en échecs par minute. Si tout s'est passé dans la même seconde,
  // on ne divise pas par 0 : perMinute reste null.
  let perMinute = null
  if (seconds > 0) {
    const rate = suspect.failures / (seconds / 60)
    // toLocaleString : virgule à la française (« 11,4 »), 1 chiffre après.
    perMinute = rate.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
  }

  // Texte de la localisation, selon ce que la base a trouvé.
  let place
  if (!geo) {
    place = 'Base de géolocalisation non installée'
  } else if (geo.reserved) {
    place = 'Adresse réservée (réseau privé ou de documentation) : pas de position'
  } else if (geo.country_code) {
    place = countryName(geo)
    if (geo.city) {
      place = geo.city + ', ' + place // ex. « Guangzhou, Chine »
    }
  } else {
    place = 'IP absente de la base de géolocalisation'
  }

  return (
    <div className="ip-details">
      <dl className="facts">
        <div>
          <dt>Localisation</dt>
          <dd>{place}</dd>
          {geo && geo.latitude !== null && (
            <dd className="mono muted">{geo.latitude.toFixed(2)}, {geo.longitude.toFixed(2)}</dd>
          )}
        </div>
        <div>
          <dt>Opérateur du réseau</dt>
          <dd>{geo && geo.as_org ? geo.as_org : 'Inconnu'}</dd>
          {geo && geo.asn && <dd className="mono muted">AS{geo.asn}</dd>}
        </div>
        <div>
          <dt>Première et dernière tentative</dt>
          <dd className="mono">{formatLogTime(suspect.first_seen)}</dd>
          <dd className="mono">{formatLogTime(suspect.last_seen)}</dd>
        </div>
        <div>
          <dt>Durée et rythme</dt>
          <dd>{formatDuration(seconds)}</dd>
          <dd>{perMinute ? `${perMinute} échecs par minute` : 'Tout en une seconde'}</dd>
        </div>
      </dl>

      <div className="details-block">
        <h3>Règles déclenchées</h3>
        <ul className="rule-list">
          {suspect.rules.map((rule) => (
            <li key={rule}><strong>{rule}</strong> {RULES[rule]}</li>
          ))}
        </ul>
      </div>

      <div className="details-block">
        <h3>Comptes les plus visés</h3>
        <p>{suspect.users.map((user) => <code key={user} className="chip">{user}</code>)}</p>
      </div>

      <div className="details-block">
        <h3>Réaction conseillée</h3>
        {suspect.block_command ? (
          <div className="command">
            <code>{suspect.block_command}</code>
            <CopyButton text={suspect.block_command} />
          </div>
        ) : (
          <p className="muted">Surveiller cette IP : pas de blocage proposé pour une gravité moyenne.</p>
        )}
        {suspect.severity === 'critique' && (
          <p className="warning">
            Une connexion a réussi : vérifier le compte visé, changer son mot de passe
            et contrôler ce qui a été fait sur le serveur.
          </p>
        )}
      </div>
    </div>
  )
}
