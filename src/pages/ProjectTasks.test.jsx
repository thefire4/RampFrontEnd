import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import { AuthContext } from '../auth/authContext.js'
import ProjectPage from './ProjectPage.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 18, 12)) })
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

// RAMP-139: the project's tasks with owner, status and due date
const full = {
  id: 1, name: 'Shell', material: 'Cotton', supplier: 'YKK', supplier_contact: 'Ana', color: 'Navy',
  quantity: 1, uom: 'yd', location: 'Body', material_size: '58"',
}
const zipper = { ...full, id: 2, name: 'Zipper', material: 'Metal zip', supplier: '' }
const label = { ...full, id: 3, name: 'Care label', material: 'Satin', uom: '' }
const projectData = {
  project: { id: 7, name: 'Zip Jacket', stage: 'in progress' },
  colorways: [{ id: 'c1', name: 'Black', materials: [full, zipper, label] }],
  files: [],
}
const zipperTask = { id: 10, bom_line_id: 2, project_id: 7, missing_fields: ['supplier'], owner_id: null, owner: null, status: 'open', due_date: '2026-11-10' }
const labelTask = { id: 11, bom_line_id: 3, project_id: 7, missing_fields: ['uom'], owner_id: 3, owner: 'rodrigo', status: 'in progress', due_date: null }
const doneTask = { id: 12, bom_line_id: 1, project_id: 7, missing_fields: [], owner_id: 2, owner: 'andy', status: 'done', due_date: null }

function mockApi({ tasks = [zipperTask, labelTask, doneTask], users, onPatch, tasksAfterSave } = {}) {
  let saved = false
  api.mockImplementation(async (path, options) => {
    if (path === '/projects/7/tasks') {
      if (tasks === null) throw Object.assign(new Error('Not found.'), { status: 404 })
      return { tasks: saved && tasksAfterSave ? tasksAfterSave : tasks }
    }
    if (path === '/users') return { users }
    if (options?.method === 'PATCH') { saved = true; return onPatch(path, options) }
    return projectData
  })
}

