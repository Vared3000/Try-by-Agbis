import { createHash, randomBytes, randomUUID } from 'node:crypto'

import argon2 from 'argon2'
import { jwtVerify, SignJWT } from 'jose'

import { ApiError } from '../../shared/api-error.js'

const invalidCredentials = () =>
  new ApiError({
    status: 401,
    code: 'AUTH_INVALID_CREDENTIALS',
    message: 'Неверный email или пароль',
  })

const invalidRefresh = () =>
  new ApiError({
    status: 401,
    code: 'AUTH_REFRESH_INVALID',
    message: 'Сессия недействительна',
  })

const tokenHash = (token) => createHash('sha256').update(token).digest('hex')

export function createAuthService({ sequelize, env }) {
  const { User, Branch, Role, Permission, RefreshSession } = sequelize.models
  const jwtKey = new TextEncoder().encode(env.ACCESS_TOKEN_SECRET)

  async function loadAccess(userId, transaction) {
    const user = await User.findByPk(userId, {
      attributes: ['id', 'organizationId', 'email', 'displayName', 'status'],
      include: [
        {
          model: Branch,
          as: 'branches',
          attributes: ['id'],
          through: { attributes: [] },
          required: false,
        },
        {
          model: Role,
          as: 'roles',
          attributes: ['id', 'code'],
          through: { attributes: [] },
          required: false,
          include: [
            {
              model: Permission,
              as: 'permissions',
              attributes: ['code'],
              through: { attributes: [] },
              required: false,
            },
          ],
        },
      ],
      transaction,
    })

    if (!user || user.status !== 'active') throw invalidCredentials()

    const permissions = [
      ...new Set(user.roles.flatMap((role) => role.permissions.map(({ code }) => code))),
    ].sort()
    return {
      user,
      permissions,
      branchIds: user.branches.map(({ id }) => id),
      roleCodes: user.roles.map(({ code }) => code),
    }
  }

  async function issueAccessToken(access, sessionId) {
    return new SignJWT({
      organizationId: access.user.organizationId,
      sessionId,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(access.user.id)
      .setIssuer('cleanflow-api')
      .setAudience('cleanflow-client')
      .setIssuedAt()
      .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(jwtKey)
  }

  async function createRefreshSession({
    user,
    familyId = randomUUID(),
    userAgent,
    ipAddress,
    transaction,
  }) {
    const token = randomBytes(48).toString('base64url')
    const session = await RefreshSession.create(
      {
        organizationId: user.organizationId,
        userId: user.id,
        tokenHash: tokenHash(token),
        familyId,
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
        userAgent: userAgent?.slice(0, 500) || null,
        ipAddress: ipAddress || null,
      },
      { transaction },
    )
    return { session, token }
  }

  async function login({ email, password, userAgent, ipAddress }) {
    const user = await User.findOne({ where: { email } })
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
      throw invalidCredentials()
    }

    return sequelize.transaction(async (transaction) => {
      const access = await loadAccess(user.id, transaction)
      const { session, token: refreshToken } = await createRefreshSession({
        user,
        userAgent,
        ipAddress,
        transaction,
      })
      await user.update({ lastLoginAt: new Date() }, { transaction })
      return {
        accessToken: await issueAccessToken(access, session.id),
        refreshToken,
        expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
        access,
      }
    })
  }

  async function refresh({ refreshToken, userAgent, ipAddress }) {
    if (!refreshToken) throw invalidRefresh()

    const result = await sequelize.transaction(async (transaction) => {
      const session = await RefreshSession.findOne({
        where: { tokenHash: tokenHash(refreshToken) },
        transaction,
        lock: transaction.LOCK.UPDATE,
      })
      if (!session) throw invalidRefresh()

      if (session.revokedAt) {
        await RefreshSession.update(
          { revokedAt: new Date() },
          { where: { familyId: session.familyId, revokedAt: null }, transaction },
        )
        return { reused: true }
      }
      if (session.expiresAt <= new Date()) throw invalidRefresh()

      const access = await loadAccess(session.userId, transaction)
      const next = await createRefreshSession({
        user: access.user,
        familyId: session.familyId,
        userAgent,
        ipAddress,
        transaction,
      })
      await session.update(
        { revokedAt: new Date(), replacedById: next.session.id },
        { transaction },
      )
      return {
        accessToken: await issueAccessToken(access, next.session.id),
        refreshToken: next.token,
        expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
        access,
      }
    })

    if (result.reused) {
      throw new ApiError({
        status: 401,
        code: 'AUTH_REFRESH_REUSED',
        message: 'Обнаружено повторное использование сессии',
      })
    }
    return result
  }

  async function logout(refreshToken) {
    if (!refreshToken) return
    await RefreshSession.update(
      { revokedAt: new Date() },
      { where: { tokenHash: tokenHash(refreshToken), revokedAt: null } },
    )
  }

  async function verifyAccessToken(token) {
    try {
      const { payload } = await jwtVerify(token, jwtKey, {
        issuer: 'cleanflow-api',
        audience: 'cleanflow-client',
        algorithms: ['HS256'],
      })
      return payload
    } catch {
      throw new ApiError({
        status: 401,
        code: 'AUTH_ACCESS_INVALID',
        message: 'Требуется действительная авторизация',
      })
    }
  }

  return { login, refresh, logout, verifyAccessToken, loadAccess }
}
