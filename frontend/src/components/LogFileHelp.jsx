// Aide repliée sous le formulaire d'envoi : ce que SentinelSSH lit, puis
// 3 étapes (copier le journal, vérifier la copie, la télécharger).
// {'\n'} : retour à la ligne dans un <pre> (JSX ignore les vrais retours).

// Exemples de lignes et ce qu'en fait LogParser (parser.py). La ligne
// « Invalid user » est ignorée : sshd écrit aussi « Failed password for
// invalid user » pour la même tentative, qui serait sinon comptée 2 fois.
const SAMPLE_LINES = [
  { kind: 'fail', label: 'échec', line: 'sshd[812]: Failed password for root from 203.0.113.20 port 52214 ssh2' },
  { kind: 'ok', label: 'réussite', line: 'sshd[907]: Accepted publickey for ubuntu from 198.51.100.7 port 40112 ssh2' },
  { kind: 'skip', label: 'ignorée', line: 'sshd[815]: Invalid user test from 203.0.113.20 port 52241' },
  { kind: 'skip', label: 'ignorée', line: 'CRON[1204]: pam_unix(cron:session): session opened for user root' },
]

export default function LogFileHelp() {
  return (
    // <details> : l'aide est repliée, elle ne gêne pas l'habitué.
    <details className="upload-help">
      <summary>Quel fichier envoyer, et où le trouver ?</summary>
      <p>
        Le journal des connexions SSH de <strong>votre</strong> serveur Linux (celui que vous
        voulez protéger) : <code>/var/log/auth.log</code>.
      </p>

      <h3>Ce que SentinelSSH y lit</h3>
      <ul className="log-reading">
        {SAMPLE_LINES.map((sample) => (
          <li key={sample.line}>
            <span className={`log-tag log-tag-${sample.kind}`}>{sample.label}</span>
            <code>{sample.line}</code>
          </li>
        ))}
      </ul>
      <p>Un fichier sans aucune tentative de connexion SSH est refusé.</p>

      <h3 className="help-step"><span className="step-number">1</span>Sur votre serveur, copiez le journal dans votre dossier</h3>
      <p>
        Le journal n'est lisible que par root. Sa copie dans votre dossier personnel
        (<code>~</code>, c'est-à-dire <code>/home/votre-nom</code>) vous appartient : vous
        pourrez la télécharger.
      </p>
      <pre><code>sudo cp /var/log/auth.log ~/auth.log{'\n'}sudo chown $USER ~/auth.log</code></pre>

      <h3 className="help-step"><span className="step-number">2</span>Vérifiez la copie</h3>
      <p>Un nombre plus grand que 0 : c'est le bon fichier.</p>
      <pre><code>grep -cE "Failed password|Accepted (password|publickey)" ~/auth.log</code></pre>

      <h3 className="help-step"><span className="step-number">3</span>Sur votre ordinateur, téléchargez-la</h3>
      <p>Puis envoyez-la avec le bouton « Analyser ».</p>
      <pre><code>scp utilisateur@adresse-du-serveur:~/auth.log .</code></pre>

      <h3>Cas particuliers</h3>
      <ul className="check-result">
        <li>Red Hat, Fedora : le journal est <code>/var/log/secure</code>.</li>
        <li>
          Pas de fichier <code>auth.log</code> (Debian 12) :{' '}
          <code>sudo journalctl -u ssh -u sshd --no-pager &gt; ~/auth.log</code>
        </li>
        <li>Serveur Windows : pas encore pris en charge.</li>
      </ul>
    </details>
  )
}