function renderPage({ user = { id: 2, username: 'andy', role: 'user' }, isAdmin = false } = {}) {
  render(
    <AuthContext.Provider value={{ user, isAdmin }}>
      <MemoryRouter initialEntries={['/projects/7']}>
        <Routes><Route path="/projects/:projectId" element={<ProjectPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

async function openTasks() {
  await userEvent.click(await screen.findByRole('tab', { name: 'Tasks (2 open)' }))
  return screen.getByRole('region', { name: 'Tasks' })
}

const rowFor = (panel, name) => within(panel).getByRole('link', { name: new RegExp(`^${name}`) }).closest('tr')

test("lists each task with what's missing, owner, status and due date", async () => {
  mockApi()
  renderPage()
  const panel = await openTasks()

  const zip = rowFor(panel, 'Zipper')
  expect(within(zip).getByRole('link', { name: 'Zipper · Metal zip' })).toHaveAttribute('href', '/projects/7/parts/2')
  expect(zip).toHaveTextContent('supplier')
  expect(within(zip).getByLabelText('Owner for Zipper')).toHaveValue('')
  expect(within(zip).getByLabelText('Status for Zipper')).toHaveValue('open')
  expect(within(zip).getByLabelText('Due date for Zipper')).toHaveValue('2026-11-10')
  // Due Nov 10, today is Nov 18
  expect(zip).toHaveTextContent('Overdue')

  const care = rowFor(panel, 'Care label')
  expect(care).toHaveTextContent('unit')
  expect(within(care).getByLabelText('Owner for Care label')).toHaveDisplayValue('rodrigo')
  // In progress comes before open
  const order = within(panel).getAllByRole('link').map((a) => a.textContent)
  expect(order).toEqual(['Care label · Satin', 'Zipper · Metal zip', 'Shell · Cotton'])
})

test('filters by status', async () => {
  mockApi()
  renderPage()
  const panel = await openTasks()

  await userEvent.click(within(panel).getByRole('button', { name: 'Done · 1' }))
  expect(within(panel).getAllByRole('row')).toHaveLength(2)
  expect(rowFor(panel, 'Shell')).toHaveTextContent('Filled in')

  await userEvent.click(within(panel).getByRole('button', { name: 'Open · 1' }))
  expect(within(panel).getByRole('link', { name: 'Zipper · Metal zip' })).toBeInTheDocument()
  expect(within(panel).queryByRole('link', { name: 'Shell · Cotton' })).not.toBeInTheDocument()

  await userEvent.click(within(panel).getByRole('button', { name: 'All · 3' }))
  expect(within(panel).getAllByRole('row')).toHaveLength(4)
})

test('changing the status saves it straight away', async () => {
  mockApi({ onPatch: (path, options) => ({ task: { ...zipperTask, ...options.body } }) })
  renderPage()
  const panel = await openTasks()

  await userEvent.selectOptions(within(rowFor(panel, 'Zipper')).getByLabelText('Status for Zipper'), 'In progress')
  expect(api).toHaveBeenCalledWith('/tasks/10', { method: 'PATCH', body: { status: 'in progress' } })
  await waitFor(() => expect(within(rowFor(panel, 'Zipper')).getByLabelText('Status for Zipper')).toHaveValue('in progress'))
  expect(screen.getByRole('tab', { name: 'Tasks (2 open)' })).toBeInTheDocument()
})

test('a due date can be set and cleared', async () => {
  mockApi({ onPatch: (path, options) => ({ task: { ...labelTask, ...options.body } }) })
  renderPage()
  const panel = await openTasks()
  const due = within(rowFor(panel, 'Care label')).getByLabelText('Due date for Care label')

  await userEvent.type(due, '2026-12-01')
  // Nothing is saved while typing, only when leaving the field
  expect(api).not.toHaveBeenCalledWith('/tasks/11', expect.anything())
  await userEvent.tab()
  expect(api).toHaveBeenLastCalledWith('/tasks/11', { method: 'PATCH', body: { due_date: '2026-12-01' } })

  await userEvent.clear(due)
  await userEvent.keyboard('{Enter}')
  expect(api).toHaveBeenLastCalledWith('/tasks/11', { method: 'PATCH', body: { due_date: null } })
})

test('a half-typed due date is not saved', async () => {
  mockApi({ onPatch: (path, options) => ({ task: { ...labelTask, ...options.body } }) })
  renderPage()
  const panel = await openTasks()
  const due = within(rowFor(panel, 'Care label')).getByLabelText('Due date for Care label')

  // What a browser reports partway through typing the year
  await userEvent.type(due, '0002-11-25')
  await userEvent.tab()

  expect(api).not.toHaveBeenCalledWith('/tasks/11', expect.anything())
  expect(within(rowFor(panel, 'Care label')).getByRole('alert')).toHaveTextContent('Enter a full due date, like 11/25/2026.')
})

test('anyone can take a task; the owner is sent as a user id', async () => {
  mockApi({ onPatch: (path, options) => ({ task: { ...zipperTask, owner_id: options.body.owner_id, owner: 'andy' } }) })
  renderPage()
  const panel = await openTasks()
  const owner = within(rowFor(panel, 'Zipper')).getByLabelText('Owner for Zipper')

  expect(within(owner).getAllByRole('option').map((o) => o.textContent)).toEqual(['Unassigned', 'andy (me)'])
  await userEvent.selectOptions(owner, 'andy (me)')
  expect(api).toHaveBeenCalledWith('/tasks/10', { method: 'PATCH', body: { owner_id: 2 } })
  // Non-admins can't list users, so it isn't asked for
  expect(api).not.toHaveBeenCalledWith('/users')
})

test('admins can assign anyone', async () => {
  mockApi({
    users: [{ id: 1, username: 'admin' }, { id: 2, username: 'andy' }, { id: 3, username: 'rodrigo' }],
    onPatch: (path, options) => ({ task: { ...zipperTask, owner_id: options.body.owner_id, owner: 'rodrigo' } }),
  })
  renderPage({ user: { id: 1, username: 'admin', role: 'admin' }, isAdmin: true })
  const panel = await openTasks()
  const owner = within(rowFor(panel, 'Zipper')).getByLabelText('Owner for Zipper')

  await waitFor(() => expect(within(owner).getAllByRole('option')).toHaveLength(4))
  expect(within(owner).getAllByRole('option').map((o) => o.textContent)).toEqual(['Unassigned', 'admin (me)', 'andy', 'rodrigo'])
  await userEvent.selectOptions(owner, 'rodrigo')
  expect(api).toHaveBeenCalledWith('/tasks/10', { method: 'PATCH', body: { owner_id: 3 } })
})

test('a failed save says why on that row', async () => {
  mockApi({ onPatch: () => { throw new Error('Owner not found.') } })
  renderPage()
  const panel = await openTasks()

  await userEvent.selectOptions(within(rowFor(panel, 'Zipper')).getByLabelText('Owner for Zipper'), 'andy (me)')
  expect(await within(rowFor(panel, 'Zipper')).findByRole('alert')).toHaveTextContent("Couldn't save: Owner not found.")
  // Unchanged
  expect(within(rowFor(panel, 'Zipper')).getByLabelText('Owner for Zipper')).toHaveValue('')
})

test("filling in a line's missing info reloads the tasks so its task closes", async () => {
  mockApi({
    onPatch: (path, options) => ({ material: { ...zipper, ...options.body } }),
    tasksAfterSave: [{ ...zipperTask, status: 'done', missing_fields: [] }, labelTask, doneTask],
  })
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Edit Zipper' }))
  await userEvent.type(screen.getByLabelText('Supplier'), 'YKK')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByRole('tab', { name: 'Tasks (1 open)' })).toBeInTheDocument()
})

test('without a tasks API there is no Tasks tab', async () => {
  mockApi({ tasks: null })
  renderPage()
  await screen.findByRole('tab', { name: /^BOM/ })
  await waitFor(() => expect(api).toHaveBeenCalledWith('/projects/7/tasks'))
  expect(screen.queryByRole('tab', { name: /^Tasks/ })).not.toBeInTheDocument()
})

test('a project with nothing missing says so', async () => {
  mockApi({ tasks: [] })
  renderPage()
  await userEvent.click(await screen.findByRole('tab', { name: 'Tasks (0 open)' }))
  expect(screen.getByText('No tasks. Every BOM line has its required details.')).toBeInTheDocument()
})

test("a row stays in place after you change it", async () => {
  mockApi({ onPatch: (path, options) => ({ task: { ...zipperTask, ...options.body } }) })
  renderPage()
  const panel = await openTasks()
  const order = () => within(panel).getAllByRole('link').map((a) => a.textContent)
  expect(order()).toEqual(['Care label · Satin', 'Zipper · Metal zip', 'Shell · Cotton'])

  // Done would normally sort last; it stays put until the next reload
  await userEvent.selectOptions(within(rowFor(panel, 'Zipper')).getByLabelText('Status for Zipper'), 'Done')
  await waitFor(() => expect(within(rowFor(panel, 'Zipper')).getByLabelText('Status for Zipper')).toHaveValue('done'))
  expect(order()).toEqual(['Care label · Satin', 'Zipper · Metal zip', 'Shell · Cotton'])
})
