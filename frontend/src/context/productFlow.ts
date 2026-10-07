import { createContext, useContext } from 'react'
import type { ProductSearchController } from '../hooks/useProductSearch'

/**
 * Context object + consumer hook live in this plain module so the provider file
 * only exports a component (keeps React Fast Refresh happy).
 */
export const ProductFlowContext = createContext<ProductSearchController | null>(null)

/**
 * Access the upload → identify → search flow.
 * Throws when used outside the provider, which is a programming error.
 */
export function useProductFlow(): ProductSearchController {
  const context = useContext(ProductFlowContext)
  if (!context) {
    throw new Error('useProductFlow must be used inside <ProductFlowProvider>')
  }
  return context
}
