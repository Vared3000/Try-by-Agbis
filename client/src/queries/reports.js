import { useQuery } from '@tanstack/react-query'

import { getFinancialReport, getOperationalReport } from '../services/reports.js'

export const operationalReportKey = ['reports', 'operational']
export const financialReportKey = ['reports', 'financial']

export function useOperationalReport(options = {}) {
  return useQuery({
    queryKey: operationalReportKey,
    queryFn: getOperationalReport,
    ...options,
  })
}

export function useFinancialReport(options = {}) {
  return useQuery({
    queryKey: financialReportKey,
    queryFn: getFinancialReport,
    ...options,
  })
}
