import { BadgeIndianRupee, Radar, ScanEye, Sparkles } from 'lucide-react'

const ITEMS = [
  {
    icon: ScanEye,
    title: 'AI Recognition',
    copy: 'A vision model turns a photo into a product name, brand and attributes.',
  },
  {
    icon: Radar,
    title: 'Live Search',
    copy: 'SerpApi queries Google Shopping in real time — no scrapers to maintain.',
  },
  {
    icon: BadgeIndianRupee,
    title: 'Price Comparison',
    copy: 'Results are normalised, ranked and compared across sellers.',
  },
  {
    icon: Sparkles,
    title: 'Best Value',
    copy: 'A transparent score weighs price, rating and review volume.',
  },
]

export function TrustStrip() {
  return (
    <section className="border-ink-100 border-y bg-ink-50/50 py-10" aria-label="What SnapBuy does">
      <div className="container-page grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((item, index) => (
          <div
            key={item.title}
            className="group animate-[var(--animate-fade-up)] flex gap-3 transition-transform duration-300 hover:-translate-y-1"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <span className="bg-brand-50 text-brand-600 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:bg-brand-100">
              <item.icon className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-semibold transition-colors duration-300 group-hover:text-brand-700">
                {item.title}
              </h3>
              <p className="text-ink-500 mt-1 text-xs leading-relaxed">{item.copy}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
