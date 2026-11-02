import { useId, useState } from 'react'

// Une ligne de réglage : libellé, valeur actuelle et bouton « Modifier ».
// Le formulaire (children) ne s'ouvre que sous la ligne cliquée : la page
// ne montre jamais tous les champs à la fois.
export default function EditableRow({ label, value, actionLabel = 'Modifier', children }) {
  const [open, setOpen] = useState(false)
  // useId : un id unique pour relier le bouton à la zone qu'il ouvre.
  const panelId = useId()

  return (
    <div className="setting-row">
      <span className="setting-label">{label}</span>
      <span className="setting-value">{value}</span>
      <button
        type="button"
        className="button-secondary button-small"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        {open ? 'Fermer' : actionLabel}
      </button>
      {open && (
        <div id={panelId} className="setting-panel">
          {children}
        </div>
      )}
    </div>
  )
}
