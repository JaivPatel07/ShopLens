/**
 * Thin client for the SnapBuy FastAPI backend.
 *
 * All calls go through relative `/api` paths, so the browser never sees the
 * SerpApi key (or any other secret) - keys only ever live in the backend `.env`.
 */

import type {
  ApiErrorPayload,
  AppConfig,
  SearchResponse,
  VisionAttributes,
} from '../types/product'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'
const DEFAULT_TIMEOUT_MS = 60_000

export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code = 'request_failed', status = 0) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    })

    if (!response.ok) {
      let payload: ApiErrorPayload | null = null
      try {
        payload = (await response.json()) as ApiErrorPayload
      } catch {
        payload = null
      }
      throw new ApiError(
        payload?.error?.message ?? 'Something went wrong. Please try again.',
        payload?.error?.code ?? 'request_failed',
        response.status,
      )
    }

    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('That request took too long. Please try again.', 'timeout', 0)
    }
    throw new ApiError(
      'We could not reach the SnapBuy server. Check your connection and try again.',
      'network_error',
      0,
    )
  } finally {
    window.clearTimeout(timer)
  }
}

export const api = {
  /** GET /api/health */
  health: () => request<{ status: string; version: string }>('/health', {}, 10_000),

  /** GET /api/config - non-secret runtime configuration. */
  config: () => request<AppConfig>('/config', {}, 10_000),

  /** POST /api/analyze-image - multipart upload of the product photo. */
  analyzeImage: (file: File) => {
    const form = new FormData()
    form.append('file', file, file.name)
    return request<VisionAttributes>('/analyze-image', { method: 'POST', body: form }, 90_000)
  },

  /** POST /api/search - SerpApi backed shopping search. */
  search: (payload: { query: string; limit?: number; force_refresh?: boolean }) =>
    request<SearchResponse>(
      '/search',
      {
        method: 'POST',
        body: JSON.stringify({ limit: 40, ...payload }),
      },
      75_000,
    ),
}
