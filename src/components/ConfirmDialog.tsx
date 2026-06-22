import { AlertDialog } from '@base-ui-components/react/alert-dialog'

// Bestätigungs-Dialog (Base UI AlertDialog) für destruktive Aktionen.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Bestätigen',
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="ui-backdrop" />
        <AlertDialog.Popup className="ui-dialog">
          <AlertDialog.Title className="ui-dialog-title">{title}</AlertDialog.Title>
          <AlertDialog.Description className="ui-dialog-desc">
            {description}
          </AlertDialog.Description>
          <div className="ui-dialog-actions">
            <AlertDialog.Close className="ui-btn ghost">Abbrechen</AlertDialog.Close>
            <button
              className="ui-btn danger-btn"
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
