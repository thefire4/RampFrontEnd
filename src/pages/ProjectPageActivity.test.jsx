import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../api.js'
import ProjectPage from './ProjectPage.jsx'

vi.mock('../api.js', () => ({ api: vi.fn() }))

afterEach(() => vi.clearAllMocks())

test('project page links to its activity log', async () => {
  api.mockResolvedValue({
    project: { id: 7, name: 'Test Jacket' },
    colorways: [{ id: 'c1', name: 'Navy', materials: [] }],
    files: [],
  })
  render(
    <MemoryRouter initialEntries={['/projects/7']}>
      <Routes><Route path="/projects/:projectId" element={<ProjectPage />} /></Routes>
    </MemoryRouter>
  )
  expect(await screen.findByRole('link', { name: 'Activity log' })).toHaveAttribute('href', '/projects/7/activity')
})