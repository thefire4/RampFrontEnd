import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import VendorDetail from './VendorDetail.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
afterEach(() => vi.clearAllMocks())

// RAMP-145 / RAMP-143: a vendor's contact and every BOM line linked to it
const ykk = { id: 1, name: 'YKK', contact_name: 'Mia Chen', email: 'mia@ykk.example', phone: '+1 212 555 0101', notes: 'Snaps and zips' }
const lines = [
  { id: 9, name: 'Snap', material: '24L brass', color: 'AN4', quantity: 11, uom: 'pc', project_id: 1, project_name: 'Snowcrest Shirt Jac', colorway_name: 'BLACK' },
  { id: 31, name: 'T3', material: 'Metal zipper', color: '580', quantity: null, uom: null, project_id: 2, project_name: 'Zip Jacket', colorway_name: 'Black' },
]

function renderPage(data = { vendor: ykk }, bomLines = lines) {
  api.mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') return { vendor: { ...ykk, ...options.body } }
    if (path.endsWith('/bom-lines')) return { vendor_id: 1, bom_lines: bomLines }
    return data
  })
  render(
    <MemoryRouter initialEntries={['/vendors/1']}>
      <Routes><Route path="/vendors/:vendorId" element={<VendorDetail />} /></Routes>
    </MemoryRouter>
  )
}

test('shows the contact and every linked BOM line', async () => {
  renderPage()

  expect(await screen.findByRole('heading', { level: 1, name: 'YKK' })).toBeInTheDocument()
  const contact = screen.getByRole('region', { name: 'Contact' })
  expect(contact).toHaveTextContent('Mia Chen')
  expect(within(contact).getByRole('link', { name: 'mia@ykk.example' })).toHaveAttribute('href', 'mailto:mia@ykk.example')
  expect(contact).toHaveTextContent('Snaps and zips')

  const table = screen.getByRole('region', { name: 'BOM lines for YKK' })
  expect(table).toHaveTextContent('BOM lines · 2')
  expect(within(table).getByRole('link', { name: 'Snowcrest Shirt Jac' })).toHaveAttribute('href', '/projects/1')
  expect(within(table).getByRole('link', { name: 'Snap · 24L brass' })).toHaveAttribute('href', '/projects/1/parts/9')
  expect(within(table).getByText('11 pc')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith('/vendors/1/bom-lines')
})

test('says when no BOM lines are linked yet', async () => {
  renderPage({ vendor: ykk }, [])
  expect(await screen.findByText(/No BOM lines linked yet/)).toBeInTheDocument()
})

test('the vendor can be edited from its page', async () => {
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Edit vendor' }))
  const form = screen.getByRole('form', { name: 'Edit YKK' })
  const phone = within(form).getByLabelText('Phone')
  await userEvent.clear(phone)
  await userEvent.type(phone, '+1 212 555 0199')
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  expect(api).toHaveBeenCalledWith('/vendors/1', { method: 'PATCH', body: { phone: '+1 212 555 0199' } })
  expect(await screen.findByRole('link', { name: '+1 212 555 0199' })).toBeInTheDocument()
})

test('a vendor missing contact details is flagged', async () => {
  renderPage({ vendor: { ...ykk, contact_name: null, phone: null } })
  const contact = await screen.findByRole('region', { name: 'Contact' })
  expect(contact).toHaveTextContent('No contact person')
  expect(contact).toHaveTextContent('Add a contact person, email and phone so follow-ups reach a real person.')
})

test('shows not-found for an unknown vendor', async () => {
  api.mockRejectedValue(Object.assign(new Error('Vendor not found.'), { status: 404 }))
  render(
    <MemoryRouter initialEntries={['/vendors/99']}>
      <Routes><Route path="/vendors/:vendorId" element={<VendorDetail />} /></Routes>
    </MemoryRouter>
  )
  expect(await screen.findByRole('heading', { name: 'Vendor not found' })).toBeInTheDocument()
})
