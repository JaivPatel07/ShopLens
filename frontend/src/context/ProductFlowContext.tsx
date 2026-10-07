import type { ReactNode } from 'react'
import { useProductSearch } from '../hooks/useProductSearch'
import { ProductFlowContext } from './productFlow'

/**
 * Holds the upload → identify → search flow above the router so the state
 * survives navigation between the Home and Results pages.
 */
export function ProductFlowProvider({ children }: { children: ReactNode }) {
  const controller = useProductSearch()
  return <ProductFlowContext.Provider value={controller}>{children}</ProductFlowContext.Provider>
}
