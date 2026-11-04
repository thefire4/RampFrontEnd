import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import ProjectPage from './ProjectPage.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
afterEach(() => vi.clearAllMocks())

function renderWith(files) {
  api.mockResolvedValue({ project: { id: 7, name: 'Test Jacket', stage: 'in progress' }, colorways: [], files })
  render(
    <MemoryRouter initialEntries={['/projects/7']}>
      <Routes><Route path="/projects/:projectId" element={<ProjectPage />} /></Routes>
    </MemoryRouter>
  )
}

test('project page shows only the sketches and images, and opens them full size', async () => {
  renderWith([
    { id: 1, file_name: 'front.png', file_type: 'image/png', url: '/api/files/1' },
    { id: 2, file_name: 'techpack.xlsx', file_type: 'xlsx', url: '/api/files/2' },
    { id: 3, file_name: 'back.jpg', file_type: 'jpg', url: '/api/files/3' },
  ])

  const grid = await screen.findByRole('list', { name: 'Sketches and images' })
  expect(within(grid).getAllByRole('listitem')).toHaveLength(2) // the spreadsheet isn't an image
  expect(screen.getByText(/Sketches & images · 2/)).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Open back.jpg full size' }))
  expect(screen.getByRole('dialog')).toHaveAccessibleName('back.jpg (2 of 2)')
})

test('project page says when there are no images', async () => {
  renderWith([{ id: 2, file_name: 'techpack.xlsx', file_type: 'xlsx', url: '/api/files/2' }])
  expect(await screen.findByText('No sketches or images uploaded yet')).toBeInTheDocument()
})
