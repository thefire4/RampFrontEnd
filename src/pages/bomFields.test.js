import { expect, test } from 'vitest'
import { percentComplete } from './bomFields.js'

// RAMP-128: every percent on screen comes from here, so the list and the project page agree
test('percent complete is the share of lines with nothing missing', () => {
  expect(percentComplete(4, 1)).toBe(75)
  expect(percentComplete(3, 2)).toBe(33)
  expect(percentComplete(5, 0)).toBe(100)
  expect(percentComplete(5, 5)).toBe(0)
})

test('percent complete rounds the same way as the API', () => {
  // 4 of 15 is 26.67%: the API says 27
  expect(percentComplete(15, 11)).toBe(27)
  expect(percentComplete(3, 1)).toBe(67)
  // Halves go to the even number like Python's round(): 12.5 -> 12, 37.5 -> 38, 62.5 -> 62
  expect(percentComplete(8, 7)).toBe(12)
  expect(percentComplete(8, 5)).toBe(38)
  expect(percentComplete(8, 3)).toBe(62)
})

test('percent complete only shows 100 when nothing is missing', () => {
  // 99.5% would round to 100
  expect(percentComplete(200, 1)).toBe(99)
  expect(percentComplete(1000, 1)).toBe(99)
})

test('percent complete only shows 0 when nothing is complete', () => {
  // 1 of 300 is 0.33%
  expect(percentComplete(300, 299)).toBe(1)
})

test('percent complete handles no lines and bad counts', () => {
  expect(percentComplete(0, 0)).toBe(0)
  expect(percentComplete(undefined, undefined)).toBe(0)
  expect(percentComplete(4, undefined)).toBe(100)
  expect(percentComplete(4, 9)).toBe(0)
})
