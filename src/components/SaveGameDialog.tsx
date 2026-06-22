import { useEffect, useState } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'

// Schöner Speichern-Dialog (Base UI) statt window.prompt.
export function SaveGameDialog({
  open,
  onOpenChange,
  defaultName,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultName: string
  onSave: (name: string) => Promise<void> | void
}) {
  const [name, setName] = useState(defaultName)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(defaultName)
      setSaving(false)
    }
  }, [open, defaultName])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave(name.trim())
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="ui-backdrop" />
        <Dialog.Popup className="ui-dialog" finalFocus={{ current: null }}>
          <Dialog.Title className="ui-dialog-title">Partie speichern</Dialog.Title>
          <Dialog.Description className="ui-dialog-desc">
            Gib der Partie einen Namen, um sie im Archiv wiederzufinden.
          </Dialog.Description>
          <form onSubmit={submit}>
            <input
              className="ui-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name der Partie"
              autoFocus
            />
            <div className="ui-dialog-actions">
              <Dialog.Close className="ui-btn ghost">Abbrechen</Dialog.Close>
              <button type="submit" className="ui-btn primary" disabled={saving || !name.trim()}>
                {saving ? 'Speichert …' : 'Speichern'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
