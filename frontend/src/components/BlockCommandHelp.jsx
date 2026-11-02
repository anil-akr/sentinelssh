// Aide sous la commande de blocage : où la taper, ce qu'elle fait,
// comment vérifier et annuler. Repliée par défaut (<details>).
export default function BlockCommandHelp({ command }) {
  // command ressemble à « iptables -A INPUT -s 203.0.113.9 -j DROP ».
  // Le 1er mot est l'outil : iptables (IPv4) ou ip6tables (IPv6).
  const tool = command.split(' ')[0]
  // Même commande avec -D (supprimer la règle) au lieu de -A (l'ajouter).
  const undo = command.replace(' -A ', ' -D ')

  return (
    <details className="command-help">
      <summary>Où et comment taper cette commande ?</summary>

      <p>
        <strong>Où :</strong> dans un terminal <strong>du serveur attaqué</strong> (celui
        d'où vient le journal), pas sur l'ordinateur qui affiche SentinelSSH.
      </p>

      <p>
        <strong>Comment :</strong> avec <code>sudo</code> devant, car seul root peut
        modifier le pare-feu.
      </p>
      <pre><code>sudo {command}</code></pre>

      <p><strong>Ce qu'elle fait, mot par mot :</strong></p>
      <ul>
        <li><code>{tool}</code> : le pare-feu de Linux.</li>
        <li><code>-A INPUT</code> : ajoute une règle à la liste des connexions qui arrivent.</li>
        <li><code>-s …</code> : la règle vise les paquets qui viennent de cette IP (source).</li>
        <li><code>-j DROP</code> : ces paquets sont jetés, sans réponse.</li>
      </ul>

      <p><strong>Vérifier</strong> que la règle est en place :</p>
      <pre><code>sudo {tool} -L INPUT -n</code></pre>

      <p><strong>Annuler</strong> en cas d'erreur :</p>
      <pre><code>sudo {undo}</code></pre>

      <p className="muted">
        La règle disparaît au redémarrage du serveur. Pour la garder, il faut la
        sauvegarder (par exemple avec le paquet <code>iptables-persistent</code>).
      </p>
    </details>
  )
}
