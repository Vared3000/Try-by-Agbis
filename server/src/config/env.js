import { z } from 'zod'

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true')

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  SERVER_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  DATABASE_URL: z.string().url(),
  DATABASE_SSL: booleanFromString,
  DB_POOL_MIN: z.coerce.number().int().min(0).default(0),
  DB_POOL_MAX: z.coerce.number().int().min(1).default(10),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  AUTH_COOKIE_NAME: z.string().min(1).default('cleanflow_refresh'),
  AUTH_COOKIE_SECURE: booleanFromString,
  AUTH_COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
  CORS_ORIGIN: z.string().optional(),
  FILE_STORAGE_PATH: z.string().min(1).default('uploads'),
  FILE_MAX_SIZE_MB: z.coerce.number().int().min(1).max(50).default(10),
  FILE_MAX_PER_ITEM: z.coerce.number().int().min(1).max(50).default(10),
})

export function parseEnv(rawEnv = process.env) {
  const result = envSchema.safeParse(rawEnv)

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`Invalid environment configuration: ${fields}`)
  }

  if (result.data.DB_POOL_MIN > result.data.DB_POOL_MAX) {
    throw new Error(
      'Invalid environment configuration: DB_POOL_MIN must not exceed DB_POOL_MAX',
    )
  }

  return Object.freeze(result.data)
}
