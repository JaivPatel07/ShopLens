import { BadgeIndianRupee, GitCompareArrows, ScanEye, Search } from 'lucide-react'

const FEATURES = [
  {
    icon: ScanEye,
    title: 'Visual Search',
    copy: 'Skip the typing. Upload a photo and ShopLens works out what the product is, then writes the search query for you.',
  },
  {
    icon: BadgeIndianRupee,
    title: 'Price Comparison',
    copy: 'Every seller is compared side by side with the lowest, average and highest prices calculated from live results.',
  },
  {
    icon: GitCompareArrows,
    title: 'Best Deal',
    copy: 'A transparent score weighs price, rating and review volume to surface the best value — and it says when the data is too thin to call it.',
  },
  {
    icon: Search,
    title: 'Smart Search',
    copy: 'Refine any search with plain language and ShopLens runs a fresh SerpApi query for you, then re-compares everything.',
  },
]

export function Features() {
  return (
    <section className="bg-ink-50/50 border-ink-100 border-y py-20 sm:py-24" aria-labelledby="features-heading">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="label">Features</p>
          <h2 id="features-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to shop smarter
          </h2>
          <p className="text-ink-600 mt-4 text-base leading-relaxed">
            Four focused features instead of a cluttered dashboard. Every one of them is powered by
            real API data.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {FEATURES.map((feature, index) => (
            <article
              key={feature.title}
              className="card card-hover group animate-[var(--animate-fade-up)] p-6 sm:p-7"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span className="from-brand-600 to-accent-600 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]">
                <feature.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold transition-colors duration-300 group-hover:text-brand-700">
                {feature.title}
              </h3>
              <p className="text-ink-600 mt-2 text-sm leading-relaxed">{feature.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
