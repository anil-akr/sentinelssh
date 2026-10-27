import SeverityBadge from './SeverityBadge.jsx'

// Les 3 niveaux, du plus grave au moins grave : règle et réaction.
const LEVELS = [
  {
    severity: 'critique',
    rule: 'R3 : connexion réussie après au moins 5 échecs de la même IP.',
    action: 'Un compte est peut-être compromis : bloquer l\'IP et vérifier le compte tout de suite.',
    why: 'Après 5 échecs, une réussite veut dire soit que l\'administrateur s\'est trompé 5 fois, soit que l\'attaquant a trouvé le mot de passe. Le doute suffit : une seule connexion réussie d\'un attaquant lui ouvre le serveur.',
  },
  {
    severity: 'elevee',
    rule: 'R2 : au moins 5 échecs en 60 secondes, le rythme d\'un robot.',
    action: 'Attaque automatisée en cours : bloquer l\'IP avec la commande proposée.',
    why: 'Un humain qui se trompe retape son mot de passe 2 ou 3 fois, en prenant le temps de réfléchir. 5 échecs en moins d\'une minute, c\'est le rythme d\'un programme qui essaie une liste de mots de passe. Pour comparaison, fail2ban bloque par défaut après 5 échecs en 10 minutes.',
  },
  {
    severity: 'moyenne',
    rule: 'R1 : au moins 20 échecs dans le fichier, même espacés.',
    action: 'Attaque lente et obstinée : surveiller l\'IP, pas de blocage proposé.',
    why: 'Certains robots espacent leurs essais pour passer sous les seuils de vitesse. Un utilisateur légitime échoue rarement 20 fois dans un même journal : c\'est la quantité qui trahit l\'attaque, même lente.',
  },
]

// Légende de la page d'analyse : explique les couleurs du tableau et de la carte.
export default function SeverityLegend() {
  return (
    <ul className="legend">
      {LEVELS.map((level) => (
        <li key={level.severity} className={`legend-item legend-${level.severity}`}>
          <SeverityBadge severity={level.severity} />
          <p>{level.rule}</p>
          <p className="muted">{level.action}</p>
          <details>
            <summary>Pourquoi ce seuil ?</summary>
            <p>{level.why}</p>
          </details>
        </li>
      ))}
      <li className="legend-note muted">
        Ces seuils sont réglables dans <code>backend/sentinel/config.py</code> et ont été
        vérifiés sur les fichiers de test.
      </li>
    </ul>
  )
}
