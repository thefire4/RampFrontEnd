import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import ActivityLog from './ActivityLog.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))

const detail = {
  project: { id: 7, name: 'Test Jacket' },
  colorways: [{ id: 'c1', name: 'Navy', materials: [{ id: 1, name: 'Shell' }, { id: 2, name: 'Zipper' }] }],
  files: [],
}

const history = [
  {
    id: 3, project_id: 7, user_id: 2, username: 'maria', action: 'updated', entity_type: 'material',
    entity_id: 2, field_name: 'supplier', old_value: null, new_value: 'YKK', changed_at: '2026-11-17T15:30:00',
  },
  {
    id: 2, project_id: 7, user_id: 1, username: 'admin', action: 'updated', entity_type: 'material',
    entity_id: 1, field_name: 'quantity', old_value: '1.5', new_value: '2.0', changed_at: '2026-11-16T10:00:00',
  },
  {
    id: 1, project_id: 7, user_id: null, username: null, action: 'deleted', entity_type: 'material',
    entity_id: 99, field_name: null, old_value: 'Snap', new_value: null, changed_at: '2026-11-15T09:00:00',
  },
]

function mockApi({ log = history, error } = {}) {
  api.mockImplementation(async (path) => {
    if (error) throw error
    if (path === '/projects/7') return detail
    if (path === '/projects/7/history') return { history: log }
    throw new Error(`unexpected ${path}`)
  })
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/projects/7/activity']}>
      <Routes>
        <Route path="/projects/:projectId/activity" element={<ActivityLog />} />
        <Route path="/projects/:projectId/parts/:partId" element={<h1>Part page</h1>} />
        <Route path="/projects/:projectId" element={<h1>Project page</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

function rows() {
  return within(screen.getByRole('region', { name: 'Changes' })).getAllByRole('row').slice(1)
}

function optionNames(label) {
  return within(screen.getByLabelText(label)).getAllByRole('option').map((o) => o.textContent)
}

afterEach(() => vi.clearAllMocks())

test('shows a loading message first', () => {
  mockApi()
  renderPage()
  expect(screen.getByRole('status')).toHaveTextContent('Loading activity…')
})

test('lists every change with user, field, old value, new value and time', async () => {
  mockApi()
  renderPage()

  expect(await screen.findByRole('heading', { level: 1, name: 'Activity log' })).toBeInTheDocument()
  expect(screen.getByText('Every change made to Test Jacket, newest first.')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith('/projects/7/history')

  const [first, second, third] = rows()
  expect(within(first).getByText('maria')).toBeInTheDocument()
  expect(within(first).getByText('Zipper')).toBeInTheDocument()
  expect(within(first).getByText('Supplier')).toBeInTheDocument()
  expect(first.querySelector('td.old-value')).toHaveTextContent('—')
  expect(first.querySelector('td.new-value')).toHaveTextContent('YKK')
  expect(first.querySelector('time')).toHaveAttribute('dateTime', '2026-11-17T15:30:00')
  expect(first.querySelector('time')).toHaveTextContent('2026')

  expect(within(second).getByText('admin')).toBeInTheDocument()
  expect(within(second).getByText('Yield')).toBeInTheDocument()
  expect(second.querySelector('td.old-value')).toHaveTextContent('1.5')
  expect(second.querySelector('td.new-value')).toHaveTextContent('2.0')

  expect(within(third).getByText('Unknown user')).toBeInTheDocument()
  expect(within(third).getByText('Removed line')).toBeInTheDocument()
  expect(within(third).getByText('Removed')).toBeInTheDocument()
  expect(screen.getByText('3 changes')).toBeInTheDocument()
})

test('filters by user', async () => {
  mockApi()
  renderPage()
  await screen.findByRole('region', { name: 'Changes' })

  expect(optionNames('User')).toEqual(['All users', 'admin', 'maria', 'Unknown user'])
  await userEvent.selectOptions(screen.getByLabelText('User'), 'maria')

  expect(rows()).toHaveLength(1)
  expect(within(rows()[0]).getByText('maria')).toBeInTheDocument()
  expect(screen.getByText('Showing 1 of 3 changes')).toBeInTheDocument()
})

test('filters by field, combines filters, and clears them', async () => {
  mockApi()
  renderPage()
  await screen.findByRole('region', { name: 'Changes' })

  expect(optionNames('Field')).toEqual(['All fields', 'Supplier', 'Yield'])
  await userEvent.selectOptions(screen.getByLabelText('Field'), 'Yield')
  expect(rows()).toHaveLength(1)
  expect(within(rows()[0]).getByText('admin')).toBeInTheDocument()

  await userEvent.selectOptions(screen.getByLabelText('User'), 'maria')
  expect(screen.getByRole('heading', { name: 'No changes match' })).toBeInTheDocument()

  const bar = screen.getByRole('search', { name: 'Filter changes' })
  await userEvent.click(within(bar).getByRole('button', { name: 'Clear filters' }))
  expect(rows()).toHaveLength(3)
  expect(within(bar).getByRole('button', { name: 'Clear filters' })).toBeDisabled()
})

test('each BOM line links to its part page', async () => {
  mockApi()
  renderPage()
  await userEvent.click(await screen.findByRole('link', { name: 'Zipper' }))
  expect(screen.getByRole('heading', { name: 'Part page' })).toBeInTheDocument()
})

test('shows a message when the project has no changes yet', async () => {
  mockApi({ log: [] })
  renderPage()

  expect(await screen.findByRole('heading', { name: 'No changes yet' })).toBeInTheDocument()
  expect(screen.queryByRole('search')).not.toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to project' })).toHaveAttribute('href', '/projects/7')
})

test('breadcrumb links back to the project', async () => {
  mockApi()
  renderPage()
  const crumbs = await screen.findByRole('navigation', { name: 'Breadcrumb' })
  expect(within(crumbs).getByRole('link', { name: 'Test Jacket' })).toHaveAttribute('href', '/projects/7')
})

test('shows not found on 404', async () => {
  mockApi({ error: Object.assign(new Error('Not found'), { status: 404 }) })
  renderPage()
  expect(await screen.findByRole('heading', { name: 'Project not found' })).toBeInTheDocument()
})