import { createContext, useContext, type ReactNode } from 'react'
import { useProductSearch, type ProductSearchController } from '../hooks/useProductSearch'

const ProductFlowContext = createContext<ProductSearchController | null>(null)

/**
 * Holds the upload -> identify -> search flow above the router so the state
 * survives navigation between the Home and Results pages.
 */
export function ProductFlowProvider({ children }: { children: ReactNode }) {
  const controller = useProductSearch()
  return <ProductFlowContext.Provider value={controller}>{children}</ProductFlowContext.Provider>
}

export function useProductFlow(): ProductSearchController {
  const context = useContext(ProductFlowContext)
  if (!context) {
    throw new Error('useProductFlow must be used inside <ProductFlowProvider>')
  }
  return context
}
