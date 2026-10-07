import { ArrowDown, Bot, ScanSearch, Server, Sparkles } from 'lucide-react'

const PIPELINE = [
  { label: 'Product Image', owner: 'you' },
  { label: 'AI Product Recognition', owner: 'ai' },
  { label: 'Search Query Generation', owner: 'ai' },
  { label: 'SerpApi', owner: 'serpapi' },
  { label: 'Shopping Results', owner: 'serpapi' },
  { label: 'Normalization', owner: 'snapbuy' },
  { label: 'Price Intelligence', owner: 'snapbuy' },
  { label: 'User Recommendation', owner: 'snapbuy' },
] as const

const OWNER_STYLE: Record<string, string> = {
  ai: 'border-brand-200 bg-brand-50 text-brand-700',
  serpapi: 'border-deal-200 bg-deal-50 text-deal-700',
  snapbuy: 'border-ink-200 bg-white text-ink-700',
  you: 'border-ink-200 bg-ink-50 text-ink-600',
}

const OWNER_LABEL: Record<string, string> = {
  ai: 'AI',
  serpapi: 'SerpApi',
  snapbuy: 'SnapBuy',
  you: 'Input',
}

/**
 * Makes SerpApi's role explicit and, just as importantly, distinguishes it from
 * the AI recognition step - SerpApi does not do image recognition.
 */
export function TechSection() {
  return (
    <section id="technology" className="scroll-mt-20 py-20 sm:py-24" aria-labelledby="tech-heading">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="label">Technology</p>
          <h2 id="tech-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Powered by live search data
          </h2>
          <p className="text-ink-600 mt-4 text-base leading-relaxed">
            SnapBuy splits the work cleanly: AI handles product identification, SerpApi handles
            retrieving structured shopping results, and SnapBuy handles the comparison and the
            recommendation.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ol className="space-y-2" aria-label="SnapBuy data pipeline">
            {PIPELINE.map((step, index) => (
              <li key={step.label}>
                <div
                  className={`animate-[var(--animate-fade-up)] flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${OWNER_STYLE[step.owner]}`}
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <span>{step.label}</span>
                  <span className="text-ink-400 text-[10px] font-semibold tracking-[0.08em] uppercase">
                    {OWNER_LABEL[step.owner]}
                  </span>
                </div>
                {index < PIPELINE.length - 1 && (
                  <div className="flex justify-center py-1" aria-hidden="true">
                    <ArrowDown className="text-ink-300 h-3.5 w-3.5" />
                  </div>
                )}
              </li>
            ))}
          </ol>

          <div className="space-y-4">
            <article className="card p-6">
              <span className="bg-brand-50 text-brand-600 flex h-10 w-10 items-center justify-center rounded-xl">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold">AI does the recognition</h3>
              <p className="text-ink-600 mt-2 text-sm leading-relaxed">
                A configurable vision provider looks at the photo and returns a product name, brand,
                category, visual attributes and a search query. If it cannot identify an exact
                model, it returns the most likely product type and a still-useful query.
              </p>
            </article>

            <article className="card border-deal-100 bg-deal-50/40 p-6">
              <span className="bg-deal-100 text-deal-700 flex h-10 w-10 items-center justify-center rounded-xl">
                <ScanSearch className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold">SerpApi does the search</h3>
              <p className="text-ink-600 mt-2 text-sm leading-relaxed">
                The generated query goes to SerpApi&apos;s{' '}
                <code className="bg-white/70 rounded px-1.5 py-0.5 text-xs">google_shopping</code>{' '}
                engine, which returns structured shopping results — titles, prices, sellers,
                ratings, thumbnails and links — without SnapBuy running or maintaining any scraping
                infrastructure.
              </p>
            </article>

            <article className="card p-6">
              <span className="bg-ink-100 text-ink-700 flex h-10 w-10 items-center justify-center rounded-xl">
                <Server className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold">SnapBuy builds the comparison</h3>
              <p className="text-ink-600 mt-2 text-sm leading-relaxed">
                FastAPI normalises every result into one shape, calculates the price spread, groups
                offers per seller and scores the best value. API keys stay server-side — the browser
                never sees them.
              </p>
            </article>

            <p className="text-ink-400 flex items-start gap-2 text-xs">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              SerpApi provides the search and shopping data only. Product identification is handled
              by the AI vision provider — SnapBuy does not claim otherwise.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
