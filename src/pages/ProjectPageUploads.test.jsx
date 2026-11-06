import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import ProjectPage from './ProjectPage.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
afterEach(() => vi.clearAllMocks())

// RAMP-132: uploading more files from the project page's Files tab
const user = () => userEvent.setup({ applyAccept: false })

const line = {
  id: 1, name: 'Shell', material: 'Cotton twill', supplier: 'YKK', supplier_contact: 'Ana',
  color: 'Navy', quantity: 1, uom: 'yd', location: 'Body', material_size: '58"',
}
const before = {
  project: { id: 7, name: 'Test Jacket', stage: 'in progress' },
  colorways: [{ id: 'c1', name: 'Navy', materials: [line] }],
  files: [{ id: 'f1', file_name: 'BOM.xlsx', file_type: 'xlsx', url: '/api/files/1' }],
}
const after = {
  ...before,
  colorways: [{ id: 'c1', name: 'Navy', materials: [line, { ...line, id: 2, name: 'Lining' }] }],
  files: [...before.files, { id: 'f2', file_name: 'trims.csv', file_type: 'csv', url: '/api/files/2' }],
}

const fileOf = (name, size = 2048) => {
  const file = new File(['x'], name)
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/projects/7']}>
      <Routes><Route path="/projects/:projectId" element={<ProjectPage />} /></Routes>
    </MemoryRouter>
  )
}

async function openFiles(u) {
  await u.click(await screen.findByRole('tab', { name: /^Files/ }))
  return screen.getByRole('region', { name: 'Files' })
}

test('an uploaded file is added and the project reloads with it', async () => {
  let uploaded = false
  api.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') { uploaded = true; return { project_id: 7 } }
    return uploaded ? after : before
  })
  const u = user()
  renderPage()
  const files = await openFiles(u)

  await u.upload(within(files).getByLabelText('Upload files'), fileOf('trims.csv'))

  const [path, options] = api.mock.calls.find(([, o]) => o?.method === 'POST')
  expect(path).toBe('/projects/7/import')
  expect(options.body.get('file').name).toBe('trims.csv')
  expect(await within(files).findByRole('link', { name: 'trims.csv' })).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Uploads' })).getByText('trims.csv').closest('li')).toHaveTextContent('Uploaded')
  // The new BOM line from the file shows up too
  expect(screen.getByRole('tab', { name: 'BOM (2)' })).toBeInTheDocument()
})

test('a wrong file type is flagged right away and never sent', async () => {
  api.mockResolvedValue(before)
  const u = user()
  renderPage()
  const files = await openFiles(u)

  await u.upload(within(files).getByLabelText('Upload files'), fileOf('front.png'))

  const row = within(screen.getByRole('list', { name: 'Uploads' })).getByText('front.png').closest('li')
  expect(row).toHaveTextContent(".png files can't be imported. Upload an Excel (.xlsx, .xlsm), CSV or PDF file.")
  expect(api).not.toHaveBeenCalledWith('/projects/7/import', expect.anything())
})

test('a failed upload says why, the page keeps working, and it can be tried again', async () => {
  let failNext = true
  let uploaded = false
  api.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') {
      if (failNext) { failNext = false; throw new Error("Could not import 'trims.csv': The file is not valid CSV.") }
      uploaded = true
      return {}
    }
    return uploaded ? after : before
  })
  const u = user()
  renderPage()
  const files = await openFiles(u)

  await u.upload(within(files).getByLabelText('Upload files'), fileOf('trims.csv'))

  const row = () => within(screen.getByRole('list', { name: 'Uploads' })).getByText('trims.csv').closest('li')
  await waitFor(() => expect(row()).toHaveTextContent('Failed'))
  expect(row()).toHaveTextContent("Could not import 'trims.csv': The file is not valid CSV.")
  // Existing files and the rest of the page are untouched
  expect(within(files).getByRole('link', { name: 'BOM.xlsx' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Test Jacket' })).toBeInTheDocument()

  await u.click(within(row()).getByRole('button', { name: 'Try trims.csv again' }))
  expect(await within(files).findByRole('link', { name: 'trims.csv' })).toBeInTheDocument()
  expect(row()).toHaveTextContent('Uploaded')
})

test('the same file can be chosen again after removing it', async () => {
  api.mockResolvedValue(before)
  const u = user()
  renderPage()
  const files = await openFiles(u)
  const input = within(files).getByLabelText('Upload files')

  await u.upload(input, fileOf('notes.docx'))
  await u.click(screen.getByRole('button', { name: 'Remove notes.docx' }))
  expect(screen.queryByRole('list', { name: 'Uploads' })).not.toBeInTheDocument()

  await u.upload(input, fileOf('notes.docx'))
  expect(within(screen.getByRole('list', { name: 'Uploads' })).getByText('notes.docx')).toBeInTheDocument()
})
