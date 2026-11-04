import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import ProjectPage from './ProjectPage.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
afterEach(() => vi.clearAllMocks())

// Every required field filled in, so these tests pass under the 4-field or the 8-field rule
const complete = {
  id: 11, name: 'Shell', material: 'Cotton twill', supplier: 'Acme Mills', supplier_contact: 'Jane',
  color: 'Navy', quantity: 1.5, uom: 'yd', location: 'Body', material_size: '58 in',
}
const noSupplier = { ...complete, id: 12, name: 'Zipper', material: 'Coil zip', supplier: '' }
const noColor = { ...complete, id: 13, name: 'Snap', material: 'Brass', color: '' }

const overviewData = (colorways) => ({
  project: { id: 7, name: 'Test Jacket', stage: 'in progress' },
  colorways,
  files: [],
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/projects/7']}>
      <Routes><Route path="/projects/:projectId" element={<ProjectPage />} /></Routes>
    </MemoryRouter>
  )
}

test('overview shows complete vs missing counts for the whole project', async () => {
  api.mockResolvedValue(overviewData([
    { id: 'c1', name: 'Navy', materials: [complete, noSupplier] },
    { id: 'c2', name: 'Olive', materials: [noColor] },
  ]))
  renderPage()

  const overview = await screen.findByRole('region', { name: 'BOM completeness' })
  const card = (label) => within(overview).getByText(label).closest('.stat-card')
  expect(card('Complete')).toHaveTextContent('1')
  expect(card('Missing info')).toHaveTextContent('2')
  expect(card('Total lines')).toHaveTextContent('3')
  expect(card('Total lines')).toHaveTextContent('across 2 colorways')
  expect(within(overview).getByRole('progressbar', { name: 'Project BOM complete' })).toHaveAttribute('aria-valuenow', '33')
  expect(within(overview).getByText('33% complete')).toBeInTheDocument()
})

test('overview counts update as soon as a missing field is saved', async () => {
  api.mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') return { material: { ...noSupplier, supplier: 'YKK' } }
    return overviewData([{ id: 'c1', name: 'Navy', materials: [complete, noSupplier] }])
  })
  renderPage()

  const overview = await screen.findByRole('region', { name: 'BOM completeness' })
  expect(within(overview).getByText('50% complete')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Edit Zipper' }))
  const form = screen.getByRole('form', { name: 'Edit Zipper' })
  await userEvent.type(within(form).getByLabelText(/Supplier/), 'YKK')
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  expect(await within(overview).findByText('100% complete')).toBeInTheDocument()
})

test('overview says when a project has no BOM yet', async () => {
  api.mockResolvedValue(overviewData([]))
  renderPage()

  const overview = await screen.findByRole('region', { name: 'BOM completeness' })
  expect(overview).toHaveTextContent('No BOM lines yet')
})

test('shows a loading message while the project loads', async () => {
  api.mockReturnValue(new Promise(() => {}))
  renderPage()
  expect(screen.getByRole('status')).toHaveTextContent('Loading project…')
})