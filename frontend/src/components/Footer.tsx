import { Link } from 'react-router-dom'
import { CodeXml, Sparkles } from 'lucide-react'
import { Logo } from './Logo'

// Evaluated once per app load instead of during render (keeps render pure).
const CURRENT_YEAR = new Date().getFullYear()

export function Footer() {
  return (
    <footer className="border-ink-100 mt-24 border-t bg-white">
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="text-ink-900 text-lg font-bold tracking-tight">SnapBuy</span>
          </div>
          <p className="text-ink-500 mt-3 max-w-sm text-sm leading-relaxed">
            Snap it. Compare it. Buy smarter. Find the best products and prices from a single
            photo.
          </p>
          <p className="text-ink-400 mt-4 inline-flex items-center gap-2 text-xs">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Built for the SerpApi India Hackathon
          </p>
        </div>

        <nav aria-label="Product">
          <h3 className="text-ink-900 text-sm font-semibold">Product</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/#upload" className="text-ink-500 hover:text-ink-900 transition">
                Upload a photo
              </Link>
            </li>
            <li>
              <Link to="/#how-it-works" className="text-ink-500 hover:text-ink-900 transition">
                How it works
              </Link>
            </li>
            <li>
              <Link to="/results" className="text-ink-500 hover:text-ink-900 transition">
                Results dashboard
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Project">
          <h3 className="text-ink-900 text-sm font-semibold">Project</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/about" className="text-ink-500 hover:text-ink-900 transition">
                About SnapBuy
              </Link>
            </li>
            <li>
              <a
                href="https://serpapi.com/"
                target="_blank"
                rel="noreferrer noopener"
                className="text-ink-500 hover:text-ink-900 transition"
              >
                SerpApi
              </a>
            </li>
            <li>
              <a
                href="https://github.com/JaivPatel07/SerpApi-India-Hackathon-"
                target="_blank"
                rel="noreferrer noopener"
                className="text-ink-500 hover:text-ink-900 inline-flex items-center gap-1.5 transition"
              >
                <CodeXml className="h-3.5 w-3.5" aria-hidden="true" />
                Source
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-ink-100 border-t">
        <div className="container-page text-ink-400 flex flex-col gap-2 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {CURRENT_YEAR} SnapBuy. Prices and availability come from live search results and may change.</p>
          <p>Product identification by AI · Search results by SerpApi</p>
        </div>
      </div>
    </footer>
  )
}
