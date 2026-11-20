import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import { approvalsText, hasSourcing, isLate, localToday, statusInfo } from '../components/sourcing.js'
import ProjectPage from './ProjectPage.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 18, 12)) })
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

// RAMP-142: sourcing details on each BOM line, in the shape Enmanuel's backend (RAMP-140/141) sends
const base = {
  id: 1, name: 'Shell', material: 'Cotton', supplier: 'Riopele', supplier_contact: 'Ana', color: 'Navy',
  quantity: 1, uom: 'm', location: 'Body', material_size: '58"',
}
const sourced = (extra) => ({ supplied_by: null, required_arrival: null, sourcing_status: null, approvals_needed: null, ...extra })
const shell = { ...base, ...sourced({ supplied_by: 'BTU', required_arrival: '2026-11-10', sourcing_status: 'awaiting', approvals_needed: 'Lab dip' }) }
const lining = { ...base, id: 2, name: 'Lining', ...sourced({ supplied_by: 'Factory A', required_arrival: '2026-11-05', sourcing_status: 'in stock' }) }
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
  expect(within(row).getByText('Awaiting')).toHaveClass('sourcing-badge', 'sourcing-awaiting')
  expect(row).toHaveTextContent('Approvals: Lab dip')

  // Supplied by is free text
  expect(rowFor('Lining')).toHaveTextContent('Factory A')
  expect(within(rowFor('Lining')).getByText('In stock')).toHaveClass('sourcing-in-stock')
  expect(rowFor('Zipper')).toHaveTextContent('Not set')
})

test('lines past their required arrival date are highlighted until they are in stock', async () => {
  renderPage()
  await screen.findByRole('region', { name: 'BOM lines for Black' })

  // Due Nov 10, still awaiting, today is Nov 18
  expect(rowFor('Shell')).toHaveClass('row-late')
  expect(within(rowFor('Shell')).getByText('Late')).toBeInTheDocument()
  // Due Nov 5 but already in stock
  expect(rowFor('Lining')).not.toHaveClass('row-late')
})

test('sourcing details can be edited in the BOM line form', async () => {
  renderPage([shell, lining, zipper], (path, options) => ({ material: { ...zipper, ...options.body } }))

  await userEvent.click(await screen.findByRole('button', { name: 'Edit Zipper' }))
  const form = screen.getByRole('form', { name: 'Edit Zipper' })
  const suppliedBy = within(form).getByLabelText('Supplied by')
  // Customer and BTU are suggested, but any supplier can be typed
  expect([...document.getElementById(suppliedBy.getAttribute('list')).options].map((o) => o.value)).toEqual(['Customer', 'BTU'])
  await userEvent.type(suppliedBy, 'Factory B')
  await userEvent.type(within(form).getByLabelText('Required arrival at BTU'), '2026-12-01')
  await userEvent.selectOptions(within(form).getByLabelText('Sourcing status'), 'Delayed')
  await userEvent.type(within(form).getByLabelText('Approvals needed'), 'Lab dip and test report')
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  expect(api).toHaveBeenCalledWith('/materials/3', {
    method: 'PATCH',
    body: {
      supplied_by: 'Factory B',
      required_arrival: '2026-12-01',
      sourcing_status: 'delayed',
      approvals_needed: 'Lab dip and test report',
    },
  })
  const row = (await screen.findByRole('link', { name: 'Zipper' })).closest('tr')
  expect(within(row).getByText('Delayed')).toHaveClass('sourcing-delayed')
  expect(row).toHaveTextContent('Dec 1, 2026')
  expect(row).toHaveTextContent('Approvals: Lab dip and test report')
})

test('sourcing details can be cleared', async () => {
  renderPage([shell, lining, zipper], (path, options) => ({ material: { ...shell, ...options.body } }))

  await userEvent.click(await screen.findByRole('button', { name: 'Edit Shell' }))
  const form = screen.getByRole('form', { name: 'Edit Shell' })
  expect(within(form).getByLabelText('Sourcing status')).toHaveValue('awaiting')
  expect(within(form).getByLabelText('Approvals needed')).toHaveValue('Lab dip')

  await userEvent.clear(within(form).getByLabelText('Supplied by'))
  await userEvent.selectOptions(within(form).getByLabelText('Sourcing status'), 'Not set')
  await userEvent.clear(within(form).getByLabelText('Approvals needed'))
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  expect(api).toHaveBeenCalledWith('/materials/1', {
    method: 'PATCH',
    body: { supplied_by: null, sourcing_status: null, approvals_needed: null },
  })
})

test('unexpected sourcing values never break the page', async () => {
  // A list where text is expected, a status the page doesn't know, and a number
  const odd = { ...base, id: 4, name: 'Odd', ...sourced({ approvals_needed: ['lab dip', 'test report'], sourcing_status: 'on hold' }) }
  const odder = { ...base, id: 5, name: 'Odder', ...sourced({ approvals_needed: 42 }) }
  renderPage([odd, odder])

  const row = (await screen.findByRole('link', { name: 'Odd' })).closest('tr')
  expect(row).toHaveTextContent('Approvals: lab dip, test report')
  expect(within(row).getByText('on hold')).toHaveClass('sourcing-other')
  expect(rowFor('Odder')).not.toHaveTextContent('Approvals')
})

test('before the server sends sourcing details, nothing about sourcing shows', async () => {
  renderPage([base, { ...base, id: 2, name: 'Lining' }])
  const bom = await screen.findByRole('region', { name: 'BOM lines for Black' })

  expect(within(bom).queryByRole('columnheader', { name: 'Supplied by' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Edit Shell' }))
  expect(screen.queryByLabelText('Sourcing status')).not.toBeInTheDocument()
})

test('late means past the date and not in stock yet', () => {
  const today = '2026-11-18'
  expect(isLate({ required_arrival: '2026-11-17', sourcing_status: 'awaiting' }, today)).toBe(true)
  expect(isLate({ required_arrival: '2026-11-17', sourcing_status: 'delayed' }, today)).toBe(true)
  expect(isLate({ required_arrival: '2026-11-17', sourcing_status: null }, today)).toBe(true)
  expect(isLate({ required_arrival: '2026-11-18', sourcing_status: 'awaiting' }, today)).toBe(false)
  expect(isLate({ required_arrival: '2026-11-01', sourcing_status: 'in stock' }, today)).toBe(false)
  expect(isLate({ required_arrival: null, sourcing_status: 'awaiting' }, today)).toBe(false)
  expect(localToday(new Date(2026, 10, 3, 23, 30))).toBe('2026-11-03')
  expect(hasSourcing([{ materials: [{ id: 1 }] }])).toBe(false)
  expect(hasSourcing([{ materials: [{ id: 1, sourcing_status: null }] }])).toBe(true)
  expect(approvalsText('  Lab dip  ')).toBe('Lab dip')
  expect(approvalsText(null)).toBe('')
  expect(statusInfo('')).toBeNull()
})
