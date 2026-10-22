import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { useAuth } from '../auth/authContext.js'
import Layout from './Layout.jsx'

vi.mock('../auth/authContext.js', () => ({ useAuth: vi.fn() }))

afterEach(() => vi.clearAllMocks())

function renderLayout(auth) {
  useAuth.mockReturnValue(auth)
  render(
    <MemoryRouter initialEntries={['/projects']}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/projects" element={<p>Projects content</p>} />
        </Route>
        <Route path="/login" element={<h1>Login page</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

test('log out ends the session and goes to the login page', async () => {
  const logout = vi.fn().mockResolvedValue()
  renderLayout({ user: { username: 'andy' }, isAdmin: false, logout })

  expect(screen.getByText('andy')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

  expect(logout).toHaveBeenCalled()
  expect(await screen.findByRole('heading', { name: 'Login page' })).toBeInTheDocument()
})

test('still goes to the login page if the logout request fails', async () => {
  renderLayout({ user: { username: 'andy' }, isAdmin: false, logout: vi.fn().mockRejectedValue(new Error('offline')) })

  await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
  expect(await screen.findByRole('heading', { name: 'Login page' })).toBeInTheDocument()
})

test('only admins see the Users link', async () => {
  renderLayout({ user: { username: 'boss' }, isAdmin: true, logout: vi.fn() })
  expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users')
})

test('employees do not see the Users link', async () => {
  renderLayout({ user: { username: 'andy' }, isAdmin: false, logout: vi.fn() })
  expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
})