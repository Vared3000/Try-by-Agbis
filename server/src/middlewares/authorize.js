import { ApiError } from '../shared/api-error.js'

export function requirePermission(permission) {
  return function authorize(req, _res, next) {
    if (!req.auth?.permissions.includes(permission)) {
      next(
        new ApiError({
          status: 403,
          code: 'AUTH_PERMISSION_DENIED',
          message: 'Недостаточно прав',
        }),
      )
      return
    }
    next()
  }
}

export function requireBranchAccess(getBranchId = (req) => req.params.branchId) {
  return function authorizeBranch(req, _res, next) {
    const branchId = getBranchId(req)
    if (!branchId || !req.auth?.branchIds.includes(branchId)) {
      next(
        new ApiError({
          status: 403,
          code: 'AUTH_BRANCH_DENIED',
          message: 'Нет доступа к филиалу',
        }),
      )
      return
    }
    next()
  }
}
