import { ApiError } from '../shared/api-error.js'

export function createAuthenticate({ authService }) {
  return async function authenticate(req, _res, next) {
    try {
      const authorization = req.headers.authorization
      if (!authorization?.startsWith('Bearer ')) {
        throw new ApiError({
          status: 401,
          code: 'AUTH_ACCESS_REQUIRED',
          message: 'Требуется авторизация',
        })
      }

      const payload = await authService.verifyAccessToken(authorization.slice(7))
      const access = await authService.loadAccess(payload.sub)
      if (access.user.organizationId !== payload.organizationId) {
        throw new ApiError({
          status: 401,
          code: 'AUTH_ACCESS_INVALID',
          message: 'Требуется действительная авторизация',
        })
      }

      req.auth = {
        userId: access.user.id,
        email: access.user.email,
        displayName: access.user.displayName,
        organizationId: access.user.organizationId,
        branchIds: access.branchIds,
        permissions: access.permissions,
        roleCodes: access.roleCodes,
        sessionId: payload.sessionId,
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}
