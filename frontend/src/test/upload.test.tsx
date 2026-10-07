import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadBox } from '../components/UploadBox'
import { ImagePreview } from '../components/ImagePreview'
import { validateImageFile, ImageValidationError } from '../lib/image'
import { makeImageFile } from './factories'

describe('validateImageFile', () => {
  it('accepts a supported image', () => {
    expect(() => validateImageFile(makeImageFile())).not.toThrow()
  })

  it('rejects an unsupported file type', () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    expect(() => validateImageFile(file)).toThrow(ImageValidationError)
  })

  it('rejects an image larger than 10 MB', () => {
    const big = makeImageFile('huge.jpg', 'image/jpeg')
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })
    expect(() => validateImageFile(big)).toThrow(/10 MB/)
  })
})

describe('UploadBox', () => {
  it('calls onSelect when a valid image is dropped', async () => {
    const onSelect = vi.fn()
    render(<UploadBox onSelect={onSelect} />)

    const dropzone = screen.getByRole('button', { name: /upload a product photo/i })
    const file = makeImageFile()
    const dataTransfer = { files: [file] }

    await userEvent.click(dropzone) // focus + open picker (no-op without files)
    dropzone.dispatchEvent(
      Object.assign(new Event('drop', { bubbles: true, cancelable: true }), { dataTransfer }),
    )

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1))
    expect(onSelect.mock.calls[0][0].name).toBe('product.png')
  })

  it('shows a friendly error for an invalid file instead of calling onSelect', async () => {
    const onSelect = vi.fn()
    render(<UploadBox onSelect={onSelect} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const bad = new File(['not an image'], 'readme.txt', { type: 'text/plain' })
    // userEvent.upload respects the input's `accept` filter, so drive the change
    // event directly to simulate a file that slipped through the picker.
    fireEvent.change(input, { target: { files: [bad] } })

    expect(await screen.findByRole('alert')).toHaveTextContent(/JPG, PNG or WEBP/i)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('is keyboard operable', async () => {
    const onSelect = vi.fn()
    render(<UploadBox onSelect={onSelect} />)
    const dropzone = screen.getByRole('button', { name: /upload a product photo/i })
    dropzone.focus()
    expect(dropzone).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onSelect).not.toHaveBeenCalled() // opens the picker, no file chosen
  })

  it('offers the demo image shortcut when provided', async () => {
    const onTryDemo = vi.fn()
    render(<UploadBox onSelect={vi.fn()} onTryDemo={onTryDemo} />)
    await userEvent.click(screen.getByRole('button', { name: /try demo image/i }))
    expect(onTryDemo).toHaveBeenCalled()
  })
})

describe('ImagePreview', () => {
  it('renders the image and supports remove', async () => {
    const onRemove = vi.fn()
    const onReplace = vi.fn()
    render(
      <ImagePreview
        src="blob:preview"
        fileName="sneaker.jpg"
        fileSize={2048}
        onRemove={onRemove}
        onReplace={onReplace}
      />,
    )

    expect(screen.getByRole('img', { name: /sneaker.jpg/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /remove image/i }))
    expect(onRemove).toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /replace image/i }))
    expect(onReplace).toHaveBeenCalled()
  })

  it('hides actions while busy', () => {
    render(<ImagePreview src="blob:preview" fileName="x.jpg" onRemove={vi.fn()} disabled />)
    expect(screen.queryByRole('button', { name: /remove image/i })).not.toBeInTheDocument()
  })
})
