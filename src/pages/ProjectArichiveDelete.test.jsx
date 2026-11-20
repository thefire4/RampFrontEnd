import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import { AuthContext } from '../auth/authContext.js'
import ProjectPage from './ProjectPage.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))

// RAMP-148: archive, restore and delete on the project page

const spec = { id: 11, file_name: 'spec.pdf', file_type: 'application/pdf', url: '/api/files/11' }
const bom = { id: 12, file_name: 'bom.xlsx', file_type: 'application/vnd.ms-excel', url: '/api/files/12' }

function projectData(overrides = {}) {
  return {
    project: { id: 7, name: 'Test Jacket', archived: false, ...overrides },
    colorways: [],
    files: [spec, bom],
  }
}

function renderPage({ isAdmin = false, data = projectData() } = {}) {
  let current = data
  api.mockImplementation(async (path, options) => {
    if (path === '/projects/7' && !options) return current
    if (path === '/projects/7/archive') return { project: { id: 7, archived: true } }
    if (path === '/projects/7/restore') return { project: { id: 7, archived: false } }
    if (path === '/projects/7' && options?.method === 'DELETE') return { deleted: true, id: 7 }
    if (path === '/projects/7/files/11' && options?.method === 'DELETE') {
      current = { ...current, files: current.files.filter((f) => f.id !== 11) }
      return { deleted: true, id: 11 }
    }
    throw new Error(`unexpected ${path}`)
  })
  render(
    <AuthContext.Provider value={{ user: { username: 'u' }, isAdmin }}>
      <MemoryRouter initialEntries={['/projects/7']}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/projects" element={<h1>Projects list</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

afterEach(() => vi.clearAllMocks())

test('archive marks the project archived, and restore brings it back', async () => {
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Archive' }))
  expect(api).toHaveBeenCalledWith('/projects/7/archive', { method: 'POST' })
  expect(await screen.findByText('Archived')).toBeInTheDocument()
  expect(screen.getByText(/This project is archived/)).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Restore' }))
  expect(api).toHaveBeenCalledWith('/projects/7/restore', { method: 'POST' })
  expect(await screen.findByRole('button', { name: 'Archive' })).toBeInTheDocument()
  expect(screen.queryByText(/This project is archived/)).not.toBeInTheDocument()
})

test('an archived project opens with Restore', async () => {
  renderPage({ data: projectData({ archived: true }) })
  expect(await screen.findByRole('button', { name: 'Restore' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
})

test('shows an error when archiving fails', async () => {
  renderPage()
  await screen.findByRole('button', { name: 'Archive' })
  api.mockRejectedValueOnce(new Error('Server error'))

  await userEvent.click(screen.getByRole('button', { name: 'Archive' }))
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't archive this project: Server error")
})

test('only admins see the delete buttons', async () => {
  renderPage({ isAdmin: false })
  await screen.findByRole('button', { name: 'Archive' })
  expect(screen.queryByRole('button', { name: 'Delete project' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('tab', { name: /Files/ }))
  expect(screen.queryByRole('button', { name: 'Delete spec.pdf' })).not.toBeInTheDocument()
})

test('delete project asks first, naming the project, and cancel keeps it', async () => {
  renderPage({ isAdmin: true })
  await userEvent.click(await screen.findByRole('button', { name: 'Delete project' }))

  const dialog = screen.getByRole('alertdialog', { name: 'Delete Test Jacket?' })
  expect(dialog).toHaveTextContent('permanently removes Test Jacket')
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()

  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(api).not.toHaveBeenCalledWith('/projects/7', { method: 'DELETE' })
})

test('confirming the delete removes the project and returns to the projects list', async () => {
  renderPage({ isAdmin: true })
  await userEvent.click(await screen.findByRole('button', { name: 'Delete project' }))
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete project' }))

  expect(api).toHaveBeenCalledWith('/projects/7', { method: 'DELETE' })
  expect(await screen.findByRole('heading', { name: 'Projects list' })).toBeInTheDocument()
})

test('a failed delete shows the error and stays on the project', async () => {
  renderPage({ isAdmin: true })
  await userEvent.click(await screen.findByRole('button', { name: 'Delete project' }))
  api.mockRejectedValueOnce(new Error('Project files could not be removed.'))

  const dialog = screen.getByRole('alertdialog')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete project' }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Project files could not be removed.')
  expect(screen.getByRole('heading', { level: 1, name: 'Test Jacket' })).toBeInTheDocument()
})

test('admins can delete a file after confirming', async () => {
  renderPage({ isAdmin: true })
  await userEvent.click(await screen.findByRole('tab', { name: 'Files (2)' }))
  await userEvent.click(screen.getByRole('button', { name: 'Delete spec.pdf' }))

  const dialog = screen.getByRole('alertdialog', { name: 'Delete spec.pdf?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete file' }))

  expect(api).toHaveBeenCalledWith('/projects/7/files/11', { method: 'DELETE' })
  await waitFor(() => expect(screen.queryByRole('link', { name: 'spec.pdf' })).not.toBeInTheDocument())
  expect(screen.getByRole('link', { name: 'bom.xlsx' })).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})