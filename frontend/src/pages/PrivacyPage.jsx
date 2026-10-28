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
          Pour votre compte : le nom d'utilisateur, le mot de passe sous forme
          hachée (jamais en clair), le rôle (utilisateur ou administrateur), la
          date d'inscription et celle de la dernière modification. Aucune
          adresse e-mail n'est demandée.
        </p>
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
          Les données du compte servent à vous connecter et à garder vos
          analyses séparées de celles des autres comptes. Base légale :
          l'exécution du service que vous demandez en créant un compte.
        </p>
        <p>
          Les IP suspectes servent uniquement à protéger votre serveur contre
          les attaques sur SSH. Base légale : l'intérêt légitime, la sécurité
          des réseaux étant citée par le considérant 49 du RGPD.
        </p>
      </section>

      <section className="card">
        <h2>Durée de conservation</h2>
        <p>
          Les analyses de plus de 30 jours sont supprimées automatiquement à
          chaque démarrage du site. Vous pouvez aussi supprimer une analyse à
          tout moment. Le compte (nom, mot de passe haché, date
          d'inscription) est gardé jusqu'à ce que vous le supprimiez, ou que
          l'administrateur le supprime à votre demande ; supprimer un compte
          supprime aussi toutes ses analyses.
        </p>
      </section>

      <section className="card">
        <h2>Destinataires</h2>
        <p>
          Aucun service extérieur : les données restent sur le serveur de
          SentinelSSH. Chaque compte ne voit que ses propres analyses.
          L'administrateur du site voit les comptes (nom, rôle, dates) pour les
          gérer : il peut changer un nom, réinitialiser un mot de passe ou
          supprimer un compte. De vos analyses, il ne voit que la date et le
          nom du fichier, pour en supprimer une à votre demande : jamais leur
          contenu, jamais votre mot de passe. Le seul cookie est le cookie de
          session, nécessaire à la connexion.
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
          d'opposition. Dans « Mon compte », vous modifiez votre nom et votre
          mot de passe, et vous supprimez vos analyses ou votre compte.
        </p>
      </section>
    </main>
  )
}
