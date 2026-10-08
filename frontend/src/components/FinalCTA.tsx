import { ArrowRight, Camera } from 'lucide-react'

export function FinalCTA() {
  const scrollToUpload = () =>
    document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <section className="py-20 sm:py-24" aria-labelledby="cta-heading">
      <div className="container-page">
        <div className="from-ink-900 to-ink-800 relative overflow-hidden rounded-4xl bg-gradient-to-br px-6 py-14 text-center sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="bg-brand-500/30 absolute -top-24 left-1/4 h-72 w-72 animate-[var(--animate-drift)] rounded-full blur-3xl" />
            <div className="bg-accent-500/25 absolute -bottom-24 right-1/4 h-72 w-72 animate-[var(--animate-drift)] rounded-full blur-3xl" style={{ animationDelay: '-8s' }} />
          </div>

          <div className="relative">
            <h2 id="cta-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to find a better deal?
            </h2>
            <p className="text-ink-300 mx-auto mt-4 max-w-xl text-base leading-relaxed">
              Upload a product photo and see what the rest of the web is charging — in seconds.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={scrollToUpload}
                className="btn btn-lg bg-white text-ink-900 hover:bg-ink-100"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                Try SnapBuy
              </button>
              <a
                href="/about"
                className="btn btn-lg border border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                About the project
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
