// Aide repliée sous le formulaire d'envoi : quel fichier envoyer, où le
// trouver sur le serveur et comment le copier sur son ordinateur.
// {'\n'} : retour à la ligne dans un <pre> (JSX ignore les vrais retours).
export default function LogFileHelp() {
  return (
    // <details> : l'aide est repliée, elle ne gêne pas l'habitué.
    <details className="upload-help">
      <summary>Quel fichier envoyer, et où le trouver ?</summary>
      <p>
        SentinelSSH analyse le <strong>journal des connexions SSH</strong> d'un serveur Linux en
        production : le service <code>sshd</code> y note chaque tentative de connexion, réussie
        ou ratée, avec l'adresse IP d'origine. Ce fichier n'est lisible que par root : copiez-le
        d'abord dans votre dossier, puis envoyez la copie (extension .log ou .txt).
      </p>

      <h3>Ubuntu, Debian</h3>
      <p>Le journal est <code>/var/log/auth.log</code>.</p>
      <pre><code>sudo cp /var/log/auth.log ~/auth.log{'\n'}sudo chown $USER ~/auth.log</code></pre>

      <h3>Red Hat, Rocky, AlmaLinux, CentOS, Fedora</h3>
      <p>Le journal est <code>/var/log/secure</code> (sans extension : la copie en reçoit une).</p>
      <pre><code>sudo cp /var/log/secure ~/secure.log{'\n'}sudo chown $USER ~/secure.log</code></pre>

      <h3>Aucun de ces fichiers (Debian 12 et plus, journal systemd seul)</h3>
      <p>Le journal est gardé par systemd ; on l'exporte en texte :</p>
      <pre><code>sudo journalctl -u ssh -u sshd --no-pager &gt; ~/ssh.log</code></pre>

      <h3>Journaux plus anciens</h3>
      <p>
        Le système archive le journal chaque semaine : <code>auth.log.1</code>, puis{' '}
        <code>auth.log.2.gz</code> (compressé, à décompresser avant l'envoi).
      </p>
      <pre><code>sudo zcat /var/log/auth.log.2.gz &gt; ~/auth-2.log</code></pre>

      <h3>Copier le fichier sur votre ordinateur</h3>
      <p>
        Depuis un terminal sous Linux ou macOS, ou depuis PowerShell sous Windows 10 et 11
        (<code>scp</code> y est installé) :
      </p>
      <pre><code>scp utilisateur@adresse-du-serveur:~/auth.log .</code></pre>
      <p>Sous Windows, WinSCP fait la même chose avec une fenêtre.</p>

      <h3>Serveur Windows (OpenSSH pour Windows)</h3>
      <p>
        Pas encore pris en charge : son journal n'a pas le même format que celui de Linux,
        SentinelSSH n'y trouverait aucune tentative de connexion.
      </p>
    </details>
  )
}
