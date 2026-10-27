import { Link } from 'react-router-dom'

// Page publique (sans connexion) : information RGPD sur les données traitées.
export default function PrivacyPage() {
  return (
    <main className="page privacy">
      <Link to="/" className="back-link">← Retour</Link>
      <h1>Confidentialité</h1>

      <section className="card">
        <h2>Données traitées</h2>
        <p>
          Le fichier envoyé est analysé en mémoire puis oublié : il n'est jamais
          enregistré sur le disque. SentinelSSH conserve seulement, pour chaque
          analyse, le nom du fichier, la date et des compteurs, et pour chaque IP
          suspecte : l'adresse IP, le nombre d'échecs, la gravité, les règles
          déclenchées, les 3 comptes les plus visés et les heures de la première
          et de la dernière tentative.
        </p>
        <p>
          La position des IP suspectes (pays, ville, opérateur du réseau) est
          calculée à chaque affichage à partir d'une base installée sur le
          serveur (DB-IP Lite) : aucune IP n'est envoyée à un service de
          géolocalisation, et la position n'est pas enregistrée.
        </p>
        <p>
          Une adresse IP est une donnée personnelle au sens du RGPD. Les IP qui
          ne sont pas suspectes ne sont jamais conservées (minimisation).
        </p>
      </section>

      <section className="card">
        <h2>Finalité et base légale</h2>
        <p>
          Ces données servent uniquement à protéger le serveur contre les
          attaques sur SSH. Base légale : l'intérêt légitime, la sécurité des
          réseaux étant citée par le considérant 49 du RGPD.
        </p>
      </section>

      <section className="card">
        <h2>Durée de conservation</h2>
        <p>
          Les analyses de plus de 30 jours sont supprimées automatiquement à
          chaque démarrage de l'application. L'administrateur peut aussi
          supprimer une analyse à tout moment.
        </p>
      </section>

      <section className="card">
        <h2>Destinataires</h2>
        <p>
          Aucun. L'application fonctionne en local : aucune donnée n'est envoyée
          à un service extérieur. Le seul cookie est le cookie de session,
          nécessaire à la connexion.
        </p>
      </section>

      <section className="card">
        <h2>Source de la géolocalisation</h2>
        <p>
          <a href="https://db-ip.com" target="_blank" rel="noreferrer">IP Geolocation by DB-IP</a>,
          base gratuite publiée sous licence Creative Commons Attribution 4.0.
          La position est approximative (souvent la ville de l'opérateur, pas
          l'adresse exacte de l'attaquant).
        </p>
      </section>

      <section className="card">
        <h2>Vos droits</h2>
        <p>
          Vous disposez d'un droit d'accès, de rectification, d'effacement et
          d'opposition. Pour l'exercer, adressez-vous à l'administrateur du
          serveur, qui peut supprimer les analyses concernées.
        </p>
      </section>
    </main>
  )
}
