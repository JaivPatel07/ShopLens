import type { ReactNode } from 'react'
import { useProductSearch } from '../hooks/useProductSearch'
import { ProductFlowContext } from './productFlow'

export function ProductFlowProvider({ children }: { children: ReactNode }) {
  const controller = useProductSearch()
  return <ProductFlowContext.Provider value={controller}>{children}</ProductFlowContext.Provider>
}
