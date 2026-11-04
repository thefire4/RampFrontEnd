import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import ProjectPage from './ProjectPage.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))

// Every field the backend's missing-info rule checks is filled in
const fullLine = {
  id: 1, name: 'Shell', material: 'Cotton twill', supplier: 'YKK', color: 'Navy', quantity: 1.5, uom: 'yd',
  supplier_contact: 'Ana', location: 'Body', material_size: '58"',
}
// Only the supplier is missing
const openLine = {
  id: 2, name: 'Zipper', material: 'Coil zip', supplier: '', color: 'Black', quantity: 1, uom: 'pc',
  supplier_contact: 'Ana', location: 'Center front', material_size: '#5',
}

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

  expect(within(form).getByRole('alert')).toHaveTextContent('Fix the highlighted field before saving.')
  expect(yieldInput).toHaveAccessibleDescription('Yield must be a number of 0 or more.')
  expect(yieldInput).toHaveAttribute('aria-invalid', 'true')
  expect(yieldInput).toHaveFocus()
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

// RAMP-134: edit form for missing info
test('Needs attention has an Edit button that opens the line with missing fields highlighted', async () => {
  api.mockResolvedValue(projectData)
  renderPage()

  const attention = await screen.findByRole('region', { name: /Needs attention/ })
  await userEvent.click(within(attention).getByRole('button', { name: 'Edit missing info for Zipper' }))

  const form = screen.getByRole('form', { name: 'Edit Zipper' })
  expect(within(form).getByText('Fill in the highlighted field: supplier.')).toBeInTheDocument()

  const supplier = within(form).getByLabelText('Supplier')
  expect(supplier).toHaveFocus()
  expect(supplier).toHaveAccessibleDescription('Missing')
  // Filled-in fields are not flagged
  expect(within(form).getByLabelText('Material')).not.toHaveAccessibleDescription()
})

test('uses the same missing-info rule as the backend', async () => {
  const lines = [
    { ...fullLine, id: 3, name: 'Lining', quantity: 0 },
    { ...fullLine, id: 4, name: 'Label', uom: '' },
    { ...fullLine, id: 5, name: 'Button', location: '', supplier_contact: null },
  ]
  api.mockResolvedValue({ ...projectData, colorways: [{ id: 'c1', name: 'Navy', materials: [fullLine, ...lines] }] })
  renderPage()

  const attention = await screen.findByRole('region', { name: /Needs attention/ })
  expect(within(attention).getByText(/No yield entered/)).toBeInTheDocument()
  expect(within(attention).getByText(/No unit entered/)).toBeInTheDocument()
  expect(within(attention).getByText(/No responsible or placement entered/)).toBeInTheDocument()
  expect(screen.getByText('3 lines missing info')).toBeInTheDocument()
  expect(screen.getByText('1 / 4')).toBeInTheDocument()
})

test('saving fills the gap and updates the counts right away', async () => {
  api.mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') return { material: { ...openLine, supplier: 'YKK' }, missing_bom_items: 0 }
    return projectData
  })
  renderPage()

  expect(await screen.findByText('1 line missing info')).toBeInTheDocument()
  expect(screen.getByText('1 / 2')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Edit missing info for Zipper' }))
  await userEvent.type(screen.getByLabelText('Supplier'), 'YKK')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('BOM complete')).toBeInTheDocument()
  expect(screen.getByText('2 / 2')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Lines covered' })).toHaveAttribute('aria-valuenow', '100')
})

test('a required field cannot be cleared', async () => {
  api.mockResolvedValue(projectData)
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Edit Shell' }))
  const form = screen.getByRole('form', { name: 'Edit Shell' })
  const supplier = within(form).getByLabelText('Supplier')
  await userEvent.clear(supplier)
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  expect(supplier).toHaveAccessibleDescription("Supplier can't be left blank.")
  expect(supplier).toHaveFocus()
  expect(api).not.toHaveBeenCalledWith('/materials/1', expect.anything())

  // Fixing the field clears its error
  await userEvent.type(supplier, 'Talon')
  expect(supplier).not.toHaveAccessibleDescription()
})

test('optional BOM fields can still be cleared', async () => {
  const withNotes = { ...fullLine, notes: 'Wash first' }
  api.mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') return { material: { ...withNotes, notes: null } }
    return { ...projectData, colorways: [{ id: 'c1', name: 'Navy', materials: [withNotes] }] }
  })
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Edit Shell' }))
  await userEvent.clear(screen.getByLabelText('Notes'))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(api).toHaveBeenCalledWith('/materials/1', { method: 'PATCH', body: { notes: null } })
})

