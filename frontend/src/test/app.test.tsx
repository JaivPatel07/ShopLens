import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import type { AppConfig } from '../types/product'

const config: AppConfig = {
  app_name: 'SnapBuy API',
  version: '1.0.0',
  demo_mode: 'auto',
  demo_vision: false,
  demo_search: false,
  serpapi_configured: true,
  vision_provider: 'gemini',
  vision_configured: true,
  currency: 'INR',
  market: 'India',
  supported_image_types: ['JPG', 'JPEG', 'PNG', 'WEBP'],
  max_upload_mb: 10,
}

vi.mock('../services/api', () => ({
  ApiError: class ApiError extends Error {},
  api: {
    config: vi.fn(async () => config),
    health: vi.fn(async () => ({ status: 'ok', version: '1.0.0' })),
    analyzeImage: vi.fn(),
    search: vi.fn(),
  },
}))

function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  )
}

describe('landing page', () => {
  it('renders the hero, the flow sections and the upload box', async () => {
    renderApp('/')

    expect(
      screen.getByRole('heading', { level: 1, name: /find any product from a single photo/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload product photo/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /from photo to price in four steps/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /upload a product photo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload a product photo\. drop a file here/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /ready to find a better deal/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /shopping shouldn't require ten browser tabs/i })).toBeInTheDocument()

    // Live API setup -> no demo badge on the upload section.
    await waitFor(() => expect(screen.queryByText(/demo recognition/i)).not.toBeInTheDocument())
  })

  it('explains SerpApi\'s role separately from the AI recognition', () => {
    renderApp('/')
    expect(screen.getByRole('heading', { name: /powered by live search data/i })).toBeInTheDocument()
    expect(screen.getByText(/ai does the recognition/i)).toBeInTheDocument()
    expect(screen.getByText(/serpapi does the search/i)).toBeInTheDocument()
    expect(screen.getByText(/snapbuy builds the comparison/i)).toBeInTheDocument()
  })

  it('shows the primary calls to action and footer links', () => {
    renderApp('/')
    expect(screen.getByRole('link', { name: /^snapbuy home$/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /try snapbuy/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /about snapbuy/i })).toBeInTheDocument()
  })
})

describe('results page without a search', () => {
  it('guides the user back to the uploader', async () => {
    renderApp('/results')
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /no results to show yet/i })).toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: /upload a product photo/i })).toBeInTheDocument()
  })
})

describe('about page', () => {
  it('renders the project story and the SerpApi rationale', async () => {
    renderApp('/about')
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /making product discovery simpler/i })).toBeInTheDocument(),
    )
    expect(screen.getByRole('heading', { name: /why serpapi\?/i })).toBeInTheDocument()
    expect(screen.getAllByText(/headless browsers/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: /built with/i })).toBeInTheDocument()
    expect(screen.getByText('FastAPI')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/serpapi: configured/i)).toBeInTheDocument())
  })
})

describe('navigation', () => {
  it('navigates between pages with the navbar links', async () => {
    renderApp('/')
    await userEvent.click(screen.getByRole('link', { name: /^about$/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /making product discovery simpler/i })).toBeInTheDocument(),
    )
  })

  it('opens the mobile menu', async () => {
    renderApp('/')
    const toggle = screen.getByRole('button', { name: /open menu/i })
    await userEvent.click(toggle)
    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument()
  })
})
