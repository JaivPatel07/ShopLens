import { ArrowRight, Camera, ScanSearch, Search, Sparkles, TrendingDown, Zap } from 'lucide-react'

const STATS = [
  { value: 'Google Lens', label: 'Visual search engine' },
  { value: 'SerpApi', label: 'Live product data' },
  { value: 'OWL-ViT', label: 'AI recognition model' },
  { value: '< 3s', label: 'Average search time' },
]

const PIPELINE = [
  { icon: Camera,      label: 'Upload photo',      detail: 'JPG · PNG · WEBP', color: 'from-brand-500 to-brand-400' },
  { icon: Sparkles,    label: 'AI identifies',      detail: 'OWL-ViT vision model', color: 'from-brand-400 to-accent-500' },
  { icon: ScanSearch,  label: 'Google Lens scan',   detail: 'Pixel-perfect match', color: 'from-accent-500 to-accent-400' },
  { icon: TrendingDown,label: 'Best deal found',    detail: 'Live merchant prices', color: 'from-accent-400 to-deal-500' },
]

export function Hero() {
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <section
      className="hero-grid relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24"
      aria-labelledby="hero-heading"
    >
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -top-40 -left-32 h-[520px] w-[520px] animate-[var(--animate-drift)] rounded-full bg-brand-500/10 blur-[100px]" />
        <div
          className="absolute -top-20 right-0 h-[420px] w-[420px] animate-[var(--animate-drift)] rounded-full bg-accent-400/15 blur-[90px]"
          style={{ animationDelay: '-9s' }}
        />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-white/90" />
      </div>

      <div className="container-page">
        {/* Top announcement pill */}
        <div className="flex justify-center animate-[var(--animate-fade-in)]">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-white/90 px-4 py-1.5 text-xs font-semibold text-brand-700 shadow-[var(--shadow-soft)] backdrop-blur-sm transition-transform duration-300 hover:scale-[1.04]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-deal-500" aria-hidden="true" />
            <Zap className="h-3.5 w-3.5 text-brand-500" aria-hidden="true" />
            Powered by SerpApi · Hackathon Edition 2026
          </p>
        </div>

        {/* Main headline */}
        <div className="mt-8 max-w-4xl mx-auto text-center animate-[var(--animate-fade-up)]">
          <h1
            id="hero-heading"
            className="text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
          >
            See it.{' '}
            <span className="gradient-text">Search it.</span>
            <br />
            Buy with confidence.
          </h1>
          <p className="text-ink-600 mt-6 max-w-2xl mx-auto text-base leading-relaxed sm:text-lg">
            Upload any product photo and ShopLens finds visually identical matches with live prices
            from top merchants — powered by Google Lens and SerpApi.
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('search-image-tab')
                if (el) el.click()
                scrollTo('upload')
              }}
              className="btn-primary btn-lg group"
            >
              <Camera className="h-5 w-5" aria-hidden="true" />
              Start with a photo
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('search-text-tab')
                if (el) el.click()
                scrollTo('upload')
              }}
              className="btn-secondary btn-lg"
            >
              <Search className="h-4.5 w-4.5" aria-hidden="true" />
              Search by Name
            </button>
          </div>
        </div>

        {/* Stats row */}
        <dl className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4 max-w-3xl mx-auto">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className="card text-center py-4 px-3 animate-[var(--animate-fade-up)]"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <dt className="label">{stat.label}</dt>
              <dd className="mt-1.5 text-lg font-bold text-ink-900 leading-tight">{stat.value}</dd>
            </div>
          ))}
        </dl>

        {/* Pipeline strip */}
        <div className="mt-16 mx-auto max-w-4xl">
          <div className="relative flex flex-col sm:flex-row items-stretch gap-3 sm:gap-0">
            {/* Connector line (desktop) */}
            <div
              className="pointer-events-none absolute top-1/2 left-0 right-0 hidden sm:block h-px -translate-y-1/2"
              style={{
                background: 'linear-gradient(90deg, var(--color-brand-300), var(--color-accent-400), var(--color-deal-500))',
              }}
              aria-hidden="true"
            />
            {PIPELINE.map((step, i) => (
              <div
                key={step.label}
                className="relative z-10 flex flex-1 flex-col items-center text-center animate-[var(--animate-bounce-in)]"
                style={{ animationDelay: `${i * 90 + 300}ms` }}
              >
                <span
                  className={`flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br ${step.color} text-white shadow-[var(--shadow-glow)] transition-transform duration-300 hover:scale-110`}
                >
                  <step.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-semibold text-ink-900">{step.label}</p>
                <p className="mt-0.5 text-xs text-ink-500">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
