import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import ProjectPage from './ProjectPage.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))

const fullLine = { id: 1, name: 'Shell', material: 'Cotton twill', supplier: 'YKK', color: 'Navy', quantity: 1.5, uom: 'yd' }
const openLine = { id: 2, name: 'Zipper', material: 'Coil zip', supplier: '', color: 'Black', quantity: 1 }

const projectData = {
  project: { id: 7, name: 'Test Jacket', customer: 'Acme', season: 'SS27', style_no: 'ST-100', stage: 'in progress' },
  colorways: [{ id: 'c1', name: 'Navy', materials: [fullLine, openLine] }],
  files: [
    { id: 'f1', file_name: 'front.png', file_type: 'image/png', url: '/files/front.png' },
    { id: 'f2', file_name: 'spec.pdf', file_type: 'application/pdf', url: '/files/spec.pdf' },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/projects/7']}>
      <Routes><Route path="/projects/:projectId" element={<ProjectPage />} /></Routes>
    </MemoryRouter>
  )
}

afterEach(() => vi.clearAllMocks())

test('shows details, sketches and BOM', async () => {
  api.mockResolvedValue(projectData)
  renderPage()

  expect(await screen.findByRole('heading', { level: 1, name: 'Test Jacket' })).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith('/projects/7')

  const details = screen.getByRole('region', { name: 'Project details' })
  expect(within(details).getByText('Acme')).toBeInTheDocument()
  expect(within(details).getByText('SS27')).toBeInTheDocument()

  // Only the image counts as a sketch
  expect(screen.getByRole('img', { name: 'front.png' })).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: 'spec.pdf' })).not.toBeInTheDocument()

  const bom = screen.getByRole('region', { name: 'BOM lines for Navy' })
  expect(within(bom).getByText(/Cotton twill/)).toBeInTheDocument()
  expect(within(bom).getByText('YKK')).toBeInTheDocument()
})

test('flags BOM lines with missing required fields', async () => {
  api.mockResolvedValue(projectData)
  renderPage()

  const attention = await screen.findByRole('region', { name: /Needs attention/ })
  expect(within(attention).getByText(/No supplier entered/)).toBeInTheDocument()
})

test('files tab lists uploaded files', async () => {
  api.mockResolvedValue(projectData)
  renderPage()

  await userEvent.click(await screen.findByRole('tab', { name: 'Files (2)' }))
  expect(screen.getByRole('link', { name: 'spec.pdf' })).toBeInTheDocument()
})

test('editing a BOM line saves changes and clears its flag', async () => {
  api.mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') return { material: { ...openLine, supplier: 'YKK' } }
    return projectData
  })
  renderPage()

  await screen.findByRole('region', { name: /Needs attention/ })
  await userEvent.click(screen.getByRole('button', { name: 'Edit Zipper' }))
  const form = screen.getByRole('form', { name: 'Edit Zipper' })
  await userEvent.type(within(form).getByLabelText('Supplier'), 'YKK')
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  expect(api).toHaveBeenCalledWith('/materials/2', { method: 'PATCH', body: { supplier: 'YKK' } })
  await waitFor(() =>
    expect(screen.queryByRole('region', { name: /Needs attention/ })).not.toBeInTheDocument()
  )
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})

test('shows an error and keeps the editor open when saving fails', async () => {
  api.mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') throw new Error('Could not save')
    return projectData
  })
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Edit Zipper' }))
  const form = screen.getByRole('form', { name: 'Edit Zipper' })
  await userEvent.type(within(form).getByLabelText('Supplier'), 'YKK')
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  expect(await within(form).findByRole('alert')).toHaveTextContent('Could not save')
})

test('rejects a negative yield without calling the API', async () => {
  api.mockResolvedValue(projectData)
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Edit Zipper' }))
  const form = screen.getByRole('form', { name: 'Edit Zipper' })
  const yieldInput = within(form).getByLabelText('Yield')
  await userEvent.clear(yieldInput)
  await userEvent.type(yieldInput, '-2')
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  expect(within(form).getByRole('alert')).toHaveTextContent('Yield must be a number of 0 or more.')
  expect(api).not.toHaveBeenCalledWith('/materials/2', expect.anything())
})

test('shows not-found state on 404', async () => {
  api.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }))
  renderPage()

  expect(await screen.findByRole('heading', { name: 'Project not found' })).toBeInTheDocument()
})