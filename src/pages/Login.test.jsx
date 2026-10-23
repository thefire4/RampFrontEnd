import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { useAuth } from '../auth/authContext.js'
import Login from './Login.jsx'

vi.mock('../auth/authContext.js', () => ({ useAuth: vi.fn() }))

function renderLogin(login) {
  useAuth.mockReturnValue({ user: null, login })
  render(<MemoryRouter><Login /></MemoryRouter>)
}

test('submits trimmed username and password', async () => {
  const login = vi.fn().mockResolvedValue()
  renderLogin(login)

  await userEvent.type(screen.getByLabelText('Username'), '  andy  ')
  await userEvent.type(screen.getByLabelText('Password'), 'secret123')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(login).toHaveBeenCalledWith('andy', 'secret123')
})

test('shows error on bad credentials', async () => {
  renderLogin(vi.fn().mockRejectedValue(new Error('Invalid username or password')))

  await userEvent.type(screen.getByLabelText('Username'), 'andy')
  await userEvent.type(screen.getByLabelText('Password'), 'wrong')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password')
})

test('blocks empty submit', async () => {
  const login = vi.fn()
  renderLogin(login)

  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Enter your username and password.')
  expect(login).not.toHaveBeenCalled()
})