import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import ProjectsList from './ProjectsList.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
afterEach(() => vi.clearAllMocks())

const projects = [
  { id: 7, name: 'Test Jacket', customer: 'Acme', style_no: 'ST-100', stage: 'blocked',
    total_bom_lines: 8, missing_bom_items: 6, percent_complete: 25 },
  { id: 8, name: 'Zip Hoodie', customer: 'Duckworth', style_no: 'NS008C', stage: 'in progress',
    total_bom_lines: 4, missing_bom_items: 1, percent_complete: 75 },
  { id: 9, name: 'Shirt Jac', customer: 'Sample Brand', style_no: 'TS1001', stage: 'finished',
    total_bom_lines: 5, missing_bom_items: 0, percent_complete: 100 },
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

const rowFor = (name) => screen.getByRole('link', { name }).closest('tr')

test('shows a loading message while projects load', async () => {
  api.mockReturnValue(new Promise(() => {})) // never resolves
  renderList()
  expect(screen.getByRole('status')).toHaveTextContent('Loading projects…')
})

test('shows every project with its stage and details', async () => {
  api.mockResolvedValue({ projects })
  renderList()

  expect(await screen.findByRole('link', { name: 'Test Jacket' })).toHaveAttribute('href', '/projects/7')
  expect(screen.getAllByRole('row')).toHaveLength(projects.length + 1) // header + projects
  expect(within(rowFor('Test Jacket')).getByText('Blocked')).toBeInTheDocument()
  expect(within(rowFor('Zip Hoodie')).getByText('In progress')).toBeInTheDocument()
  expect(within(rowFor('Shirt Jac')).getByText('Finished')).toBeInTheDocument()
  expect(within(rowFor('Test Jacket')).getByText('ST-100')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith('/projects')
})

test('shows percent complete as a colored progress bar', async () => {
  api.mockResolvedValue({ projects })
  renderList()
  await screen.findByRole('link', { name: 'Test Jacket' })

  const low = screen.getByRole('progressbar', { name: 'Test Jacket BOM complete' })
  const partial = screen.getByRole('progressbar', { name: 'Zip Hoodie BOM complete' })
  const complete = screen.getByRole('progressbar', { name: 'Shirt Jac BOM complete' })

  expect(low).toHaveAttribute('aria-valuenow', '25')
  expect(low).toHaveClass('level-low')
  expect(partial).toHaveAttribute('aria-valuenow', '75')
  expect(partial).toHaveClass('level-partial')
  expect(complete).toHaveAttribute('aria-valuenow', '100')
  expect(complete).toHaveClass('level-complete')
  expect(within(rowFor('Zip Hoodie')).getByText('75%')).toBeInTheDocument()
  expect(within(rowFor('Test Jacket')).getByText('6 missing')).toBeInTheDocument()
  expect(within(rowFor('Shirt Jac')).getByText('None')).toBeInTheDocument()
})

test('works out the percent when the API only sends counts', async () => {
  api.mockResolvedValue({ projects: [{ id: 1, name: 'Old API', stage: 'in progress', total_bom_lines: 4, missing_bom_items: 3 }] })
  renderList()

  expect(await screen.findByRole('progressbar', { name: 'Old API BOM complete' })).toHaveAttribute('aria-valuenow', '25')
})

test('says when a project has no BOM yet', async () => {
  api.mockResolvedValue({ projects: [{ id: 1, name: 'Blank', stage: 'in progress', total_bom_lines: 0, missing_bom_items: 0, percent_complete: 0 }] })
  renderList()

  expect(await screen.findByRole('cell', { name: 'No BOM yet' })).toBeInTheDocument()
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})

test('clicking a project name opens its overview page', async () => {
  api.mockResolvedValue({ projects })
  renderList()

  await userEvent.click(await screen.findByRole('link', { name: 'Zip Hoodie' }))
  expect(await screen.findByRole('heading', { name: 'Project page' })).toBeInTheDocument()
})

test('clicking anywhere on the row also opens the project', async () => {
  api.mockResolvedValue({ projects })
  renderList()

  await userEvent.click(await screen.findByRole('cell', { name: 'Acme' }))
  expect(await screen.findByRole('heading', { name: 'Project page' })).toBeInTheDocument()
})

test('New project button goes to the create project form', async () => {
  api.mockResolvedValue({ projects })
  renderList()

  await userEvent.click(await screen.findByRole('link', { name: 'New project' }))
  expect(await screen.findByRole('heading', { name: 'New project form' })).toBeInTheDocument()
})

test('shows a friendly message when there are no projects', async () => {
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
