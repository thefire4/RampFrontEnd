import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import { useAuth } from '../auth/authContext.js'
import Users from './Users.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
vi.mock('../auth/authContext.js', () => ({ useAuth: vi.fn() }))

/* mock workers created */

const admin = { id: 1, username: 'boss', email: 'boss@example.com', role: 'admin' }
const maria = { id: 2, username: 'maria', email: 'maria@example.com', role: 'user' }

beforeEach(() => {
  useAuth.mockReturnValue({ user: admin })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

function backend({ users = [admin, maria], onPost, onDelete } = {}) {
  api.mockImplementation(async (path, options = {}) => {
    if (path === '/users' && !options.method) return { users }
    if (path === '/users' && options.method === 'POST') return onPost(options.body)
    if (options.method === 'DELETE') return onDelete(path)
    throw new Error(`unexpected ${path}`)
  })
}

const table = () => screen.getByRole('table')

test('lists every employee, and the admin cannot remove themselves', async () => {
  backend()
  render(<Users />)

  const mariaRow = (await screen.findByRole('cell', { name: 'maria' })).closest('tr')
  expect(within(mariaRow).getByText('Employee')).toBeInTheDocument()
  expect(within(mariaRow).getByRole('button', { name: 'Remove' })).toBeInTheDocument()

  const bossRow = within(table()).getByRole('cell', { name: 'boss' }).closest('tr')
  expect(within(bossRow).getByText('Admin')).toBeInTheDocument()
  expect(within(bossRow).getByText('You')).toBeInTheDocument()
  expect(within(bossRow).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
})

test('adds an employee and shows them in the list', async () => {
  const onPost = vi.fn((body) => ({ user: { id: 3, username: body.username, email: body.email, role: body.role } }))
  backend({ onPost })
  render(<Users />)
  await screen.findByRole('cell', { name: 'maria' })

  await userEvent.type(screen.getByLabelText('Username'), '  jsmith ')
  await userEvent.type(screen.getByLabelText('Email'), 'jsmith@example.com')
  await userEvent.type(screen.getByLabelText('Temporary password'), 'temp-pass-1')
  await userEvent.selectOptions(screen.getByLabelText('Role'), 'admin')
  await userEvent.click(screen.getByRole('button', { name: 'Add employee' }))

  expect(onPost).toHaveBeenCalledWith({ username: 'jsmith', email: 'jsmith@example.com', password: 'temp-pass-1', role: 'admin' })
  expect(await screen.findByRole('status')).toHaveTextContent('Added jsmith.')
  const newRow = within(table()).getByRole('cell', { name: 'jsmith' }).closest('tr')
  expect(within(newRow).getByText('Admin')).toBeInTheDocument()
  expect(screen.getByLabelText('Username')).toHaveValue('')
})

test('checks the form before sending it', async () => {
  const onPost = vi.fn()
  backend({ onPost })
  render(<Users />)
  await screen.findByRole('cell', { name: 'maria' })

  await userEvent.click(screen.getByRole('button', { name: 'Add employee' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Username, email and password are required.')

  await userEvent.type(screen.getByLabelText('Username'), 'jsmith')
  await userEvent.type(screen.getByLabelText('Email'), 'jsmith@example.com')
  await userEvent.type(screen.getByLabelText('Temporary password'), 'short')
  await userEvent.click(screen.getByRole('button', { name: 'Add employee' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 8 characters.')

  expect(onPost).not.toHaveBeenCalled()
})

test('shows the server error when the employee already exists', async () => {
  backend({ onPost: () => { throw new Error('Username or email is already registered') } })
  render(<Users />)
  await screen.findByRole('cell', { name: 'maria' })

  await userEvent.type(screen.getByLabelText('Username'), 'maria')
  await userEvent.type(screen.getByLabelText('Email'), 'maria@example.com')
  await userEvent.type(screen.getByLabelText('Temporary password'), 'temp-pass-1')
  await userEvent.click(screen.getByRole('button', { name: 'Add employee' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Username or email is already registered')
  expect(within(table()).getAllByRole('cell', { name: 'maria' })).toHaveLength(1)
})

test('removes an employee after confirming', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const onDelete = vi.fn(() => ({ message: 'User deleted successfully' }))
  backend({ onDelete })
  render(<Users />)

  const mariaRow = (await screen.findByRole('cell', { name: 'maria' })).closest('tr')
  await userEvent.click(within(mariaRow).getByRole('button', { name: 'Remove' }))

  expect(window.confirm).toHaveBeenCalledWith('Remove maria? They will no longer be able to log in.')
  expect(onDelete).toHaveBeenCalledWith('/users/2')
  expect(await screen.findByRole('status')).toHaveTextContent('Removed maria.')
  expect(within(table()).queryByRole('cell', { name: 'maria' })).not.toBeInTheDocument()
})

test('does nothing when removal is cancelled', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  const onDelete = vi.fn()
  backend({ onDelete })
  render(<Users />)

  const mariaRow = (await screen.findByRole('cell', { name: 'maria' })).closest('tr')
  await userEvent.click(within(mariaRow).getByRole('button', { name: 'Remove' }))

  expect(onDelete).not.toHaveBeenCalled()
  expect(within(table()).getByRole('cell', { name: 'maria' })).toBeInTheDocument()
})