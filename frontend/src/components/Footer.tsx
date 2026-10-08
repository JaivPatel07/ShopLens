import { Link } from 'react-router-dom'
import { ArrowUpRight, CodeXml, Sparkles } from 'lucide-react'
import { Logo } from './Logo'

const CURRENT_YEAR = new Date().getFullYear()

const FOOTER_LINK =
  'group text-ink-500 hover:text-ink-900 inline-flex items-center gap-1.5 transition-colors duration-200'

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
              <Link to="/#upload" className={FOOTER_LINK}>
                <span className="link-underline">Upload a photo</span>
                <ArrowUpRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
              </Link>
            </li>
            <li>
              <Link to="/#how-it-works" className={FOOTER_LINK}>
                <span className="link-underline">How it works</span>
                <ArrowUpRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
              </Link>
            </li>
            <li>
              <Link to="/results" className={FOOTER_LINK}>
                <span className="link-underline">Results dashboard</span>
                <ArrowUpRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Project">
          <h3 className="text-ink-900 text-sm font-semibold">Project</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/about" className={FOOTER_LINK}>
                <span className="link-underline">About SnapBuy</span>
                <ArrowUpRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
              </Link>
            </li>
            <li>
              <a
                href="https://serpapi.com/"
                target="_blank"
                rel="noreferrer noopener"
                className={FOOTER_LINK}
              >
                <span className="link-underline">SerpApi</span>
                <ArrowUpRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
              </a>
            </li>
            <li>
              <a
                href="https://github.com/JaivPatel07/SerpApi-India-Hackathon-"
                target="_blank"
                rel="noreferrer noopener"
                className={FOOTER_LINK}
              >
                <CodeXml className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-12" aria-hidden="true" />
                <span className="link-underline">Source</span>
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