test('Cancel closes the form without saving', async () => {
  api.mockResolvedValue(projectData)
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Edit missing info for Zipper' }))
  await userEvent.type(screen.getByLabelText('Supplier'), 'YKK')
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(screen.queryByRole('form')).not.toBeInTheDocument()
  expect(api).toHaveBeenCalledTimes(1)
  expect(screen.getByText('1 line missing info')).toBeInTheDocument()
})

test('project details can be edited, with blank details highlighted', async () => {
  api.mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') {
      return { project: { ...projectData.project, designer: 'Mia Chen', project_date: '2026-07-10' } }
    }
    return sourcedData
  })
  renderPage()

  const details = await screen.findByRole('region', { name: 'Project details' })
  await userEvent.click(within(details).getByRole('button', { name: 'Edit details' }))

  const form = within(details).getByRole('form', { name: 'Edit project details' })
  // Customer and season are filled in; designer is not
  expect(within(form).getByLabelText('Customer')).toHaveValue('Acme')
  expect(within(form).getByLabelText('Customer')).not.toHaveAccessibleDescription()
  const designer = within(form).getByLabelText('Designer')
  expect(designer).toHaveAccessibleDescription('Missing')

  await userEvent.type(designer, 'Mia Chen')
  await userEvent.type(within(form).getByLabelText('Date'), '2026-07-10')
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  expect(api).toHaveBeenCalledWith('/projects/7', {
    method: 'PATCH',
    body: { designer: 'Mia Chen', project_date: '2026-07-10' },
  })
  await waitFor(() => expect(within(details).queryByRole('form')).not.toBeInTheDocument())
  const designerValue = within(details).getByText('Mia Chen').closest('dd')
  expect(designerValue).toHaveTextContent('Entered by hand')
  // A plain date shows as that calendar day, not the day before
  expect(within(details).getByText(/Jul 10, 2026/)).toBeInTheDocument()
})

test('project details show server errors and keep the form open', async () => {
  api.mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') throw new Error('Season is too long.')
    return projectData
  })
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }))
  const form = screen.getByRole('form', { name: 'Edit project details' })
  await userEvent.type(within(form).getByLabelText('Designer'), 'Mia Chen')
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  expect(await within(form).findByRole('alert')).toHaveTextContent('Season is too long.')
  expect(within(form).getByLabelText('Designer')).toHaveValue('Mia Chen')
})

test('closing project details without changes does not call the API', async () => {
  api.mockResolvedValue(projectData)
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }))
  await userEvent.keyboard('{Escape}')

  expect(screen.queryByRole('form')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit details' })).toBeInTheDocument()
  expect(api).toHaveBeenCalledTimes(1)
})

// Found testing with the real sample files (RAMP-130): long file names flooded the page
const longName = "DW11038_M's Snowcrest_Shirt Jac_ REV2 BTUSA PO 1654 07.10.2026 (2).xlsx"
const longFile = { ...bomFile, file_name: longName }

test('project details name their file once and keep long file names short', async () => {
  const fields = Object.fromEntries(
    ['customer', 'style_no', 'po_no'].map((f) => [f, { value: 'x', source: { ...longFile, row: 4 } }])
  )
  fields.season = { value: 'SS27', source: byHand }
  api.mockResolvedValue({
    ...projectData,
    project: { ...projectData.project, po_no: '1654', fields },
  })
  renderPage()

  const details = await screen.findByRole('region', { name: 'Project details' })
  // One link for the whole panel, with a short label and the full name on hover
  const links = within(details).getAllByRole('link', { name: /DW11038/ })
  expect(links).toHaveLength(1)
  expect(links[0]).toHaveTextContent("DW11038_M's Snowcr…(2).xlsx")
  expect(links[0]).toHaveAttribute('title', `From ${longName} (sheet NAVY, row 4). Opens the original file.`)
  expect(within(details).getByText(/Details from/)).toBeInTheDocument()

  // A value from somewhere else still gets its own label
  expect(within(details).getByText('SS27').closest('dd')).toHaveTextContent('Entered by hand')
  // Hovering a value still shows its exact source
  expect(within(details).getByText('Acme').closest('dd')).toHaveAttribute('title', `From ${longName} (sheet NAVY, row 4)`)
})

test('BOM rows shorten long file names too', async () => {
  const line = { ...fullLine, fields: { name: { value: 'Shell', source: longFile }, supplier: { value: 'YKK', source: longFile } } }
  api.mockResolvedValue({ ...projectData, colorways: [{ id: 'c1', name: 'Navy', materials: [line] }] })
  renderPage()

  const bom = await screen.findByRole('region', { name: 'BOM lines for Navy' })
  const link = within(bom).getByRole('link', { name: /DW11038/ })
  expect(link.textContent.length).toBeLessThanOrEqual(28)
  expect(link).toHaveAttribute('title', expect.stringContaining(longName))
})
