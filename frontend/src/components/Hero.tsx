import { ArrowRight, Camera, ScanSearch, Sparkles, Star, TrendingDown, Zap } from 'lucide-react'

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
    <section className="hero-grid relative overflow-hidden pt-14 pb-16 sm:pt-20 sm:pb-24" aria-labelledby="hero-heading">
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
            <Zap className="text-brand-600 h-3.5 w-3.5" aria-hidden="true" />
            Live shopping intelligence via SerpApi
          </p>

          <h1
            id="hero-heading"
            className="mt-5 text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl lg:text-6xl"
          >
            See it. <span className="gradient-text">Search it.</span>
            <br />Buy with confidence.
          </h1>

          <p className="text-ink-600 mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
            Turn any product photo into a clear shopping decision. Find live offers, compare
            sellers, and surface the best value without the tab overload.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => scrollTo('upload')} className="btn-primary btn-lg">
              <Camera className="h-4.5 w-4.5" aria-hidden="true" />
              Start with a photo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scrollTo('how-it-works')}
              className="btn-secondary btn-lg"
            >
              Explore the workflow
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
          <div className="border-white/80 animate-[var(--animate-float)] relative z-10 overflow-hidden rounded-[1.75rem] border bg-white/85 p-5 shadow-[0_24px_80px_-30px_rgb(49_46_129_/_0.42)] backdrop-blur-xl sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="label">SnapBuy intelligence</p>
                <p className="text-ink-500 mt-1 text-xs">Photo to live price comparison</p>
              </div>
              <span className="bg-deal-50 text-deal-700 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold"><span className="bg-deal-500 h-1.5 w-1.5 rounded-full" /> LIVE</span>
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

            <div className="from-ink-950 via-ink-900 to-brand-950 mt-5 rounded-2xl bg-gradient-to-br p-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-brand-200 text-[10px] font-bold tracking-[0.14em] uppercase">Recognised product</p>
                  <p className="mt-2 text-lg font-bold">Nike Air Max 270</p>
                  <p className="mt-1 text-sm text-slate-300">Black running shoes</p>
                </div>
                <div className="border-white/10 bg-white/10 rounded-xl border px-2.5 py-2 text-right">
                  <p className="text-[10px] text-slate-300">Confidence</p>
                  <p className="text-sm font-bold">92%</p>
                </div>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="from-deal-400 to-brand-400 h-full w-[92%] rounded-full bg-gradient-to-r" /></div>
            </div>

            <div className="border-ink-100 mt-5 flex items-center justify-between border-t pt-4">
              <div>
                <p className="text-ink-400 text-xs">Best price found</p>
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
