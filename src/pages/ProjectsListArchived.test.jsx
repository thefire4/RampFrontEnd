import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import ProjectsList from './ProjectsList.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))

// RAMP-148: "Show archived" on the projects list

const active = { id: 1, name: 'Active Jacket', archived: false, total_bom_lines: 0, missing_bom_items: 0 }
const archived = { id: 2, name: 'Old Parka', archived: true, total_bom_lines: 0, missing_bom_items: 0 }

function mockApi({ activeList = [active], archivedList = [archived] } = {}) {
  api.mockImplementation(async (path) => {
    if (path === '/projects') return { projects: activeList }
    if (path === '/projects?archived=true') return { projects: archivedList }
    throw new Error(`unexpected ${path}`)
  })
}

function renderList(url = '/projects') {
  render(<MemoryRouter initialEntries={[url]}><ProjectsList /></MemoryRouter>)
}

afterEach(() => vi.clearAllMocks())

test('hides archived projects by default', async () => {
  mockApi()
  renderList()

  expect(await screen.findByRole('link', { name: 'Active Jacket' })).toBeInTheDocument()
  expect(screen.queryByText('Old Parka')).not.toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Show archived' })).not.toBeChecked()
  expect(api).not.toHaveBeenCalledWith('/projects?archived=true')
})

test('the toggle adds archived projects, marked Archived', async () => {
  mockApi()
  renderList()

  await userEvent.click(await screen.findByRole('checkbox', { name: 'Show archived' }))

  const row = (await screen.findByRole('link', { name: 'Old Parka' })).closest('tr')
  expect(within(row).getByText('Archived')).toBeInTheDocument()
  expect(row).toHaveClass('row-archived')
  expect(screen.getByRole('link', { name: 'Active Jacket' })).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith('/projects?archived=true')
  expect(screen.getByRole('checkbox', { name: 'Show archived' })).toBeChecked()
})

test('clearing filters keeps archived projects showing', async () => {
  mockApi()
  renderList('/projects?archived=1&q=parka')

  expect(await screen.findByRole('link', { name: 'Old Parka' })).toBeInTheDocument()
  await userEvent.click(within(screen.getByRole('search')).getByRole('button', { name: 'Clear filters' }))

  expect(screen.getByRole('link', { name: 'Active Jacket' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Old Parka' })).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Show archived' })).toBeChecked()
})

test('when every project is archived, the empty list offers to show them', async () => {
  mockApi({ activeList: [] })
  renderList()

  expect(await screen.findByText('No projects yet')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Show archived projects' }))
  expect(await screen.findByRole('link', { name: 'Old Parka' })).toBeInTheDocument()
})
