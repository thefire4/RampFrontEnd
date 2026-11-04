import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import ProjectsList from './ProjectsList.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
afterEach(() => vi.clearAllMocks())

const projects = [
  { id: 1, name: 'Snowcrest Shirt Jac', customer: 'Duckworth', style_no: 'DW11038', po_no: '1654', stage: 'in progress',
    total_bom_lines: 8, missing_bom_items: 3 },
  { id: 2, name: 'Zip Hoodie', customer: 'Duckworth', style_no: 'NS008C', po_no: '2001', stage: 'finished',
    total_bom_lines: 5, missing_bom_items: 0 },
  { id: 3, name: 'Chore Jacket', customer: 'Sample Brand', style_no: 'TS1001', po_no: '9001', stage: 'blocked',
    total_bom_lines: 4, missing_bom_items: 4, style_description: 'Waxed cotton chore coat' },
  { id: 4, name: 'Blank Tee', customer: 'Acme', style_no: 'AC-1', stage: 'in progress',
    total_bom_lines: 0, missing_bom_items: 0 },
]

function renderList(url = '/projects') {
  api.mockResolvedValue({ projects })
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/projects" element={<ProjectsList />} />
        <Route path="/projects/:projectId" element={<h1>Project page</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

const shownNames = () =>
  screen.queryAllByRole('row').slice(1).map((row) => within(row).getByRole('link').textContent)

const filterBar = () => screen.getByRole('search', { name: 'Filter projects' })

test('search narrows the list as the user types', async () => {
  renderList()
  const search = await screen.findByLabelText('Search')
  expect(shownNames()).toHaveLength(4)
  expect(screen.getByText('4 projects')).toBeInTheDocument()

  await userEvent.type(search, 'jac')
  expect(shownNames()).toEqual(['Snowcrest Shirt Jac', 'Chore Jacket'])
  expect(screen.getByText('Showing 2 of 4 projects')).toBeInTheDocument()

  await userEvent.clear(search)
  await userEvent.type(search, 'ns008')
  expect(shownNames()).toEqual(['Zip Hoodie'])
})

test('search also matches PO, customer and description', async () => {
  renderList()
  const search = await screen.findByLabelText('Search')

  await userEvent.type(search, '9001')
  expect(shownNames()).toEqual(['Chore Jacket'])

  await userEvent.clear(search)
  await userEvent.type(search, 'SAMPLE brand')
  expect(shownNames()).toEqual(['Chore Jacket'])

  await userEvent.clear(search)
  await userEvent.type(search, 'waxed')
  expect(shownNames()).toEqual(['Chore Jacket'])
})

test('stage dropdown filters by stage', async () => {
  renderList()
  await userEvent.selectOptions(await screen.findByLabelText('Stage'), 'in progress')
  expect(shownNames()).toEqual(['Snowcrest Shirt Jac', 'Blank Tee'])

  await userEvent.selectOptions(screen.getByLabelText('Stage'), 'blocked')
  expect(shownNames()).toEqual(['Chore Jacket'])
})

test('division dropdown lists each customer once, sorted, and filters by it', async () => {
  renderList()
  const division = await screen.findByLabelText('Division')
  const options = within(division).getAllByRole('option').map((o) => o.textContent)
  expect(options).toEqual(['All divisions', 'Acme', 'Duckworth', 'Sample Brand'])

  await userEvent.selectOptions(division, 'Duckworth')
  expect(shownNames()).toEqual(['Snowcrest Shirt Jac', 'Zip Hoodie'])
})

test('status dropdown filters by BOM status', async () => {
  renderList()
  const status = await screen.findByLabelText('BOM status')

  await userEvent.selectOptions(status, 'missing')
  expect(shownNames()).toEqual(['Snowcrest Shirt Jac', 'Chore Jacket'])
  await userEvent.selectOptions(status, 'complete')
  expect(shownNames()).toEqual(['Zip Hoodie'])
  await userEvent.selectOptions(status, 'empty')
  expect(shownNames()).toEqual(['Blank Tee'])
})

test('filters combine with each other and with search', async () => {
  renderList()
  await userEvent.selectOptions(await screen.findByLabelText('Division'), 'Duckworth')
  await userEvent.selectOptions(screen.getByLabelText('BOM status'), 'missing')
  expect(shownNames()).toEqual(['Snowcrest Shirt Jac'])

  await userEvent.type(screen.getByLabelText('Search'), 'hoodie')
  expect(shownNames()).toEqual([])
})

test('Clear filters resets the search and every dropdown', async () => {
  renderList()
  const clear = within(await screen.findByRole('search')).getByRole('button', { name: 'Clear filters' })
  expect(clear).toBeDisabled() // nothing to clear yet

  await userEvent.type(screen.getByLabelText('Search'), 'jac')
  await userEvent.selectOptions(screen.getByLabelText('Stage'), 'blocked')
  expect(clear).toBeEnabled()

  await userEvent.click(clear)
  expect(screen.getByLabelText('Search')).toHaveValue('')
  expect(screen.getByLabelText('Stage')).toHaveValue('')
  expect(shownNames()).toHaveLength(4)
  expect(clear).toBeDisabled()
})

test('shows a message when no projects match, with a way to clear', async () => {
  renderList()
  await userEvent.type(await screen.findByLabelText('Search'), 'nothing like this')

  expect(screen.getByRole('heading', { name: 'No projects match' })).toBeInTheDocument()
  expect(screen.getByText('Showing 0 of 4 projects')).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()

  // The button in the message itself (the filter bar has one too)
  const buttons = screen.getAllByRole('button', { name: 'Clear filters' })
  const inMessage = buttons.find((b) => !filterBar().contains(b))
  await userEvent.click(inMessage)
  expect(shownNames()).toHaveLength(4)
})

test('filters are kept in the URL, so Back from a project keeps them', async () => {
  renderList('/projects?stage=blocked&q=chore')

  expect(await screen.findByLabelText('Stage')).toHaveValue('blocked')
  expect(screen.getByLabelText('Search')).toHaveValue('chore')
  expect(shownNames()).toEqual(['Chore Jacket'])
})

test('clicking a filtered project still opens it', async () => {
  renderList()
  await userEvent.type(await screen.findByLabelText('Search'), 'hoodie')
  await userEvent.click(screen.getByRole('link', { name: 'Zip Hoodie' }))
  expect(await screen.findByRole('heading', { name: 'Project page' })).toBeInTheDocument()
})

test('no filter bar when there are no projects at all', async () => {
  api.mockResolvedValue({ projects: [] })
  render(<MemoryRouter><ProjectsList /></MemoryRouter>)

  expect(await screen.findByText('No projects yet')).toBeInTheDocument()
  expect(screen.queryByRole('search')).not.toBeInTheDocument()
})
