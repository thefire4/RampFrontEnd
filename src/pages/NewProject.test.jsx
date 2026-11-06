import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import NewProject from './NewProject.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
afterEach(() => vi.clearAllMocks())

// The file picker's accept filter is skipped so tests can choose files a user could still drop in
const user = () => userEvent.setup({ applyAccept: false })

const fileOf = (name, size = 2048) => {
  const file = new File(['x'], name)
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/projects/new']}>
      <Routes>
        <Route path="/projects/new" element={<NewProject />} />
        <Route path="/projects/:projectId" element={<h1>Project page</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

const filesInput = () => screen.getByLabelText('Files')
const uploads = () => screen.getByRole('list', { name: 'Chosen files' })
const rowFor = (name) => within(uploads()).getByText(name).closest('li')

test('creates the project from the first file and adds the rest', async () => {
  api.mockImplementation(async (path) => (path === '/projects/import' ? { project_id: 42 } : {}))
  const u = user()
  renderPage()

  await u.type(screen.getByLabelText('Project name'), 'Zip Jacket')
  await u.upload(filesInput(), [fileOf('BOM.xlsx'), fileOf('spec.pdf')])
  await u.click(screen.getByRole('button', { name: 'Create project' }))

  expect(await screen.findByRole('heading', { name: 'Project page' })).toBeInTheDocument()
  const [firstPath, firstOptions] = api.mock.calls[0]
  expect(firstPath).toBe('/projects/import')
  expect(firstOptions.body.get('file').name).toBe('BOM.xlsx')
  expect(firstOptions.body.get('name')).toBe('Zip Jacket')
  expect(api.mock.calls[1][0]).toBe('/projects/42/import')
  expect(api.mock.calls[1][1].body.get('file').name).toBe('spec.pdf')
})

test('warns about a wrong file type as soon as it is chosen', async () => {
  const u = user()
  renderPage()

  await u.upload(filesInput(), [fileOf('notes.docx'), fileOf('BOM.xlsx')])

  expect(rowFor('notes.docx')).toHaveTextContent("Can't upload")
  expect(rowFor('notes.docx')).toHaveTextContent(".docx files can't be imported. Upload an Excel (.xlsx, .xlsm), CSV or PDF file.")
  expect(rowFor('BOM.xlsx')).toHaveTextContent('Ready')

  // Nothing is sent while a bad file is still chosen
  await u.click(screen.getByRole('button', { name: 'Create project' }))
  expect(screen.getByRole('alert')).toHaveTextContent("Some files can't be uploaded. Remove them before creating the project.")
  expect(api).not.toHaveBeenCalled()

  api.mockResolvedValue({ project_id: 9 })
  await u.click(screen.getByRole('button', { name: 'Remove notes.docx' }))
  await u.click(screen.getByRole('button', { name: 'Create project' }))
  expect(await screen.findByRole('heading', { name: 'Project page' })).toBeInTheDocument()
})

test('warns about a file over 25 MB before uploading', async () => {
  const u = user()
  renderPage()

  await u.upload(filesInput(), fileOf('huge.xlsx', 40 * 1024 * 1024))

  expect(rowFor('huge.xlsx')).toHaveTextContent('The file is 40.0 MB. The limit is 25.0 MB.')
})

test("shows the backend's reason when the first file fails, and the file can be tried again", async () => {
  api.mockRejectedValueOnce(new Error("Could not import 'BOM.xlsx': No BOM sheet found."))
  const u = user()
  renderPage()

  await u.upload(filesInput(), fileOf('BOM.xlsx'))
  await u.click(screen.getByRole('button', { name: 'Create project' }))

  expect(await screen.findByText("Could not import 'BOM.xlsx': No BOM sheet found.")).toBeInTheDocument()
  expect(rowFor('BOM.xlsx')).toHaveTextContent('Failed')
  expect(screen.getByRole('alert')).toHaveTextContent("The project wasn't created.")
  // Still on the form, nothing lost
  expect(screen.getByLabelText('Project name')).toBeEnabled()

  api.mockResolvedValueOnce({ project_id: 5 })
  await u.click(screen.getByRole('button', { name: 'Try BOM.xlsx again' }))
  expect(await screen.findByRole('heading', { name: 'Project page' })).toBeInTheDocument()
})

test('shows sizes in MB when the backend says a file is too large', async () => {
  api.mockRejectedValueOnce(new Error("File 'BOM.xlsx' is too large (31457280 bytes; maximum is 26214400 bytes)."))
  const u = user()
  renderPage()

  await u.upload(filesInput(), fileOf('BOM.xlsx'))
  await u.click(screen.getByRole('button', { name: 'Create project' }))

  expect(await screen.findByText("File 'BOM.xlsx' is too large (30.0 MB; the limit is 25.0 MB).")).toBeInTheDocument()
})

test('when a later file fails, the project still exists and the file can be retried', async () => {
  api.mockImplementation(async (path, options) => {
    if (path === '/projects/import') return { project_id: 42 }
    if (options.body.get('file').name === 'broken.csv') throw new Error("Could not import 'broken.csv': The file is not valid CSV.")
    return {}
  })
  const u = user()
  renderPage()

  await u.upload(filesInput(), [fileOf('BOM.xlsx'), fileOf('broken.csv')])
  await u.click(screen.getByRole('button', { name: 'Create project' }))

  expect(await screen.findByText(/The project was created, but one file didn't upload/)).toBeInTheDocument()
  expect(rowFor('BOM.xlsx')).toHaveTextContent('Uploaded')
  expect(rowFor('broken.csv')).toHaveTextContent("Could not import 'broken.csv': The file is not valid CSV.")
  expect(screen.getByRole('link', { name: 'Open project' })).toHaveAttribute('href', '/projects/42')

  // The retry adds the file to the project that already exists
  api.mockResolvedValue({})
  await u.click(screen.getByRole('button', { name: 'Try broken.csv again' }))
  await waitFor(() => expect(api).toHaveBeenLastCalledWith('/projects/42/import', expect.anything()))
  expect(await screen.findByRole('heading', { name: 'Project page' })).toBeInTheDocument()
})

test('asks for a file when none is chosen', async () => {
  const u = user()
  renderPage()

  await u.click(screen.getByRole('button', { name: 'Create project' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Choose at least one file to upload.')
})
