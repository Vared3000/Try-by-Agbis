import { Router } from 'express'
import { Op } from 'sequelize'
import { z } from 'zod'

import { createAuthenticate } from '../../middlewares/authenticate.js'
import { requirePermission } from '../../middlewares/authorize.js'
import { ApiError } from '../../shared/api-error.js'
import { createAuthService } from '../auth/auth.service.js'

const createInput = z.object({
  name: z.string().trim().min(2).max(255),
  defectIds: z.array(z.string().uuid()).default([]),
})

const updateInput = createInput
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

const success = (data, correlationId) => ({
  data,
  meta: { correlationId },
  error: null,
})

const missing = () =>
  new ApiError({
    status: 404,
    code: 'DEFECT_GROUP_NOT_FOUND',
    message: 'Группа дефектов не найдена',
  })

export function createDefectGroupsRouter({ sequelize, env }) {
  const router = Router()
  const models = sequelize.models
  const authenticate = createAuthenticate({
    authService: createAuthService({ sequelize, env }),
  })
  router.use(authenticate)

  const includeDefects = {
    model: models.Defect,
    as: 'defects',
    required: false,
    through: { attributes: [] },
    where: { archivedAt: null },
  }

  const findGroup = (id, organizationId, transaction) =>
    models.DefectGroup.findOne({
      where: { id, organizationId, archivedAt: null },
      include: [includeDefects],
      transaction,
    })

  const validateDefects = async (defectIds, organizationId, transaction) => {
    const uniqueIds = [...new Set(defectIds)]
    if (!uniqueIds.length) return uniqueIds
    const count = await models.Defect.count({
      where: {
        id: { [Op.in]: uniqueIds },
        organizationId,
        archivedAt: null,
      },
      transaction,
    })
    if (count !== uniqueIds.length) {
      throw new ApiError({
        status: 422,
        code: 'DEFECT_GROUP_DEFECT_INVALID',
        message: 'Один из выбранных дефектов недоступен',
      })
    }
    return uniqueIds
  }

  const replaceDefects = async (groupId, defectIds, organizationId, transaction) => {
    await models.DefectGroupDefect.destroy({
      where: { defectGroupId: groupId, organizationId },
      transaction,
    })
    if (defectIds.length) {
      await models.DefectGroupDefect.bulkCreate(
        defectIds.map((defectId) => ({
          organizationId,
          defectGroupId: groupId,
          defectId,
        })),
        { transaction },
      )
    }
  }

  router.get('/', requirePermission('catalog.view'), async (req, res) => {
    const rows = await models.DefectGroup.findAll({
      where: {
        organizationId: req.auth.organizationId,
        archivedAt: null,
      },
      include: [includeDefects],
      order: [
        ['name', 'ASC'],
        [{ model: models.Defect, as: 'defects' }, 'name', 'ASC'],
      ],
    })
    res.json(success(rows, req.correlationId))
  })

  router.post('/', requirePermission('catalog.manage'), async (req, res) => {
    const input = createInput.parse(req.body)
    const row = await sequelize.transaction(async (transaction) => {
      const defectIds = await validateDefects(
        input.defectIds,
        req.auth.organizationId,
        transaction,
      )
      const group = await models.DefectGroup.create(
        {
          organizationId: req.auth.organizationId,
          name: input.name,
          version: 0,
        },
        { transaction },
      )
      await replaceDefects(
        group.id,
        defectIds,
        req.auth.organizationId,
        transaction,
      )
      return findGroup(group.id, req.auth.organizationId, transaction)
    })
    res.status(201).json(success(row, req.correlationId))
  })

  router.patch('/:id', requirePermission('catalog.manage'), async (req, res) => {
    const input = updateInput.parse(req.body)
    const row = await sequelize.transaction(async (transaction) => {
      const group = await models.DefectGroup.findOne({
        where: {
          id: req.params.id,
          organizationId: req.auth.organizationId,
          archivedAt: null,
        },
        transaction,
      })
      if (!group) throw missing()
      const defectIds =
        input.defectIds === undefined
          ? null
          : await validateDefects(
              input.defectIds,
              req.auth.organizationId,
              transaction,
            )
      await group.update(
        {
          ...(input.name ? { name: input.name } : {}),
          version: group.version + 1,
        },
        { transaction },
      )
      if (defectIds) {
        await replaceDefects(
          group.id,
          defectIds,
          req.auth.organizationId,
          transaction,
        )
      }
      return findGroup(group.id, req.auth.organizationId, transaction)
    })
    res.json(success(row, req.correlationId))
  })

  router.delete('/:id', requirePermission('catalog.manage'), async (req, res) => {
    await sequelize.transaction(async (transaction) => {
      const group = await models.DefectGroup.findOne({
        where: {
          id: req.params.id,
          organizationId: req.auth.organizationId,
          archivedAt: null,
        },
        transaction,
      })
      if (!group) throw missing()
      await models.NomenclatureItem.update(
        { defectGroupId: null },
        {
          where: {
            defectGroupId: group.id,
            organizationId: req.auth.organizationId,
          },
          transaction,
        },
      )
      await group.update(
        { archivedAt: new Date(), version: group.version + 1 },
        { transaction },
      )
    })
    res.json(success({ archived: true }, req.correlationId))
  })

  return router
}
