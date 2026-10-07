import { Link } from 'react-router-dom'
import {
  Bot,
  Database,
  FileCode2,
  KeyRound,
  Mail,
  ScanSearch,
  Server,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { useAppConfig } from '../context/appConfig'
import { DemoBadge } from '../components/DemoBadge'

const STACK = [
  { name: 'React', detail: 'UI library' },
  { name: 'TypeScript', detail: 'Type safety' },
  { name: 'Tailwind CSS', detail: 'Design system' },
  { name: 'Vite', detail: 'Build tooling' },
  { name: 'FastAPI', detail: 'Python API layer' },
  { name: 'Python', detail: 'Backend runtime' },
  { name: 'Pydantic', detail: 'Data validation' },
  { name: 'AI Vision', detail: 'Image recognition' },
  { name: 'SerpApi', detail: 'Shopping search data' },
]

const ENDPOINTS = [
  { method: 'GET', path: '/api/health', detail: 'Service status and provider configuration' },
  { method: 'POST', path: '/api/analyze-image', detail: 'Multipart image upload → product identification' },
  { method: 'POST', path: '/api/search', detail: 'Query → SerpApi → normalised products + price summary' },
  { method: 'GET', path: '/api/search?q=', detail: 'Same search, via query string' },
]

export default function About() {
  const { config } = useAppConfig()

  return (
    <div className="pb-24">
      <header className="border-ink-100 bg-ink-50/40 border-b py-14">
        <div className="container-page max-w-3xl">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-ink-900 text-lg font-bold tracking-tight">SnapBuy</span>
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
            Making product discovery simpler.
          </h1>
          <p className="text-ink-600 mt-5 text-base leading-relaxed">
            SnapBuy is a visual product search and price comparison app. Upload a photo, let AI work
            out what the product is, and see what it costs across the web — without opening ten
            browser tabs.
          </p>
          <p className="text-ink-500 mt-3 text-sm">
            Snap it. Compare it. Buy smarter.
          </p>
        </div>
      </header>

      <div className="container-page max-w-3xl space-y-14 pt-14">
        <section aria-labelledby="problem-heading">
          <h2 id="problem-heading" className="text-2xl font-bold tracking-tight">
            The problem
          </h2>
          <p className="text-ink-600 mt-4 leading-relaxed">
            People constantly see products they want to buy — in a friend&apos;s photo, in a shop, in
            a video — but turning that into a purchase means guessing the product name, then
            searching store after store to work out who is cheapest. Comparing prices manually is
            slow, and it is easy to miss a better listing.
          </p>
        </section>

        <section aria-labelledby="solution-heading">
          <h2 id="solution-heading" className="text-2xl font-bold tracking-tight">
            The solution
          </h2>
          <p className="text-ink-600 mt-4 leading-relaxed">
            SnapBuy compresses that workflow into one screen: upload a photo → identify the product →
            search shopping results → compare prices → find the best deal. The comparison is
            explainable: you can see the query that was searched, the prices that came back, and why
            a particular product was recommended.
          </p>
        </section>

        <section aria-labelledby="stack-heading">
          <h2 id="stack-heading" className="text-2xl font-bold tracking-tight">
            Built with
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STACK.map((item) => (
              <li
                key={item.name}
                className="card flex items-center gap-3 px-4 py-3"
              >
                <span className="bg-brand-50 text-brand-600 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <FileCode2 className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="text-ink-900 block text-sm font-semibold">{item.name}</span>
                  <span className="text-ink-500 block text-xs">{item.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-6 sm:p-8" aria-labelledby="serpapi-heading">
          <span className="bg-deal-100 text-deal-700 flex h-10 w-10 items-center justify-center rounded-xl">
            <ScanSearch className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 id="serpapi-heading" className="mt-4 text-2xl font-bold tracking-tight">
            Why SerpApi?
          </h2>
          <p className="text-ink-600 mt-4 leading-relaxed">
            SnapBuy needs structured shopping data — product titles, prices, sellers, ratings,
            thumbnails and links — for an arbitrary query, on demand. Building that from scratch
            would mean maintaining headless browsers, rotating proxies, parsing frequently changing
            HTML, and dealing with rate limits and CAPTCHAs.
          </p>
          <p className="text-ink-600 mt-4 leading-relaxed">
            SerpApi handles all of that infrastructure behind one HTTP API. SnapBuy sends a query to
            the{' '}
            <code className="bg-ink-100 text-ink-800 rounded px-1.5 py-0.5 text-sm">google_shopping</code>{' '}
            engine and receives structured JSON results it can normalise, compare and rank. That
            keeps the project focused on the product experience — recognition, comparison and
            recommendation — instead of on scraping plumbing.
          </p>

          <div className="border-ink-100 mt-6 grid gap-4 border-t pt-6 sm:grid-cols-3">
            <div className="flex gap-3">
              <Bot className="text-brand-600 mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold">AI</h3>
                <p className="text-ink-500 mt-1 text-xs leading-relaxed">
                  Identifies the product and generates the search query.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <ScanSearch className="text-deal-600 mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold">SerpApi</h3>
                <p className="text-ink-500 mt-1 text-xs leading-relaxed">
                  Retrieves live shopping results for that query.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Database className="text-ink-600 mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold">SnapBuy</h3>
                <p className="text-ink-500 mt-1 text-xs leading-relaxed">
                  Normalises, compares and recommends.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="architecture-heading">
          <h2 id="architecture-heading" className="text-2xl font-bold tracking-tight">
            Architecture
          </h2>
          <div className="card mt-5 overflow-x-auto p-6">
            <pre className="text-ink-700 text-xs leading-relaxed sm:text-sm">
{`React (Vite + TypeScript)
   ↓  relative /api/* requests — no keys in the browser
FastAPI  (image upload · search · comparison)
   ↓
AI Vision  →  product name, attributes, search query
   ↓
SerpApi google_shopping  →  live shopping results
   ↓
Normalisation  →  one product shape, missing fields tolerated
   ↓
Price comparison · value scoring · recommendation
   ↓
React results dashboard`}
            </pre>
          </div>

          <h3 className="mt-8 text-lg font-semibold">API endpoints</h3>
          <ul className="mt-4 space-y-3">
            {ENDPOINTS.map((endpoint) => (
              <li key={endpoint.path} className="card flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="bg-ink-900 rounded-md px-2 py-1 text-[10px] font-bold tracking-wide text-white">
                  {endpoint.method}
                </span>
                <code className="text-ink-900 text-sm font-medium">{endpoint.path}</code>
                <span className="text-ink-500 w-full text-xs sm:w-auto">{endpoint.detail}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-6 sm:p-8" aria-labelledby="privacy-heading">
          <span className="bg-ink-100 text-ink-700 flex h-10 w-10 items-center justify-center rounded-xl">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 id="privacy-heading" className="mt-4 text-xl font-bold tracking-tight">
            Security &amp; privacy
          </h2>
          <ul className="text-ink-600 mt-4 space-y-3 text-sm leading-relaxed">
            <li className="flex gap-3">
              <KeyRound className="text-ink-400 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              API keys (SerpApi and the vision provider) live only in the backend environment
              variables and are never sent to the browser.
            </li>
            <li className="flex gap-3">
              <Server className="text-ink-400 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Uploaded images are processed in memory for recognition and are not written to disk or
              stored in a database.
            </li>
            <li className="flex gap-3">
              <Sparkles className="text-ink-400 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Search history lives in your own browser&apos;s localStorage — only the query and a tiny
              thumbnail — and you can clear it at any time.
            </li>
          </ul>

          <div className="border-ink-100 mt-6 border-t pt-5 text-sm">
            <p className="text-ink-700 flex flex-wrap items-center gap-2 font-medium">
              Current backend configuration:
              {config.demo_vision || config.demo_search ? (
                <DemoBadge label="Demo data active" />
              ) : (
                <span className="text-deal-700 bg-deal-50 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase">
                  Live APIs
                </span>
              )}
            </p>
            <ul className="text-ink-500 mt-3 space-y-1 text-xs">
              <li>
                SerpApi: {config.serpapi_configured ? 'configured ✓' : 'not configured — using demo data'}
              </li>
              <li>
                Vision provider:{' '}
                {config.vision_configured
                  ? `${config.vision_provider} ✓`
                  : `not configured — using demo data (${config.vision_provider})`}
              </li>
              <li>Demo mode: {config.demo_mode}</li>
              <li>Market: {config.market}</li>
            </ul>
          </div>
        </section>

        <section className="from-ink-900 to-ink-800 rounded-4xl bg-gradient-to-br px-6 py-10 text-center sm:px-10">
          <Mail className="text-brand-300 mx-auto h-6 w-6" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-bold text-white">Built for the SerpApi India Hackathon</h2>
          <p className="text-ink-300 mx-auto mt-3 max-w-xl text-sm leading-relaxed">
            SnapBuy is an open project demonstrating how product recognition and live search data can
            be combined into a genuinely useful shopping tool.
          </p>
          <Link to="/" className="btn btn-lg bg-white text-ink-900 mt-6 hover:bg-ink-100">
            Back to SnapBuy
          </Link>
        </section>
      </div>
    </div>
  )
}
