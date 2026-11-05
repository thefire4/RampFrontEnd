// Shared by the new project page and the project page's Files tab (RAMP-132).
// Mirrors the backend's checks in document_import.py so a bad file is caught
// before it is sent, and the backend's own message is shown if it still fails.

export const ACCEPTED_EXTENSIONS = ['.xlsx', '.xlsm', '.xltx', '.xltm', '.csv', '.pdf']
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(',')
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
export const ACCEPTED_DESCRIPTION = 'Excel (.xlsx, .xlsm), CSV or PDF, up to 25 MB'

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function extensionOf(name) {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot).toLowerCase() : ''
}

// Why a file can't be uploaded, or null if it looks fine
export function checkFile(file) {
  const ext = extensionOf(file.name)
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    const kind = ext ? `${ext} files` : 'Files without an extension'
    return `${kind} can't be imported. Upload an Excel (.xlsx, .xlsm), CSV or PDF file.`
  }
  if (file.size === 0) return 'The file is empty.'
  if (file.size > MAX_UPLOAD_BYTES) {
    return `The file is ${formatSize(file.size)}. The limit is ${formatSize(MAX_UPLOAD_BYTES)}.`
  }
  return null
}

// The backend reports sizes in bytes ("(26214401 bytes; maximum is 26214400 bytes)"); show MB instead
export function friendlyUploadError(message) {
  return String(message || 'The upload failed.').replace(
    /\((\d+) bytes; maximum is (\d+) bytes\)/,
    (_, size, max) => `(${formatSize(Number(size))}; the limit is ${formatSize(Number(max))})`
  )
}

let nextKey = 0

// One entry per chosen file; status is 'invalid', 'waiting', 'uploading', 'done' or 'failed'
export function toUploadItems(fileList) {
  return Array.from(fileList || []).map((file) => {
    const problem = checkFile(file)
    nextKey += 1
    return {
      key: `upload-${nextKey}`,
      file,
      status: problem ? 'invalid' : 'waiting',
      message: problem,
    }
  })
}
