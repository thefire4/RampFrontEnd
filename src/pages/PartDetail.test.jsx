import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import PartDetail from './PartDetail.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
afterEach(() => vi.clearAllMocks())

const project = { id: 7, name: 'Test Jacket' }
const zipper = {
  id: 2, name: 'Zipper', article_no: 'ZP-5', colorway_name: 'Navy', material: 'Coil zip', supplier: null,
  supplier_contact: 'Jane', color: 'Black', location: 'Center front', material_size: '5',
  quantity: 1, uom: null, notes: 'Lock slider', missing_fields: ['supplier', 'uom'],
}

function backend(part) {
  api.mockImplementation(async (path) => {
    if (path === '/projects/7') return { project, colorways: [], files: [] }
    if (path === '/projects/7/materials/2') return { material: part }
    throw new Error(`unexpected ${path}`)
  })
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/projects/7/parts/2']}>
      <Routes><Route path="/projects/:projectId/parts/:partId" element={<PartDetail />} /></Routes>
    </MemoryRouter>
  )
}

const field = (label) => within(screen.getByRole('region', { name: 'Part details' })).getByText(label).closest('div')

test('shows a loading message while the part loads', () => {
  api.mockReturnValue(new Promise(() => {}))
  renderPage()
  expect(screen.getByRole('status')).toHaveTextContent('Loading part…')
})

test('shows every field of the part', async () => {
  backend(zipper)
  renderPage()

  expect(await screen.findByRole('heading', { level: 1, name: 'Zipper' })).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith('/projects/7/materials/2')
  expect(screen.getByText('ZP-5', { selector: '.chip' })).toBeInTheDocument()
  expect(screen.getByText('Colorway: Navy')).toBeInTheDocument()

  expect(field('Material')).toHaveTextContent('Coil zip')
  expect(field('Responsible')).toHaveTextContent('Jane')
  expect(field('Color')).toHaveTextContent('Black')
  expect(field('Placement')).toHaveTextContent('Center front')
  expect(field('Size / width')).toHaveTextContent('5')
  expect(field('Yield')).toHaveTextContent('1')
  expect(field('Article #')).toHaveTextContent('ZP-5')
  expect(field('Notes')).toHaveTextContent('Lock slider')
})

test('highlights the fields that are missing', async () => {
  backend(zipper)
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'Zipper' })

  expect(screen.getByText('Missing supplier, unit')).toBeInTheDocument()
  expect(field('Supplier')).toHaveClass('detail-missing')
  expect(field('Supplier')).toHaveTextContent('Missing')
  expect(field('Unit')).toHaveClass('detail-missing')
  expect(field('Material')).not.toHaveClass('detail-missing')
  expect(screen.getByRole('link', { name: 'Back to missing items' })).toHaveAttribute('href', '/projects/7/missing')
})

test('a zero yield is flagged even though it has a value', async () => {
  backend({ ...zipper, supplier: 'YKK', uom: 'pcs', quantity: 0, missing_fields: ['quantity'] })
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'Zipper' })

  expect(field('Yield')).toHaveClass('detail-missing')
  expect(field('Yield')).toHaveTextContent('needs a value above 0')
})

test('a complete part says so', async () => {
  backend({ ...zipper, supplier: 'YKK', uom: 'pcs', missing_fields: [] })
  renderPage()

  expect(await screen.findByText('Complete')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Back to missing items' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to project' })).toHaveAttribute('href', '/projects/7')
})

test('shows not-found for a part that does not exist', async () => {
  api.mockRejectedValue(Object.assign(new Error('BOM line not found.'), { status: 404 }))
  renderPage()
  expect(await screen.findByRole('heading', { name: 'Part not found' })).toBeInTheDocument()
})