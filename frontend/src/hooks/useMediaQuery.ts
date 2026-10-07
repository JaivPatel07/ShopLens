import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query (used to auto-close the mobile filter drawer).
 * The initial value is read during state initialisation, so setting state in the
 * effect is never needed.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(query)
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}
