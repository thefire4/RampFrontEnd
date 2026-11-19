import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import { hasSourcing, isLate, localToday } from '../components/sourcing.js'
import ProjectPage from './ProjectPage.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 18, 12)) })
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

// RAMP-142: sourcing details on each BOM line
const base = {
  id: 1, name: 'Shell', material: 'Cotton', supplier: 'Riopele', supplier_contact: 'Ana', color: 'Navy',
  quantity: 1, uom: 'm', location: 'Body', material_size: '58"',
}
const sourced = (extra) => ({ supplied_by: null, required_arrival: null, sourcing_status: null, approvals_needed: [], ...extra })
const shell = { ...base, ...sourced({ supplied_by: 'btu', required_arrival: '2026-11-10', sourcing_status: 'ordered', approvals_needed: ['lab dip'] }) }
const lining = { ...base, id: 2, name: 'Lining', ...sourced({ supplied_by: 'customer', required_arrival: '2026-11-05', sourcing_status: 'received' }) }
const zipper = { ...base, id: 3, name: 'Zipper', ...sourced() }

const projectData = (materials) => ({
  project: { id: 7, name: 'Zip Jacket', stage: 'in progress' },
  colorways: [{ id: 'c1', name: 'Black', materials }],
  files: [],
})

function renderPage(materials = [shell, lining, zipper], onPatch) {
  api.mockImplementation(async (path, options) => (options?.method === 'PATCH' ? onPatch(path, options) : projectData(materials)))
  render(
    <MemoryRouter initialEntries={['/projects/7']}>
      <Routes><Route path="/projects/:projectId" element={<ProjectPage />} /></Routes>
    </MemoryRouter>
  )
}

const rowFor = (name) => screen.getByRole('link', { name }).closest('tr')

test('the BOM shows who supplies each line, when it must arrive and its status', async () => {
  renderPage()
  const bom = await screen.findByRole('region', { name: 'BOM lines for Black' })

  for (const header of ['Supplied by', 'Required arrival', 'Status']) {
    expect(within(bom).getByRole('columnheader', { name: header })).toBeInTheDocument()
  }
  const row = rowFor('Shell')
  expect(row).toHaveTextContent('BTU')
  expect(row).toHaveTextContent('Nov 10, 2026')
  // The status is a colored badge that also says it in words
  expect(within(row).getByText('Ordered')).toHaveClass('sourcing-badge', 'sourcing-ordered')
  expect(within(row).getByLabelText('Approvals needed')).toHaveTextContent('Lab dip')

  expect(rowFor('Lining')).toHaveTextContent('Customer')
  expect(within(rowFor('Lining')).getByText('Received')).toHaveClass('sourcing-received')
  expect(rowFor('Zipper')).toHaveTextContent('Not started')
})

test('lines past their required arrival date are highlighted until they arrive', async () => {
  renderPage()
  await screen.findByRole('region', { name: 'BOM lines for Black' })

  // Due Nov 10, only ordered, today is Nov 18
  expect(rowFor('Shell')).toHaveClass('row-late')
  expect(within(rowFor('Shell')).getByText('Late')).toBeInTheDocument()
  // Due Nov 5 but already received
  expect(rowFor('Lining')).not.toHaveClass('row-late')
  expect(within(rowFor('Lining')).queryByText('Late')).not.toBeInTheDocument()
})

test('sourcing details can be edited in the BOM line form', async () => {
  renderPage([shell, lining, zipper], (path, options) => ({ material: { ...zipper, ...options.body } }))

  await userEvent.click(await screen.findByRole('button', { name: 'Edit Zipper' }))
  const form = screen.getByRole('form', { name: 'Edit Zipper' })
  await userEvent.selectOptions(within(form).getByLabelText('Supplied by'), 'BTU')
  await userEvent.type(within(form).getByLabelText('Required arrival at BTU'), '2026-12-01')
  await userEvent.selectOptions(within(form).getByLabelText('Sourcing status'), 'RFQ sent')
  const approvals = within(form).getByRole('group', { name: 'Approvals needed' })
  await userEvent.click(within(approvals).getByLabelText('Test report'))
  await userEvent.click(within(approvals).getByLabelText('Lab dip'))
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  expect(api).toHaveBeenCalledWith('/materials/3', {
    method: 'PATCH',
    body: {
      supplied_by: 'btu',
      required_arrival: '2026-12-01',
      sourcing_status: 'rfq sent',
      approvals_needed: ['lab dip', 'test report'],
    },
  })
  const row = await screen.findByRole('link', { name: 'Zipper' })
  expect(row.closest('tr')).toHaveTextContent('RFQ sent')
  expect(row.closest('tr')).toHaveTextContent('Dec 1, 2026')
})

test('sourcing details can be cleared', async () => {
  renderPage([shell, lining, zipper], (path, options) => ({ material: { ...shell, ...options.body } }))

  await userEvent.click(await screen.findByRole('button', { name: 'Edit Shell' }))
  const form = screen.getByRole('form', { name: 'Edit Shell' })
  expect(within(form).getByLabelText('Supplied by')).toHaveValue('btu')
  expect(within(form).getByLabelText('Lab dip')).toBeChecked()

  await userEvent.selectOptions(within(form).getByLabelText('Supplied by'), 'Not set')
  await userEvent.clear(within(form).getByLabelText('Required arrival at BTU'))
  await userEvent.click(within(form).getByLabelText('Lab dip'))
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  expect(api).toHaveBeenCalledWith('/materials/1', {
    method: 'PATCH',
    body: { supplied_by: null, required_arrival: null, approvals_needed: [] },
  })
})

test('before the server sends sourcing details, nothing about sourcing shows', async () => {
  renderPage([base, { ...base, id: 2, name: 'Lining' }])
  const bom = await screen.findByRole('region', { name: 'BOM lines for Black' })

  expect(within(bom).queryByRole('columnheader', { name: 'Supplied by' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Edit Shell' }))
  expect(screen.queryByLabelText('Sourcing status')).not.toBeInTheDocument()
})

test('late means past the date and not received or approved yet', () => {
  const today = '2026-11-18'
  expect(isLate({ required_arrival: '2026-11-17', sourcing_status: 'shipped' }, today)).toBe(true)
  expect(isLate({ required_arrival: '2026-11-17', sourcing_status: null }, today)).toBe(true)
  expect(isLate({ required_arrival: '2026-11-18', sourcing_status: 'ordered' }, today)).toBe(false)
  expect(isLate({ required_arrival: '2026-11-01', sourcing_status: 'approved' }, today)).toBe(false)
  expect(isLate({ required_arrival: null, sourcing_status: 'ordered' }, today)).toBe(false)
  expect(localToday(new Date(2026, 10, 3, 23, 30))).toBe('2026-11-03')
  expect(hasSourcing([{ materials: [{ id: 1 }] }])).toBe(false)
  expect(hasSourcing([{ materials: [{ id: 1, sourcing_status: null }] }])).toBe(true)
})
