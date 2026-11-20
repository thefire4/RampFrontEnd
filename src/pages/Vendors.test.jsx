import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import Vendors from './Vendors.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
afterEach(() => vi.clearAllMocks())

// RAMP-145: vendor list with add and edit forms
const ykk = { id: 1, name: 'YKK', contact_name: 'Mia Chen', email: 'mia@ykk.example', phone: '+1 212 555 0101', notes: null }
const label = { id: 3, name: 'Progressive Label', contact_name: null, email: 'orders@progressive.example', phone: null, notes: null }

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/vendors']}>
      <Routes>
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/vendors/:vendorId" element={<h1>Vendor page</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

const rowFor = (name) => screen.getByRole('link', { name }).closest('tr')

test('lists vendors with their contact details', async () => {
  api.mockResolvedValue({ vendors: [label, ykk] })
  renderPage()

  expect(await screen.findByRole('link', { name: 'YKK' })).toHaveAttribute('href', '/vendors/1')
  const row = rowFor('YKK')
  expect(row).toHaveTextContent('Mia Chen')
  expect(within(row).getByRole('link', { name: 'mia@ykk.example' })).toHaveAttribute('href', 'mailto:mia@ykk.example')
  expect(within(row).getByRole('link', { name: '+1 212 555 0101' })).toHaveAttribute('href', 'tel:+12125550101')
  // A vendor without a person to contact is flagged
  expect(rowFor('Progressive Label')).toHaveTextContent('No contact person, phone')
  expect(api).toHaveBeenCalledWith('/vendors')
})

test('adds a vendor', async () => {
  const created = { id: 9, name: 'Riopele', contact_name: 'João Silva', email: 'joao@riopele.example', phone: null, notes: null }
  api.mockImplementation(async (path, options) => (options?.method === 'POST' ? { vendor: created } : { vendors: [ykk] }))
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Add vendor' }))
  const form = screen.getByRole('form', { name: 'Add vendor' })
  await userEvent.type(within(form).getByLabelText(/Vendor name/), 'Riopele')
  await userEvent.type(within(form).getByLabelText('Contact person'), 'João Silva')
  await userEvent.type(within(form).getByLabelText('Email'), 'joao@riopele.example')
  await userEvent.click(within(form).getByRole('button', { name: 'Add vendor' }))

  expect(api).toHaveBeenCalledWith('/vendors', {
    method: 'POST',
    body: { name: 'Riopele', contact_name: 'João Silva', email: 'joao@riopele.example' },
  })
  expect(await screen.findByText('Added Riopele.')).toBeInTheDocument()
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
  // Listed in name order
  const names = screen.getAllByRole('link').map((a) => a.textContent).filter((t) => ['Riopele', 'YKK'].includes(t))
  expect(names).toEqual(['Riopele', 'YKK'])
})

test('a vendor needs a name and a real email address', async () => {
  api.mockResolvedValue({ vendors: [] })
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Add vendor' }))
  const form = screen.getByRole('form', { name: 'Add vendor' })
  await userEvent.type(within(form).getByLabelText('Email'), 'not-an-email')
  await userEvent.click(within(form).getByRole('button', { name: 'Add vendor' }))

  expect(within(form).getByLabelText(/Vendor name/)).toHaveAccessibleDescription('Vendor name is required.')
  expect(within(form).getByLabelText('Email')).toHaveAccessibleDescription('Email must be an email address, like name@example.com.')
  expect(api).not.toHaveBeenCalledWith('/vendors', expect.objectContaining({ method: 'POST' }))
})

test('shows the server error when adding fails', async () => {
  api.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') throw new Error('Vendor name cannot be blank.')
    return { vendors: [] }
  })
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Add vendor' }))
  const form = screen.getByRole('form', { name: 'Add vendor' })
  await userEvent.type(within(form).getByLabelText(/Vendor name/), 'X')
  await userEvent.click(within(form).getByRole('button', { name: 'Add vendor' }))

  expect(await within(form).findByRole('alert')).toHaveTextContent('Vendor name cannot be blank.')
})

test('edits a vendor in place, highlighting missing contact details', async () => {
  api.mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') return { vendor: { ...label, contact_name: 'Sam Lee' } }
    return { vendors: [label, ykk] }
  })
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Edit Progressive Label' }))
  const form = screen.getByRole('form', { name: 'Edit Progressive Label' })
  const person = within(form).getByLabelText('Contact person')
  expect(person).toHaveAccessibleDescription('Missing')
  expect(person).toHaveFocus()

  await userEvent.type(person, 'Sam Lee')
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  expect(api).toHaveBeenCalledWith('/vendors/3', { method: 'PATCH', body: { contact_name: 'Sam Lee' } })
  expect(await screen.findByText('Saved Progressive Label.')).toBeInTheDocument()
  expect(rowFor('Progressive Label')).toHaveTextContent('Sam Lee')
})

test('says so when the server has no vendors yet', async () => {
  api.mockRejectedValue(Object.assign(new Error('Not found.'), { status: 404 }))
  renderPage()

  expect(await screen.findByRole('heading', { name: "Vendors aren't available yet" })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Add vendor' })).not.toBeInTheDocument()
})

test('vendors are listed A to Z ignoring capital letters', async () => {
  api.mockResolvedValue({ vendors: [{ ...label, name: 'PROGRESSIVE LABEL' }, { ...ykk, id: 4, name: 'Pezzetti' }, ykk] })
  renderPage()

  await screen.findByRole('link', { name: 'YKK' })
  const names = screen.getAllByRole('link').map((a) => a.textContent).filter((t) => ['PROGRESSIVE LABEL', 'Pezzetti', 'YKK'].includes(t))
  expect(names).toEqual(['Pezzetti', 'PROGRESSIVE LABEL', 'YKK'])
})
