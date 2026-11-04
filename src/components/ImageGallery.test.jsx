import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import ImageGallery from './ImageGallery.jsx'

const images = [
  { id: 1, file_name: 'front.png', url: '/api/files/1' },
  { id: 2, file_name: 'back.png', url: '/api/files/2' },
  { id: 3, file_name: 'detail.jpg', url: '/api/files/3' },
]

const viewer = () => screen.getByRole('dialog')
const shownImage = () => within(viewer()).getByRole('img')

test('shows a message when there are no images', () => {
  render(<ImageGallery images={[]} />)
  expect(screen.getByText('No sketches or images uploaded yet')).toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})

test('shows every image as a thumbnail', () => {
  render(<ImageGallery images={images} />)

  const grid = screen.getByRole('list', { name: 'Sketches and images' })
  expect(within(grid).getAllByRole('listitem')).toHaveLength(3)
  expect(screen.getByRole('img', { name: 'front.png' })).toHaveAttribute('src', '/api/files/1')
  expect(screen.getByRole('button', { name: 'Open back.png full size' })).toBeInTheDocument()
})

test('clicking a thumbnail opens it full size', async () => {
  render(<ImageGallery images={images} />)
  await userEvent.click(screen.getByRole('button', { name: 'Open back.png full size' }))

  expect(viewer()).toHaveAccessibleName('back.png (2 of 3)')
  expect(shownImage()).toHaveAttribute('src', '/api/files/2')
  expect(within(viewer()).getByText('2 / 3')).toBeInTheDocument()
  expect(within(viewer()).getByRole('link', { name: 'Open original' })).toHaveAttribute('href', '/api/files/2')
  expect(within(viewer()).getByRole('button', { name: 'Close viewer' })).toHaveFocus()
})

test('next and previous arrows move through every image and wrap around', async () => {
  render(<ImageGallery images={images} />)
  await userEvent.click(screen.getByRole('button', { name: 'Open front.png full size' }))

  const next = within(viewer()).getByRole('button', { name: 'Next image' })
  await userEvent.click(next)
  expect(shownImage()).toHaveAccessibleName('back.png')
  await userEvent.click(next)
  expect(shownImage()).toHaveAccessibleName('detail.jpg')
  await userEvent.click(next)
  expect(shownImage()).toHaveAccessibleName('front.png')

  await userEvent.click(within(viewer()).getByRole('button', { name: 'Previous image' }))
  expect(shownImage()).toHaveAccessibleName('detail.jpg') 
})

test('arrow keys move between images and Escape closes the viewer', async () => {
  render(<ImageGallery images={images} />)
  await userEvent.click(screen.getByRole('button', { name: 'Open front.png full size' }))

  await userEvent.keyboard('{ArrowRight}')
  expect(shownImage()).toHaveAccessibleName('back.png')
  await userEvent.keyboard('{ArrowLeft}')
  expect(shownImage()).toHaveAccessibleName('front.png')

  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('the close button closes the viewer and returns focus to the thumbnail', async () => {
  render(<ImageGallery images={images} />)
  const thumb = screen.getByRole('button', { name: 'Open detail.jpg full size' })
  await userEvent.click(thumb)

  await userEvent.click(within(viewer()).getByRole('button', { name: 'Close viewer' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await waitFor(() => expect(thumb).toHaveFocus())
})

test('clicking outside the image closes the viewer', async () => {
  const { container } = render(<ImageGallery images={images} />)
  await userEvent.click(screen.getByRole('button', { name: 'Open front.png full size' }))

  await userEvent.click(container.ownerDocument.querySelector('.viewer-backdrop'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('a single image has no arrows', async () => {
  render(<ImageGallery images={[images[0]]} />)
  await userEvent.click(screen.getByRole('button', { name: 'Open front.png full size' }))

  expect(within(viewer()).queryByRole('button', { name: 'Next image' })).not.toBeInTheDocument()
  expect(within(viewer()).queryByRole('button', { name: 'Previous image' })).not.toBeInTheDocument()
})

test('a thumbnail that fails to load shows a placeholder', () => {
  render(<ImageGallery images={images} />)
  fireEvent.error(screen.getByRole('img', { name: 'back.png' }))

  expect(screen.getByRole('img', { name: 'back.png could not be loaded' })).toHaveTextContent('Image unavailable')
  // The others still show
  expect(screen.getByRole('img', { name: 'front.png' })).toBeInTheDocument()
})

test('a full-size image that fails to load shows a placeholder, and the next one still loads', async () => {
  render(<ImageGallery images={images} />)
  await userEvent.click(screen.getByRole('button', { name: 'Open front.png full size' }))

  fireEvent.error(shownImage())
  expect(shownImage()).toHaveAccessibleName('front.png could not be loaded')

  await userEvent.click(within(viewer()).getByRole('button', { name: 'Next image' }))
  expect(shownImage()).toHaveAttribute('src', '/api/files/2')
})
