import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import ProjectPage from './ProjectPage.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))

// RAMP-151: images pulled out of a tech pack, labeled with the tab they came from

const techPack = { id: 1, file_name: 'Snowcrest BOM.xlsx', file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', url: '/api/files/1' }
const front = { id: 2, file_name: 'FRONT_1.png', file_type: 'image/png', url: '/api/files/2', source_sheet: 'FRONT', source_file_id: 1 }
const back = { id: 3, file_name: 'BACK_2.jpg', file_type: 'image/jpeg', url: '/api/files/3', source_sheet: 'BACK', source_file_id: 1 }
const upload = { id: 4, file_name: 'photo.png', file_type: 'image/png', url: '/api/files/4', source_sheet: null }

function renderPage(files) {
  api.mockResolvedValue({ project: { id: 7, name: 'Test Jacket' }, colorways: [], files })
  render(
    <MemoryRouter initialEntries={['/projects/7']}>
      <Routes><Route path="/projects/:projectId" element={<ProjectPage />} /></Routes>
    </MemoryRouter>
  )
}

afterEach(() => vi.clearAllMocks())

test('shows extracted sketches in the gallery, each labeled with its tab', async () => {
  renderPage([techPack, front, back, upload])

  const gallery = await screen.findByRole('list', { name: 'Sketches and images' })
  const items = within(gallery).getAllByRole('listitem')
  expect(items).toHaveLength(3)
  expect(within(items[0]).getByText('FRONT tab')).toBeInTheDocument()
  expect(within(items[1]).getByText('BACK tab')).toBeInTheDocument()
  // A directly uploaded image has no tab
  expect(within(items[2]).queryByText(/ tab$/)).not.toBeInTheDocument()
  expect(within(gallery).getByRole('button', { name: 'Open FRONT_1.png from the FRONT tab full size' })).toBeInTheDocument()
})

test('the viewer shows which tab the image came from', async () => {
  renderPage([techPack, front, back])

  await userEvent.click(await screen.findByRole('button', { name: /Open FRONT_1\.png/ }))
  const viewer = screen.getByRole('dialog')
  expect(within(viewer).getByText('From the FRONT tab')).toBeInTheDocument()

  await userEvent.click(within(viewer).getByRole('button', { name: 'Next image' }))
  expect(within(viewer).getByText('From the BACK tab')).toBeInTheDocument()
})

test('says so when a tech pack has no images', async () => {
  renderPage([techPack])
  expect(await screen.findByText('No sketches found in the tech pack')).toBeInTheDocument()
})

test('keeps the usual message when nothing has been uploaded', async () => {
  renderPage([])
  expect(await screen.findByText('No sketches or images uploaded yet')).toBeInTheDocument()
})