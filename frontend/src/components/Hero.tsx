import { ArrowRight, Camera, ScanSearch, Sparkles, Star, TrendingDown } from 'lucide-react'

const PIPELINE = [
  { icon: Camera, label: 'Upload photo', detail: 'JPG, PNG or WEBP' },
  { icon: Sparkles, label: 'AI identifies', detail: 'Product, brand, attributes' },
  { icon: ScanSearch, label: 'Compare products', detail: 'Live SerpApi shopping data' },
  { icon: TrendingDown, label: 'Find best deal', detail: 'Lowest price & best value' },
]

export function Hero() {
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <section className="relative overflow-hidden pt-14 pb-16 sm:pt-20 sm:pb-24" aria-labelledby="hero-heading">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="bg-brand-200/40 absolute -top-32 -left-24 h-96 w-96 animate-[var(--animate-drift)] rounded-full blur-3xl" />
        <div
          className="bg-accent-400/25 absolute -top-16 right-0 h-80 w-80 animate-[var(--animate-drift)] rounded-full blur-3xl"
          style={{ animationDelay: '-8s' }}
        />
        <div className="to-ink-50/70 absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent" />
      </div>

      <div className="container-page grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-[var(--animate-fade-up)]">
          <p className="border-ink-200 text-ink-600 inline-flex items-center gap-2 rounded-full border bg-white/80 px-3.5 py-1.5 text-xs font-medium shadow-[var(--shadow-soft)] transition-transform duration-300 hover:scale-[1.03]">
            <span className="bg-deal-500 h-1.5 w-1.5 animate-pulse rounded-full" aria-hidden="true" />
            AI recognition + live shopping search via SerpApi
          </p>

          <h1
            id="hero-heading"
            className="mt-5 text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl lg:text-6xl"
          >
            Find any product <span className="gradient-text">from a single photo.</span>
          </h1>

          <p className="text-ink-600 mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
            Snap a product. Let AI identify it. Compare real prices across the web.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => scrollTo('upload')} className="btn-primary btn-lg">
              <Camera className="h-4.5 w-4.5" aria-hidden="true" />
              Upload Product Photo
            </button>
            <button
              type="button"
              onClick={() => scrollTo('how-it-works')}
              className="btn-secondary btn-lg"
            >
              See How It Works
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </button>
          </div>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6">
            <div className="transition-transform duration-300 hover:-translate-y-1">
              <dt className="text-ink-400 text-xs font-medium">Search engine</dt>
              <dd className="text-ink-900 mt-1 text-sm font-semibold">SerpApi Google Shopping</dd>
            </div>
            <div className="transition-transform duration-300 hover:-translate-y-1">
              <dt className="text-ink-400 text-xs font-medium">Recognition</dt>
              <dd className="text-ink-900 mt-1 text-sm font-semibold">AI vision model</dd>
            </div>
            <div className="transition-transform duration-300 hover:-translate-y-1">
              <dt className="text-ink-400 text-xs font-medium">Market</dt>
              <dd className="text-ink-900 mt-1 text-sm font-semibold">India (₹ INR)</dd>
            </div>
          </dl>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="card animate-[var(--animate-float)] relative z-10 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="label">How SnapBuy works</p>
              <span className="chip">4 steps</span>
            </div>

            <ol className="mt-5 space-y-3">
              {PIPELINE.map((step, index) => (
                <li key={step.label} className="group/step relative">
                  <div className="border-ink-100 from-ink-50/60 flex items-center gap-3 rounded-2xl border bg-gradient-to-r to-white p-3.5 transition-all duration-300 group-hover/step:-translate-y-0.5 group-hover/step:border-brand-200 group-hover/step:shadow-[var(--shadow-soft)]">
                    <span className="from-brand-600 to-accent-600 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white transition-transform duration-300 group-hover/step:scale-110 group-hover/step:rotate-[-6deg]">
                      <step.icon className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-ink-900 text-sm font-semibold">{step.label}</p>
                      <p className="text-ink-500 truncate text-xs">{step.detail}</p>
                    </div>
                    <span className="text-ink-300 ml-auto text-xs font-semibold transition-colors duration-300 group-hover/step:text-brand-500">
                      0{index + 1}
                    </span>
                  </div>
                  {index < PIPELINE.length - 1 && (
                    <span
                      className="bg-ink-200 absolute -bottom-1.5 left-8 h-3 w-px"
                      aria-hidden="true"
                    />
                  )}
                </li>
              ))}
            </ol>

            <div className="border-ink-100 mt-5 flex items-center justify-between border-t pt-4">
              <div>
                <p className="text-ink-400 text-xs">Lowest price found</p>
                <p className="text-ink-900 font-mono text-xl font-bold">₹8,499</p>
              </div>
              <div className="text-right">
                <p className="text-ink-400 text-xs">You save</p>
                <p className="text-deal-600 font-mono text-xl font-bold">₹1,500</p>
              </div>
            </div>

            <p className="text-ink-400 mt-3 flex items-center gap-1.5 text-[11px]">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
              Illustrative example of the results view — real searches show live data.
            </p>
          </div>

          <div
            className="from-brand-500 to-accent-500 absolute -inset-4 -z-0 rounded-4xl bg-gradient-to-br opacity-10 blur-2xl transition-opacity duration-500"
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  )
}
