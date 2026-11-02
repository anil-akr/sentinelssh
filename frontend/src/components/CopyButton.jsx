import { useState } from 'react'

// Copie un texte dans le presse-papiers et affiche « Copié ! » 2 secondes.
export default function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.alert('Copie impossible : sélectionnez la commande à la main.')
    }
  }

  return (
    <button type="button" className="button-secondary" onClick={handleClick}>
      {copied ? 'Copié !' : 'Copier'}
    </button>
  )
}
