import { Bot, Layers, ScanSearch, Sparkles } from 'lucide-react'

const PILLARS = [
  {
    icon: Bot,
    title: 'AI',
    copy: 'Recognises the product from a photo and writes the search query.',
  },
  {
    icon: ScanSearch,
    title: 'Search',
    copy: 'SerpApi returns live Google Shopping results for that query.',
  },
  {
    icon: Layers,
    title: 'Price Intelligence',
    copy: 'Results are normalised, compared and scored for value.',
  },
]

export function HackathonValue() {
  return (
    <section className="py-20 sm:py-24" aria-labelledby="value-heading">
      <div className="container-page grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="label">Why ShopLens</p>
          <h2 id="value-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Shopping shouldn&apos;t require ten browser tabs.
          </h2>
          <p className="text-ink-600 mt-5 text-base leading-relaxed">
            You see a product somewhere — a friend&apos;s photo, a shop window, a video — and then the
            work begins: guessing the model name, hunting for it across stores, comparing prices in
            different tabs, and hoping you didn&apos;t miss a cheaper listing.
          </p>
          <p className="text-ink-600 mt-4 text-base leading-relaxed">
            ShopLens turns a product image into actionable shopping information by combining visual
            product recognition with real-time search data. One photo in, one clear set of options
            out.
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {PILLARS.map((pillar, index) => (
              <li
                key={pillar.title}
                className="animate-[var(--animate-fade-up)] rounded-2xl border border-ink-100 bg-white p-4 shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-[var(--shadow-lift)]"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <pillar.icon className="text-brand-600 h-5 w-5" aria-hidden="true" />
                <h3 className="mt-3 text-sm font-semibold">{pillar.title}</h3>
                <p className="text-ink-500 mt-1 text-xs leading-relaxed">{pillar.copy}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-6 sm:p-8">
          <p className="label flex items-center gap-2">
            <Sparkles className="text-brand-500 h-3.5 w-3.5" aria-hidden="true" />
            The 30-second version
          </p>
          <ol className="mt-5 space-y-4">
            {[
              'You upload a photo of the product.',
              'The AI identifies what it is and builds a search query.',
              'SerpApi fetches live shopping results for that query.',
              'ShopLens lists the sellers, prices and ratings — and picks the best value.',
            ].map((step, index) => (
              <li key={step} className="flex gap-3 text-sm">
                <span className="bg-brand-600 mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white">
                  {index + 1}
                </span>
                <span className="text-ink-700 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>

          <div className="border-ink-100 mt-6 border-t pt-5">
            <p className="text-ink-500 text-xs leading-relaxed">
              Results come from live Google Shopping data via SerpApi, with prices shown in ₹ INR
              for the Indian market.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
