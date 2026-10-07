import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Menu, ScanSearch, X } from 'lucide-react'
import { cx } from '../lib/format'
import { Logo } from './Logo'

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'How It Works', to: '/#how-it-works' },
  { label: 'About', to: '/about' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile menu on navigation.
  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.hash])

  const handleTrySnapBuy = () => {
    setOpen(false)
    if (location.pathname === '/') {
      document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    navigate('/#upload')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      'rounded-lg px-3 py-2 text-sm font-medium transition',
      isActive && location.hash === ''
        ? 'text-ink-900 bg-ink-100'
        : 'text-ink-600 hover:text-ink-900 hover:bg-ink-50',
    )

  return (
    <header
      className={cx(
        'sticky top-0 z-50 w-full border-b transition',
        scrolled
          ? 'border-ink-100 bg-white/85 backdrop-blur-md'
          : 'border-transparent bg-white/70 backdrop-blur-sm',
      )}
    >
      <nav className="container-page flex h-16 items-center justify-between gap-4" aria-label="Main">
        <Link
          to="/"
          className="focus-visible:outline-brand-500 flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"
          aria-label="SnapBuy home"
        >
          <Logo />
          <span className="text-ink-900 text-lg font-bold tracking-tight">SnapBuy</span>
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.to}>
              {link.to.startsWith('/#') ? (
                <Link
                  to={link.to}
                  className="text-ink-600 hover:text-ink-900 hover:bg-ink-50 rounded-lg px-3 py-2 text-sm font-medium transition"
                >
                  {link.label}
                </Link>
              ) : (
                <NavLink to={link.to} className={linkClass} end={link.to === '/'}>
                  {link.label}
                </NavLink>
              )}
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <button type="button" onClick={handleTrySnapBuy} className="btn-primary hidden sm:inline-flex">
            <ScanSearch aria-hidden="true" className="h-4 w-4" />
            Try SnapBuy
          </button>
          <button
            type="button"
            className="btn-ghost md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-ink-100 animate-[var(--animate-fade-in)] border-t bg-white md:hidden">
          <ul className="container-page flex flex-col gap-1 py-3">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className="text-ink-700 hover:bg-ink-50 block rounded-xl px-3 py-3 text-sm font-medium"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="pt-1">
              <button type="button" onClick={handleTrySnapBuy} className="btn-primary w-full">
                <ScanSearch aria-hidden="true" className="h-4 w-4" />
                Try SnapBuy
              </button>
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}
