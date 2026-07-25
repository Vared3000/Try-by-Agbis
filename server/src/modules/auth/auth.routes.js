import { parseCookie, stringifySetCookie } from 'cookie'
import { Router } from 'express'

import { createAuthenticate } from '../../middlewares/authenticate.js'
import { createAuthService } from './auth.service.js'
import { loginSchema } from './auth.validation.js'

const success = (data, correlationId) => ({
  data,
  meta: { correlationId },
  error: null,
})

const publicUser = (access) => ({
  id: access.user.id,
  email: access.user.email,
  displayName: access.user.displayName,
  organizationId: access.user.organizationId,
  branchIds: access.branchIds,
  roleCodes: access.roleCodes,
  permissions: access.permissions,
})

export function createAuthRouter({ sequelize, env }) {
  const router = Router()
  const authService = createAuthService({ sequelize, env })
  const authenticate = createAuthenticate({ authService })
  const cookieOptions = {
    httpOnly: true,
    secure: env.AUTH_COOKIE_SECURE,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400,
  }

  const readRefreshToken = (req) =>
    parseCookie(req.headers.cookie ?? '')[env.AUTH_COOKIE_NAME] ?? null

  const writeRefreshCookie = (value, options = cookieOptions) =>
    stringifySetCookie({
      name: env.AUTH_COOKIE_NAME,
      value,
      ...options,
    })

  router.post('/login', async (req, res) => {
    const credentials = loginSchema.parse(req.body)
    const result = await authService.login({
      ...credentials,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    })
    res.append('Set-Cookie', writeRefreshCookie(result.refreshToken))
    res.json(
      success(
        {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
          user: publicUser(result.access),
        },
        req.correlationId,
      ),
    )
  })

  router.post('/refresh', async (req, res) => {
    const result = await authService.refresh({
      refreshToken: readRefreshToken(req),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    })
    res.append('Set-Cookie', writeRefreshCookie(result.refreshToken))
    res.json(
      success(
        {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        },
        req.correlationId,
      ),
    )
  })

  router.post('/logout', async (req, res) => {
    await authService.logout(readRefreshToken(req))
    res.append(
      'Set-Cookie',
      writeRefreshCookie('', {
        ...cookieOptions,
        maxAge: 0,
        expires: new Date(0),
      }),
    )
    res.json(success({ loggedOut: true }, req.correlationId))
  })

  router.get('/me', authenticate, (req, res) => {
    res.json(success(req.auth, req.correlationId))
  })

  router.get('/context', authenticate, async (req, res) => {
    const { Branch, Location, Workplace } = sequelize.models
    const branches = await Branch.findAll({
      where: {
        id: req.auth.branchIds,
        organizationId: req.auth.organizationId,
        archivedAt: null,
      },
      attributes: ['id', 'code', 'name'],
      include: [
        {
          model: Location,
          as: 'locations',
          where: { archivedAt: null },
          required: false,
          attributes: ['id', 'code', 'name', 'type'],
          include: [
            {
              model: Workplace,
              as: 'workplaces',
              where: { archivedAt: null },
              required: false,
              attributes: ['id', 'code', 'name', 'type'],
            },
          ],
        },
      ],
      order: [
        ['name', 'ASC'],
        [
          sequelize.literal(`CASE WHEN "locations"."type" = 'acceptance' THEN 0 ELSE 1 END`),
          'ASC',
        ],
        [{ model: Location, as: 'locations' }, 'name', 'ASC'],
      ],
    })
    res.json(success({ branches }, req.correlationId))
  })

  return router
}
