import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

// jsdom lacks these browser APIs that the app uses.
if (!window.scrollTo) {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
} else {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
}

// jsdom lacks these browser APIs that the upload flow uses.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:mock-preview') as unknown as typeof URL.createObjectURL
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
}
