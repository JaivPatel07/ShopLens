import { Camera, GitCompareArrows, ScanSearch, Sparkles } from 'lucide-react'

const STEPS = [
  {
    number: '01',
    title: 'Upload',
    copy: 'Upload a photo of any product — the clearer the shot, the better the match.',
    icon: Camera,
  },
  {
    number: '02',
    title: 'Identify',
    copy: 'A vision model analyses the image and generates a product search query.',
    icon: Sparkles,
  },
  {
    number: '03',
    title: 'Search',
    copy: 'SerpApi retrieves matching product results from Google Shopping.',
    icon: ScanSearch,
  },
  {
    number: '04',
    title: 'Compare',
    copy: 'SnapBuy compares prices and helps you find the best deal.',
    icon: GitCompareArrows,
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-20 sm:py-24" aria-labelledby="how-heading">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="label">How it works</p>
          <h2 id="how-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            From photo to price in four steps
          </h2>
          <p className="text-ink-600 mt-4 text-base leading-relaxed">
            Two AI systems, one clear job each: recognition decides <em>what</em> the product is,
            SerpApi decides <em>what it costs</em> right now.
          </p>
        </div>

        <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step.number}
              className="card card-hover group animate-[var(--animate-fade-up)] relative p-6"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span className="text-ink-200 text-3xl font-bold tabular-nums transition-colors duration-300 group-hover:text-brand-300">
                {step.number}
              </span>
              <span className="from-brand-600 to-accent-600 mt-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]">
                <step.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold transition-colors duration-300 group-hover:text-brand-700">
                {step.title}
              </h3>
              <p className="text-ink-500 mt-2 text-sm leading-relaxed">{step.copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
