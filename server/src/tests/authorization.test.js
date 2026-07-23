import { describe, expect, it, vi } from 'vitest'

import { requireBranchAccess, requirePermission } from '../middlewares/authorize.js'

function execute(middleware, req) {
  const next = vi.fn()
  middleware(req, {}, next)
  return next
}

describe('authorization middleware', () => {
  it('requires an exact permission', () => {
    const allowed = execute(requirePermission('orders.view'), {
      auth: { permissions: ['orders.view'] },
    })
    expect(allowed).toHaveBeenCalledWith()

    const denied = execute(requirePermission('orders.update'), {
      auth: { permissions: ['orders.view'] },
    })
    expect(denied.mock.calls[0][0]).toMatchObject({
      status: 403,
      code: 'AUTH_PERMISSION_DENIED',
    })
  })

  it('rejects a branch outside the authenticated branch scope', () => {
    const allowed = execute(requireBranchAccess(), {
      auth: { branchIds: ['assigned'] },
      params: { branchId: 'assigned' },
    })
    expect(allowed).toHaveBeenCalledWith()

    const denied = execute(requireBranchAccess(), {
      auth: { branchIds: ['assigned'] },
      params: { branchId: 'foreign' },
    })
    expect(denied.mock.calls[0][0]).toMatchObject({
      status: 403,
      code: 'AUTH_BRANCH_DENIED',
    })
  })
})
