import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

const requiredPaths = [
  '/auth/login',
  '/clients',
  '/orders',
  '/orders/{id}/accept',
  '/orders/{orderId}/payments',
  '/payments/{paymentId}/refunds',
  '/production/items/scan/{scanCode}',
  '/orders/{orderId}/issues',
  '/reports/operational',
  '/reports/financial',
  '/audit',
]

describe('OpenAPI contract', () => {
  it('is valid JSON OpenAPI 3.1 and documents critical routes', async () => {
    const source = await readFile(new URL('../../../docs/openapi.json', import.meta.url))
    const contract = JSON.parse(source)

    expect(contract.openapi).toBe('3.1.0')
    expect(contract.servers[0].url).toBe('/api/v1')
    for (const path of requiredPaths) {
      expect(contract.paths, path).toHaveProperty(path)
    }
    expect(contract.components.securitySchemes).toHaveProperty('bearerAuth')
    expect(contract.components.securitySchemes).toHaveProperty('refreshCookie')
  })
})
