import { Suspense, lazy, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { AppConfigProvider } from './context/AppConfigContext'
import { ProductFlowProvider } from './context/ProductFlowContext'
import Home from './pages/Home'

const Results = lazy(() => import('./pages/Results'))
const About = lazy(() => import('./pages/About'))

/** Scroll to top on route change, and to a hash target when one is present. */
function ScrollManager() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1))
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pathname, hash])

  return null
}

function PageFallback() {
  return (
    <div className="container-page py-24" role="status" aria-live="polite">
      <div className="skeleton mx-auto h-6 w-40" />
      <div className="skeleton mx-auto mt-4 h-10 w-72" />
      <div className="mx-auto mt-10 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton h-64" />
        ))}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppConfigProvider>
      <ProductFlowProvider>
        <ScrollManager />
        <a
          href="#main"
          className="focus:bg-ink-900 sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main id="main" className="flex-1">
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/results" element={<Results />} />
                <Route path="/about" element={<About />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
      </ProductFlowProvider>
    </AppConfigProvider>
  )
}
