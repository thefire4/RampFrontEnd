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
// RAMP-136: where each value came from
const bomFile = { kind: 'file', file_name: 'BOM_DW11038.xlsx', file_id: 9, url: '/api/projects/7/files/9', sheet: 'NAVY', row: 12 }
const byHand = { kind: 'manual', file_name: null, file_id: null, url: null }
const fromFile = (value, row) => ({ value, source: { ...bomFile, row } })

const sourcedData = {
  ...projectData,
  project: {
    ...projectData.project,
    fields: {
      customer: { value: 'Acme', source: bomFile },
      season: { value: 'SS27', source: byHand },
    },
  },
  colorways: [{
    id: 'c1',
    name: 'Navy',
    materials: [{
      ...fullLine,
      fields: {
        name: fromFile('Shell', 12),
        material: fromFile('Cotton twill', 12),
        supplier: fromFile('YKK', 12),
        color: { value: 'Navy', source: byHand },
        quantity: fromFile(1.5, 12),
        uom: fromFile('yd', 12),
      },
    }, openLine],
  }],
}

test('project details show where each value came from', async () => {
  api.mockResolvedValue(sourcedData)
  renderPage()

  const details = await screen.findByRole('region', { name: 'Project details' })
  const fileLink = within(details).getByRole('link', { name: 'BOM_DW11038.xlsx' })
  expect(fileLink).toHaveAttribute('href', '/api/projects/7/files/9')
  expect(fileLink).toHaveAttribute('target', '_blank')
  expect(within(details).getByText('Entered by hand')).toBeInTheDocument()
})

test('BOM shows the file once per line and labels values from elsewhere', async () => {
  api.mockResolvedValue(sourcedData)
  renderPage()

  const bom = await screen.findByRole('region', { name: 'BOM lines for Navy' })
  const row = within(bom).getByText('YKK').closest('tr')

  // One file label for the row, not one per value
  expect(within(row).getAllByRole('link', { name: 'BOM_DW11038.xlsx' })).toHaveLength(1)
  // The color was typed in, so it gets its own label
  expect(within(row).getByText('Navy').closest('td')).toHaveTextContent('Entered by hand')
  // Hovering a value shows its exact source
  expect(within(row).getByText('YKK').closest('td')).toHaveAttribute('title', 'From BOM_DW11038.xlsx (sheet NAVY, row 12)')
})

test('values without a known source show no label', async () => {
  api.mockResolvedValue(projectData)
  renderPage()

  await screen.findByRole('region', { name: 'Project details' })
  expect(screen.queryByText('Entered by hand')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /\.xlsx/ })).not.toBeInTheDocument()
})

test('an edited value is labelled as entered by hand', async () => {
  api.mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') return { material: { ...fullLine, supplier: 'Talon' } }
    return sourcedData
  })
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Edit Shell' }))
  const form = screen.getByRole('form', { name: 'Edit Shell' })
  const supplier = within(form).getByLabelText('Supplier')
  await userEvent.clear(supplier)
  await userEvent.type(supplier, 'Talon')
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  const cell = (await screen.findByText('Talon')).closest('td')
  expect(cell).toHaveTextContent('Entered by hand')
  expect(cell).toHaveAttribute('title', 'Entered by hand')
})
