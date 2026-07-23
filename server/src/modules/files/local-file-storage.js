import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export function createLocalFileStorage(rootPath) {
  const root = path.resolve(rootPath)

  const resolveKey = (storageKey) => {
    const target = path.resolve(root, storageKey)
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      throw new Error('Invalid storage key')
    }
    return target
  }

  return {
    async put(storageKey, buffer) {
      const target = resolveKey(storageKey)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, buffer, { flag: 'wx' })
    },
    async get(storageKey) {
      return readFile(resolveKey(storageKey))
    },
    async delete(storageKey) {
      await rm(resolveKey(storageKey), { force: true })
    },
  }
}
