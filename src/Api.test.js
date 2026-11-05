import { beforeEach, expect, test, vi } from 'vitest'

// api.js caches the CSRF token, so each test imports a fresh copy
let api, setUnauthorizedHandler, fetchMock

const res = (status, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

beforeEach(async () => {
  vi.resetModules()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  ;({ api, setUnauthorizedHandler } = await import('./api.js'))
})

test('GET hits /api path without CSRF header', async () => {
  fetchMock.mockResolvedValueOnce(res(200, { projects: [] }))
  const data = await api('/projects')

  expect(data).toEqual({ projects: [] })
  const [url, opts] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/projects')
  expect(opts.headers['X-CSRFToken']).toBeUndefined()
})

test('POST fetches CSRF token and sends it with JSON body', async () => {
  fetchMock
    .mockResolvedValueOnce(res(200, { csrf_token: 'abc' }))
    .mockResolvedValueOnce(res(200, { ok: true }))

  await api('/login', { method: 'POST', body: { username: 'andy', password: 'x' } })

  expect(fetchMock.mock.calls[0][0]).toBe('/api/csrf-token')
  const [url, opts] = fetchMock.mock.calls[1]
  expect(url).toBe('/api/login')
  expect(opts.headers['X-CSRFToken']).toBe('abc')
  expect(JSON.parse(opts.body)).toEqual({ username: 'andy', password: 'x' })
})

test('retries once with a fresh token when CSRF is stale', async () => {
  fetchMock
    .mockResolvedValueOnce(res(200, { csrf_token: 'old' }))
    .mockResolvedValueOnce(res(400, { error: 'CSRF validation failed' }))
    .mockResolvedValueOnce(res(200, { csrf_token: 'new' }))
    .mockResolvedValueOnce(res(200, { ok: true }))

  await expect(api('/logout', { method: 'POST' })).resolves.toEqual({ ok: true })
  expect(fetchMock).toHaveBeenCalledTimes(4)
  expect(fetchMock.mock.calls[3][1].headers['X-CSRFToken']).toBe('new')
})

test('401 triggers the unauthorized handler', async () => {
  const handler = vi.fn()
  setUnauthorizedHandler(handler)
  fetchMock.mockResolvedValueOnce(res(401))

  await expect(api('/projects')).rejects.toMatchObject({ status: 401 })
  expect(handler).toHaveBeenCalled()
})

test('401 on /login shows server error and does not log out', async () => {
  const handler = vi.fn()
  setUnauthorizedHandler(handler)
  fetchMock
    .mockResolvedValueOnce(res(200, { csrf_token: 'abc' }))
    .mockResolvedValueOnce(res(401, { error: 'Invalid username or password' }))

  await expect(api('/login', { method: 'POST', body: {} })).rejects.toThrow('Invalid username or password')
  expect(handler).not.toHaveBeenCalled()
})

test('network failure becomes ApiError with status 0', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
  await expect(api('/projects')).rejects.toMatchObject({ status: 0 })
})
// RAMP-132: file uploads
test('FormData is sent as is, without a JSON Content-Type', async () => {
  fetchMock
    .mockResolvedValueOnce(res(200, { csrf_token: 'tok' }))
    .mockResolvedValueOnce(res(201, { project_id: 5 }))
  const form = new FormData()
  form.append('file', new File(['a,b'], 'bom.csv', { type: 'text/csv' }))

  const data = await api('/projects/import', { method: 'POST', body: form })

  expect(data).toEqual({ project_id: 5 })
  const [url, opts] = fetchMock.mock.calls[1]
  expect(url).toBe('/api/projects/import')
  expect(opts.body).toBe(form)
  expect(opts.headers['Content-Type']).toBeUndefined()
  expect(opts.headers['X-CSRFToken']).toBe('tok')
})

test('a 413 without a JSON message still says the file is too large', async () => {
  fetchMock
    .mockResolvedValueOnce(res(200, { csrf_token: 'tok' }))
    .mockResolvedValueOnce({ ok: false, status: 413, json: async () => { throw new Error('not json') } })

  await expect(api('/projects/import', { method: 'POST', body: new FormData() }))
    .rejects.toMatchObject({ status: 413, message: 'That file is too large to upload.' })
})
