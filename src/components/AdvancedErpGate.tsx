import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { FEATURE_FLAGS } from '@/domain/rules'

/** V1.0 hides advanced ERP pages from the primary product surface. */
export function AdvancedErpGate({ children }: { children: ReactNode }) {
  if (!FEATURE_FLAGS.showAdvancedErp) {
    return <Navigate to="/more" replace />
  }
  return children
}
