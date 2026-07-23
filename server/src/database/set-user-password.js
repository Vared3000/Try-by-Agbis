import { emitKeypressEvents } from 'node:readline'

import argon2 from 'argon2'

import { parseEnv } from '../config/env.js'
import { createLogger } from '../config/logger.js'
import { createSequelize } from './sequelize.js'

function readSecret(prompt) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('Password setup requires an interactive terminal')
  }

  return new Promise((resolve, reject) => {
    let value = ''
    process.stdout.write(prompt)
    emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.resume()

    const finish = (error) => {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdin.off('keypress', onKeypress)
      process.stdout.write('\n')
      if (error) reject(error)
      else resolve(value)
    }

    const onKeypress = (character, key) => {
      if (key?.ctrl && key.name === 'c') {
        finish(new Error('Password setup cancelled'))
      } else if (key?.name === 'return') {
        finish()
      } else if (key?.name === 'backspace') {
        value = value.slice(0, -1)
      } else if (character && !key?.ctrl && !key?.meta) {
        value += character
      }
    }

    process.stdin.on('keypress', onKeypress)
  })
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  if (!email) {
    throw new Error('Usage: pnpm user:set-password <email>')
  }

  const password = await readSecret('Новый пароль: ')
  const confirmation = await readSecret('Повторите пароль: ')
  if (password !== confirmation) throw new Error('Passwords do not match')
  if (password.length < 12)
    throw new Error('Password must contain at least 12 characters')

  const env = parseEnv()
  const logger = createLogger({ environment: env.NODE_ENV, level: env.LOG_LEVEL })
  const sequelize = createSequelize(env, logger)

  try {
    const user = await sequelize.models.User.findOne({ where: { email } })
    if (!user) throw new Error(`User not found: ${email}`)
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    })
    await sequelize.transaction(async (transaction) => {
      await user.update({ passwordHash, status: 'active' }, { transaction })
      await sequelize.models.RefreshSession.update(
        { revokedAt: new Date() },
        { where: { userId: user.id, revokedAt: null }, transaction },
      )
    })
    logger.info({ userId: user.id, email }, 'user password updated')
  } finally {
    await sequelize.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
