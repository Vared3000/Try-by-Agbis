import { createHash, randomBytes } from 'node:crypto'
import path from 'node:path'

import { Router } from 'express'
import multer, { MulterError } from 'multer'

import { createAuthenticate } from '../../middlewares/authenticate.js'
import { requirePermission } from '../../middlewares/authorize.js'
import { ApiError } from '../../shared/api-error.js'
import { createAuthService } from '../auth/auth.service.js'
import { createLocalFileStorage } from './local-file-storage.js'

const types = {
  'image/jpeg': {
    extension: 'jpg',
    matches: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  'image/png': {
    extension: 'png',
    matches: (buffer) =>
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  'image/webp': {
    extension: 'webp',
    matches: (buffer) =>
      buffer.subarray(0, 4).toString() === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WEBP',
  },
}

const success = (data, correlationId) => ({
  data,
  meta: { correlationId },
  error: null,
})

export function createFilesRouter({ sequelize, env }) {
  const router = Router()
  const authenticate = createAuthenticate({
    authService: createAuthService({ sequelize, env }),
  })
  const storage = createLocalFileStorage(env.FILE_STORAGE_PATH)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.FILE_MAX_SIZE_MB * 1024 * 1024, files: 1 },
  }).single('file')
  const { File, OrderItem, Order } = sequelize.models

  router.use(authenticate)

  router.post('/', requirePermission('files.upload'), (req, res, next) => {
    upload(req, res, async (uploadError) => {
      try {
        if (uploadError) {
          const tooLarge =
            uploadError instanceof MulterError && uploadError.code === 'LIMIT_FILE_SIZE'
          throw new ApiError({
            status: tooLarge ? 413 : 400,
            code: tooLarge ? 'FILE_TOO_LARGE' : 'FILE_UPLOAD_INVALID',
            message: tooLarge ? 'Файл слишком большой' : 'Некорректная загрузка',
          })
        }
        if (!req.file || !req.body.orderItemId) {
          throw new ApiError({
            status: 400,
            code: 'FILE_UPLOAD_INVALID',
            message: 'Требуются файл и orderItemId',
          })
        }
        const type = types[req.file.mimetype]
        if (!type?.matches(req.file.buffer)) {
          throw new ApiError({
            status: 415,
            code: 'FILE_TYPE_UNSUPPORTED',
            message: 'Разрешены JPEG, PNG и WebP',
          })
        }
        const item = await OrderItem.findOne({
          where: {
            id: req.body.orderItemId,
            organizationId: req.auth.organizationId,
          },
          include: [{ model: Order, as: 'order', required: true }],
        })
        if (!item || !req.auth.branchIds.includes(item.order.branchId)) {
          throw new ApiError({
            status: 404,
            code: 'ORDER_ITEM_NOT_FOUND',
            message: 'Изделие не найдено',
          })
        }
        const count = await File.count({ where: { orderItemId: item.id } })
        if (count >= env.FILE_MAX_PER_ITEM) {
          throw new ApiError({
            status: 409,
            code: 'FILE_LIMIT_REACHED',
            message: 'Достигнут лимит фотографий изделия',
          })
        }
        const storageKey = path.posix.join(
          req.auth.organizationId,
          item.id,
          `${randomBytes(24).toString('hex')}.${type.extension}`,
        )
        await storage.put(storageKey, req.file.buffer)
        try {
          const file = await File.create({
            organizationId: req.auth.organizationId,
            orderItemId: item.id,
            storageKey,
            originalName: path.basename(req.file.originalname).slice(0, 255),
            mimeType: req.file.mimetype,
            size: String(req.file.size),
            checksum: createHash('sha256').update(req.file.buffer).digest('hex'),
            uploadedByUserId: req.auth.userId,
          })
          res.status(201).json(success(file, req.correlationId))
        } catch (error) {
          await storage.delete(storageKey)
          throw error
        }
      } catch (error) {
        next(error)
      }
    })
  })

  router.get('/:id', requirePermission('files.view'), async (req, res) => {
    const file = await File.findOne({
      where: { id: req.params.id, organizationId: req.auth.organizationId },
      include: [
        {
          model: OrderItem,
          as: 'orderItem',
          required: true,
          include: [{ model: Order, as: 'order', required: true }],
        },
      ],
    })
    if (!file || !req.auth.branchIds.includes(file.orderItem.order.branchId)) {
      throw new ApiError({
        status: 404,
        code: 'FILE_NOT_FOUND',
        message: 'Файл не найден',
      })
    }
    const buffer = await storage.get(file.storageKey)
    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': String(buffer.length),
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.originalName)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    res.send(buffer)
  })

  router.delete('/:id', requirePermission('files.upload'), async (req, res) => {
    const file = await File.findOne({
      where: { id: req.params.id, organizationId: req.auth.organizationId },
      include: [
        {
          model: OrderItem,
          as: 'orderItem',
          required: true,
          include: [{ model: Order, as: 'order', required: true }],
        },
      ],
    })
    if (!file || !req.auth.branchIds.includes(file.orderItem.order.branchId)) {
      throw new ApiError({
        status: 404,
        code: 'FILE_NOT_FOUND',
        message: 'Файл не найден',
      })
    }
    if (file.orderItem.order.status !== 'draft') {
      throw new ApiError({
        status: 409,
        code: 'FILE_DELETE_NOT_ALLOWED',
        message: 'Фотографии принятого заказа нельзя удалить',
      })
    }
    await storage.delete(file.storageKey)
    await file.destroy()
    res.json(success({ deleted: true }, req.correlationId))
  })

  return router
}
