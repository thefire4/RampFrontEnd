import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from './api.js'
import AuthProvider from './auth/AuthProvider.jsx'
import App from './App.jsx'

vi.mock('./api.js', () => ({ api: vi.fn(), setUnauthorizedHandler: vi.fn() }))

const employee = { id: 1, username: 'andy', role: 'user' }
const admin = { id: 2, username: 'boss', role: 'admin' }

// Fake backend: /login starts a session, /me reports it
function fakeBackend(startingUser = null) {
  let session = startingUser
  api.mockImplementation(async (path) => {
    if (path === '/me') {
      if (!session) throw Object.assign(new Error('Unauthorized'), { status: 401 })
      return session
    }
    if (path === '/login') { session = employee; return {} }
    if (path === '/projects') return { projects: [] }
    if (path === '/users') return { users: [session] }
    return {}
  })
}

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider><App /></AuthProvider>
    </MemoryRouter>
  )
}

afterEach(() => vi.clearAllMocks())

test('logged-out user is sent to login, signs in, lands on projects', async () => {
  fakeBackend(null)
  renderAt('/projects')

  await userEvent.type(await screen.findByLabelText('Username'), 'andy')
  await userEvent.type(screen.getByLabelText('Password'), 'secret123')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith('/login', { method: 'POST', body: { username: 'andy', password: 'secret123' } })
})

test('employee does not see Users nav and is bounced from /users', async () => {
  fakeBackend(employee)
  renderAt('/users')

  expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
})

test('admin can open Users page', async () => {
  fakeBackend(admin)
  renderAt('/users')

  expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument()
})