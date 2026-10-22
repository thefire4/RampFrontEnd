import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import ProjectsList from './ProjectsList.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
afterEach(() => vi.clearAllMocks())

const projects = [
  { id: 7, name: 'Test Jacket', customer: 'Acme', style_no: 'ST-100', stage: 'blocked', missing_bom_items: 3 },
  { id: 8, name: 'Zip Hoodie', customer: 'Duckworth', style_no: 'NS008C', stage: 'finished', missing_bom_items: 0 },
]

function renderList() {
  render(
    <MemoryRouter initialEntries={['/projects']}>
      <Routes>
        <Route path="/projects" element={<ProjectsList />} />
        <Route path="/projects/:projectId" element={<h1>Project page</h1>} />
        <Route path="/projects/new" element={<h1>New project form</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

test('shows every project from the API with its details and missing count', async () => {
  api.mockResolvedValue({ projects })
  renderList()

  expect(await screen.findByRole('link', { name: 'Test Jacket' })).toHaveAttribute('href', '/projects/7')
  expect(screen.getByRole('link', { name: 'Zip Hoodie' })).toHaveAttribute('href', '/projects/8')
  expect(screen.getAllByRole('row')).toHaveLength(3) // header + 2 projects
  expect(screen.getByText('ST-100')).toBeInTheDocument()
  expect(screen.getByText('Blocked')).toBeInTheDocument()
  expect(screen.getByText('3 missing')).toBeInTheDocument()
  expect(screen.getByText('None')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith('/projects')
})

test('clicking a project name opens its project page', async () => {
  api.mockResolvedValue({ projects })
  renderList()

  await userEvent.click(await screen.findByRole('link', { name: 'Zip Hoodie' }))
  expect(await screen.findByRole('heading', { name: 'Project page' })).toBeInTheDocument()
})

test('clicking anywhere on the row also opens the project', async () => {
  api.mockResolvedValue({ projects })
  renderList()

  await userEvent.click(await screen.findByText('Acme'))
  expect(await screen.findByRole('heading', { name: 'Project page' })).toBeInTheDocument()
})

test('New project button goes to the create project form', async () => {
  api.mockResolvedValue({ projects })
  renderList()

  await userEvent.click(await screen.findByRole('link', { name: 'New project' }))
  expect(await screen.findByRole('heading', { name: 'New project form' })).toBeInTheDocument()
})

test('shows the friendly empty state when there are no projects', async () => {
  api.mockResolvedValue({ projects: [] })
  renderList()

  expect(await screen.findByText('No projects yet')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'New project' })).toHaveAttribute('href', '/projects/new')
})

test('shows the server error if the list fails to load', async () => {
  api.mockRejectedValue(new Error("Can't reach the server. Check that it's running and try again."))
  renderList()

  expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server")
})