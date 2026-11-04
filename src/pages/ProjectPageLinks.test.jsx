import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import ProjectPage from './ProjectPage.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))
afterEach(() => vi.clearAllMocks())

const line = { id: 12, name: 'Zipper', material: 'Coil zip', supplier: '', color: 'Black', quantity: 1 }

test('project overview links to the missing-items list and to each part', async () => {
  api.mockResolvedValue({
    project: { id: 7, name: 'Test Jacket', stage: 'in progress' },
    colorways: [{ id: 'c1', name: 'Navy', materials: [line] }],
    files: [],
  })
  render(
    <MemoryRouter initialEntries={['/projects/7']}>
      <Routes><Route path="/projects/:projectId" element={<ProjectPage />} /></Routes>
    </MemoryRouter>
  )

  expect(await screen.findByRole('link', { name: 'View missing items' })).toHaveAttribute('href', '/projects/7/missing')
  expect(screen.getByRole('link', { name: 'Zipper' })).toHaveAttribute('href', '/projects/7/parts/12')
})