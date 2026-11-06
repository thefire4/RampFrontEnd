import { expect, test } from 'vitest'
import { checkFile, friendlyUploadError, MAX_UPLOAD_BYTES, toUploadItems } from './uploads.js'

const fileOf = (name, size = 10) => {
  const file = new File(['x'], name)
  Object.defineProperty(file, 'size', { value: size })
  return file
}

test('accepts the file types the backend imports', () => {
  for (const name of ['bom.xlsx', 'BOM.XLSM', 'pack.xltx', 'pack.xltm', 'lines.csv', 'spec.pdf']) {
    expect(checkFile(fileOf(name))).toBeNull()
  }
})

test('explains why a file type is rejected', () => {
  expect(checkFile(fileOf('notes.docx'))).toBe(".docx files can't be imported. Upload an Excel (.xlsx, .xlsm), CSV or PDF file.")
  expect(checkFile(fileOf('README'))).toMatch(/^Files without an extension can't be imported/)
  // Sketches can't be imported through the file upload yet
  expect(checkFile(fileOf('front.png'))).toMatch(/^\.png files/)
})

test('rejects empty and oversized files', () => {
  expect(checkFile(fileOf('bom.xlsx', 0))).toBe('The file is empty.')
  expect(checkFile(fileOf('bom.xlsx', MAX_UPLOAD_BYTES))).toBeNull()
  expect(checkFile(fileOf('bom.xlsx', 30 * 1024 * 1024))).toBe('The file is 30.0 MB. The limit is 25.0 MB.')
})

test("shows the backend's size limit message in MB", () => {
  const message = "File 'big.xlsx' is too large (31457280 bytes; maximum is 26214400 bytes)."
  expect(friendlyUploadError(message)).toBe("File 'big.xlsx' is too large (30.0 MB; the limit is 25.0 MB).")
  expect(friendlyUploadError("Could not import 'a.xlsx': No BOM sheet found")).toBe("Could not import 'a.xlsx': No BOM sheet found")
  expect(friendlyUploadError('')).toBe('The upload failed.')
})

test('each chosen file gets a status straight away', () => {
  const [good, bad] = toUploadItems([fileOf('bom.xlsx'), fileOf('notes.docx')])
  expect(good).toMatchObject({ status: 'waiting', message: null })
  expect(bad.status).toBe('invalid')
  expect(bad.message).toMatch(/\.docx files/)
  expect(good.key).not.toBe(bad.key)
})
