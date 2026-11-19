import { useEffect, useId, useRef, useState } from 'react'

// RAMP-148: "Are you sure ? " boxes for actions that can't be undone.
// onConfirm may return a promise; while it runs both buttons are disabled,
// and if it fails the error shows here and the dialog stays open.
export default function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cancelRef = useRef(null)
  const titleId = useId()
  const bodyId = useId()

  // Start on Cancel so Enter doesn't delete by accident
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  async function handleConfirm() {
    setBusy(true)
    setError('')
    try {
      await onConfirm()
    } catch (err) {
      setError(err.message || 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <div className="viewer-backdrop" onClick={busy ? undefined : onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        <div id={bodyId} className="confirm-body">{children}</div>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <div className="form-actions confirm-actions">
          <button ref={cancelRef} type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="danger-button" onClick={handleConfirm} disabled={busy}>
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}