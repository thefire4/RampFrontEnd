import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import MissingItems from './MissingItems.jsx'
import ProjectPage from './ProjectPage.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
afterEach(() => vi.clearAllMocks())

// RAMP-145: link BOM lines to vendors and show who to contact
const ykk = { id: 1, name: 'YKK', contact_name: 'Mia Chen', email: 'mia@ykk.example', phone: '+1 212 555 0101' }
const riri = { id: 2, name: 'RIRI', contact_name: null, email: 'sales@riri.example', phone: null }

const full = {
  id: 1, name: 'Snap', material: 'Brass', supplier: 'YKK', supplier_contact: 'Ana', color: 'AN4',
  quantity: 11, uom: 'pc', location: 'CF', material_size: '24L', vendor_id: 1,
}
const open = { ...full, id: 2, name: 'Zipper', material: 'Metal zip', supplier: 'RIRI', location: '', vendor_id: null }

const projectData = {
  project: { id: 7, name: 'Test Jacket', stage: 'in progress' },
  colorways: [{ id: 'c1', name: 'Black', materials: [full, open] }],
  files: [],
}

function mockApi({ vendors = [ykk, riri], onPatch, data = projectData } = {}) {
  api.mockImplementation(async (path, options) => {
    if (path === '/vendors') {
      if (vendors === null) throw Object.assign(new Error('Not found.'), { status: 404 })
      return { vendors }
    }
    if (options?.method === 'PATCH') return onPatch(path, options)
    if (path.endsWith('/missing-items')) return { missing_items: [{ ...open, vendor_id: 1, colorway_name: 'Black', missing_fields: ['location'] }] }
    return data
  })
}

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectPage />} />
        <Route path="/projects/:projectId/missing" element={<MissingItems />} />
      </Routes>
    </MemoryRouter>
  )
}

test("a BOM line shows its vendor's contact", async () => {
  mockApi()
  renderAt('/projects/7')

  const bom = await screen.findByRole('region', { name: 'BOM lines for Black' })
  const cell = within(bom).getByRole('link', { name: 'YKK' }).closest('td')
  expect(within(bom).getByRole('link', { name: 'YKK' })).toHaveAttribute('href', '/vendors/1')
  expect(cell).toHaveTextContent('Mia Chen')
  expect(within(cell).getByRole('link', { name: 'mia@ykk.example' })).toHaveAttribute('href', 'mailto:mia@ykk.example')
})

test('the BOM line form has a vendor dropdown that links the line', async () => {
  mockApi({ onPatch: (path, options) => ({ material: { ...open, ...options.body } }) })
  renderAt('/projects/7')

  await userEvent.click(await screen.findByRole('button', { name: 'Edit Zipper' }))
  const form = screen.getByRole('form', { name: 'Edit Zipper' })
  const picker = within(form).getByLabelText('Vendor')
  expect(within(picker).getAllByRole('option').map((o) => o.textContent)).toEqual(['No vendor', 'RIRI', 'YKK'])
  expect(picker).toHaveValue('')

  await userEvent.selectOptions(picker, 'RIRI')
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  // Sent as a number, the way the API expects
  expect(api).toHaveBeenCalledWith('/materials/2', { method: 'PATCH', body: { vendor_id: 2 } })
  // The line is still missing info, so RIRI shows in Needs attention too; check the table row
  const bom = screen.getByRole('region', { name: 'BOM lines for Black' })
  const row = (await within(bom).findByRole('link', { name: 'RIRI' })).closest('tr')
  expect(row).toHaveTextContent('No contact person')
  expect(within(row).getByRole('link', { name: 'sales@riri.example' })).toBeInTheDocument()
})

test('a vendor can be unlinked', async () => {
  mockApi({ onPatch: (path, options) => ({ material: { ...full, ...options.body } }) })
  renderAt('/projects/7')

  await userEvent.click(await screen.findByRole('button', { name: 'Edit Snap' }))
  const picker = screen.getByLabelText('Vendor')
  expect(picker).toHaveValue('1')
  await userEvent.selectOptions(picker, 'No vendor')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(api).toHaveBeenCalledWith('/materials/1', { method: 'PATCH', body: { vendor_id: null } })
})

test('Needs attention shows the vendor contact to follow up with', async () => {
  mockApi({ data: { ...projectData, colorways: [{ id: 'c1', name: 'Black', materials: [full, { ...open, vendor_id: 1 }] }] } })
  renderAt('/projects/7')

  const attention = await screen.findByRole('region', { name: /Needs attention/ })
  expect(attention).toHaveTextContent('Vendor: YKK')
  expect(within(attention).getByRole('link', { name: '+1 212 555 0101' })).toHaveAttribute('href', 'tel:+12125550101')
})

test('the missing-items list shows the vendor contact', async () => {
  mockApi()
  renderAt('/projects/7/missing')

  const table = await screen.findByRole('region', { name: 'Missing items' })
  expect(within(table).getByRole('link', { name: 'YKK' })).toHaveAttribute('href', '/vendors/1')
  expect(table).toHaveTextContent('Mia Chen')
})

test('without a vendors API, the page works and the dropdown is hidden', async () => {
  mockApi({ vendors: null })
  renderAt('/projects/7')

  await userEvent.click(await screen.findByRole('button', { name: 'Edit Zipper' }))
  expect(screen.queryByLabelText('Vendor')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Supplier')).toBeInTheDocument()
})
