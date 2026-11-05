import { formatSize } from './uploads.js'

// The chosen files and how each upload went (RAMP-132).
// Failed files say why and can be retried; files that can't be uploaded can be removed.

const STATUS_TEXT = {
  invalid: "Can't upload",
  waiting: 'Ready',
  uploading: 'Uploading…',
  done: 'Uploaded',
  failed: 'Failed',
}

export default function UploadList({ items, label = 'Chosen files', onRetry, onRemove, busy = false }) {
  if (items.length === 0) return null

  return (
    <ul className="upload-list" aria-label={label} aria-live="polite">
      {items.map((item) => {
        const problem = item.status === 'invalid' || item.status === 'failed'
        return (
          <li key={item.key} className={`upload-item upload-${item.status}`}>
            <div className="upload-file">
              <span className="upload-name">{item.file.name}</span>
              <span className="muted">{formatSize(item.file.size)}</span>
            </div>
            <span className={`upload-status ${problem ? 'upload-status-bad' : ''}`}>{STATUS_TEXT[item.status]}</span>
            {problem && item.message && <p className="upload-message">{item.message}</p>}
            <div className="upload-actions">
              {item.status === 'failed' && onRetry && (
                <button
                  type="button"
                  className="secondary-button small-button"
                  onClick={() => onRetry(item)}
                  disabled={busy}
                  aria-label={`Try ${item.file.name} again`}
                >
                  Try again
                </button>
              )}
              {item.status !== 'uploading' && onRemove && (
                <button
                  type="button"
                  className="link-like small-button"
                  onClick={() => onRemove(item)}
                  disabled={busy}
                  aria-label={`Remove ${item.file.name}`}
                >
                  {item.status === 'done' ? 'Dismiss' : 'Remove'}
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
