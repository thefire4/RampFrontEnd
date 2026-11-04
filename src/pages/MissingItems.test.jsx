import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import MissingItems from './MissingItems.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
afterEach(() => vi.clearAllMocks())

const project = { id: 7, name: 'Test Jacket' }
const zipper = {
  id: 2, name: 'Zipper', article_no: 'ZP-5', colorway_name: 'Navy', material: 'Coil zip', supplier: null,
  supplier_contact: 'Jane', color: 'Black', location: 'Center front', material_size: '5',
  quantity: 1, uom: null, missing_fields: ['supplier', 'uom'],
}
const snap = {
  id: 3, name: 'Snap', colorway_name: 'Olive', material: 'Brass', supplier: 'YKK', supplier_contact: null,
  color: '', location: 'Placket', material_size: '24L', quantity: 0, uom: 'pcs',
  missing_fields: ['supplier_contact', 'color', 'quantity'],
}

function backend(items) {
  api.mockImplementation(async (path) => {
    if (path === '/projects/7') return { project, colorways: [], files: [] }
    if (path === '/projects/7/missing-items') return { project_id: 7, missing_items: items, total: items.length }
    throw new Error(`unexpected ${path}`)
  })
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/projects/7/missing']}>
      <Routes>
        <Route path="/projects/:projectId/missing" element={<MissingItems />} />
        <Route path="/projects/:projectId/parts/:partId" element={<h1>Part page</h1>} />
        <Route path="/projects/:projectId" element={<h1>Project page</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

const rowFor = (name) => screen.getByRole('link', { name }).closest('tr')

test('shows a loading message while the list loads', () => {
  api.mockReturnValue(new Promise(() => {}))
  renderPage()
  expect(screen.getByRole('status')).toHaveTextContent('Loading missing items…')
})

test('lists every missing item for the selected project', async () => {
  backend([zipper, snap])
  renderPage()

  expect(await screen.findByRole('heading', { name: 'Missing items' })).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith('/projects/7/missing-items')
  expect(screen.getByText(/2 BOM lines in Test Jacket still need details/)).toBeInTheDocument()

  const table = screen.getByRole('region', { name: 'Missing items' })
  expect(within(table).getAllByRole('row')).toHaveLength(3) 
  expect(within(rowFor('Zipper')).getByText('Navy')).toBeInTheDocument()
  expect(within(rowFor('Snap')).getByText('Olive')).toBeInTheDocument()
})

test('highlights exactly the missing fields on each line', async () => {
  backend([zipper, snap])
  renderPage()
  await screen.findByRole('link', { name: 'Zipper' })

  const zipperRow = rowFor('Zipper')
  const zipperGaps = zipperRow.querySelectorAll('td.cell-missing')
  // Supplier is blank; yield has a number but no unit
  expect(zipperGaps).toHaveLength(2)
  expect(zipperGaps[0]).toHaveTextContent('Missing')
  expect(zipperGaps[1]).toHaveTextContent('1')
  expect(zipperGaps[1]).toHaveTextContent('No unit')
  expect(within(zipperRow).getByText('supplier, unit')).toBeInTheDocument()

  const snapRow = rowFor('Snap')
  expect(snapRow.querySelectorAll('td.cell-missing')).toHaveLength(3)
  expect(within(snapRow).getByText('responsible, color, yield')).toBeInTheDocument()
  // Filled-in fields are not highlighted
  expect(within(snapRow).getByText('YKK').closest('td')).not.toHaveClass('cell-missing')
})

test('clicking a part opens its detail view', async () => {
  backend([zipper])
  renderPage()

  await userEvent.click(await screen.findByRole('link', { name: 'Zipper' }))
  expect(await screen.findByRole('heading', { name: 'Part page' })).toBeInTheDocument()
})

test('breadcrumb links back to the project', async () => {
  backend([zipper])
  renderPage()

  const crumbs = await screen.findByRole('navigation', { name: 'Breadcrumb' })
  expect(within(crumbs).getByRole('link', { name: 'Test Jacket' })).toHaveAttribute('href', '/projects/7')
})

test('shows a message when the project has no missing items', async () => {
  backend([])
  renderPage()

  expect(await screen.findByRole('heading', { name: 'Nothing missing' })).toBeInTheDocument()
  expect(screen.getByText('This project has no missing BOM items.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to project' })).toHaveAttribute('href', '/projects/7')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

test('shows not-found for a project that does not exist', async () => {
  api.mockRejectedValue(Object.assign(new Error('Project not found.'), { status: 404 }))
  renderPage()
  expect(await screen.findByRole('heading', { name: 'Project not found' })).toBeInTheDocument()
})