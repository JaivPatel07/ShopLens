/**
 * Client-side image helpers.
 *
 * The original file is sent to the backend (which downscales it before calling
 * the vision provider). Locally we only create a lightweight object URL for the
 * preview, plus a tiny JPEG thumbnail for localStorage search history.
 */

export const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
export const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export class ImageValidationError extends Error {}

export function validateImageFile(file: File): void {
  const typeOk = ACCEPTED_TYPES.includes(file.type.toLowerCase())
  const extOk = ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
  if (!typeOk && !extOk) {
    throw new ImageValidationError('Please upload a JPG, PNG or WEBP image.')
  }
  if (file.size === 0) {
    throw new ImageValidationError('That file looks empty. Try another image.')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError(
      `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please use an image under 10 MB.`,
    )
  }
}

export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file)
}

export function revokePreviewUrl(url: string | null): void {
  if (url && url.startsWith('blob:')) URL.revokeObjectURL(url)
}

/**
 * Downscale an image to `maxSize` px on its longest edge and return a data URL.
 * Used for the small search-history thumbnails so localStorage stays small.
 */
export async function createThumbnailDataUrl(file: File, maxSize = 128): Promise<string | null> {
  try {
    const bitmap = await loadImage(file)
    const ratio = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * ratio))
    const height = Math.max(1, Math.round(bitmap.height * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)
    if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.7)
  } catch {
    return null
  }
}

function loadImage(file: File): Promise<HTMLImageElement & { close?: () => void }> {
  return new Promise((resolve, reject) => {
    const url = createPreviewUrl(file)
    const image = new Image()
    image.onload = () => {
      revokePreviewUrl(url)
      resolve(image)
    }
    image.onerror = () => {
      revokePreviewUrl(url)
      reject(new Error('Could not read that image'))
    }
    image.src = url
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
