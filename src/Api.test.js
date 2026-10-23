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