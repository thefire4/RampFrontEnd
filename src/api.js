// Small wrapper around fetch for the Flask API.
// The backend uses session cookies plus Flask-WTF CSRF tokens, so every
// non-GET request sends the token in the X-CSRFToken header.

const CSRF_PATH = '/api/csrf-token'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

let csrfToken = null
let onUnauthorized = () => {}

// Lets the auth provider log the user out locally when the session expires.
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

function fallbackMessage(status) {
  if (status === 401) return 'Your session has ended. Please sign in again.'
  if (status === 403) return "You don't have permission to do that."
  if (status === 404) return 'Not found.'
  if (status >= 500) return 'Something went wrong on the server. Please try again.'
  return 'Something went wrong. Please try again.'
}

async function send(url, options) {
  try {
    return await fetch(url, { credentials: 'same-origin', ...options })
  } catch {
    throw new ApiError("Can't reach the server. Check that it's running and try again.", 0)
  }
}

async function getCsrfToken(refresh = false) {
  if (!csrfToken || refresh) {
    const res = await send(CSRF_PATH, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new ApiError('Could not start a secure session with the server.', res.status)
    csrfToken = (await res.json()).csrf_token
  }
  return csrfToken
}

export async function api(path, { method = 'GET', body } = {}) {
  const isWrite = method !== 'GET'

  async function attempt(refreshToken) {
    const headers = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (isWrite) headers['X-CSRFToken'] = await getCsrfToken(refreshToken)

    return send(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let res = await attempt(false)
  let data = await res.json().catch(() => ({}))

  // The token is tied to the session, so fetch a fresh one and retry once if it went stale.
  if (isWrite && res.status === 400 && data.error === 'CSRF validation failed') {
    res = await attempt(true)
    data = await res.json().catch(() => ({}))
  }

  if (!res.ok) {
    if (res.status === 401 && path !== '/login') onUnauthorized()
    throw new ApiError(data.error || fallbackMessage(res.status), res.status)
  }
  return data
}
