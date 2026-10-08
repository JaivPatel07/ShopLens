import { createContext, useContext } from 'react'
import type { ProductSearchController } from '../hooks/useProductSearch'

export const ProductFlowContext = createContext<ProductSearchController | null>(null)

export function useProductFlow(): ProductSearchController {
  const context = useContext(ProductFlowContext)
  if (!context) {
    throw new Error('useProductFlow must be used inside <ProductFlowProvider>')
  }
  return context
}
