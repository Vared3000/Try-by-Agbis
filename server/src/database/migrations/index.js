import * as initialSchema from './202607230001-initial-schema.js'
import * as financialConstraints from './202607240001-financial-constraints.js'
import * as nomenclatureItems from './202607240002-nomenclature-items.js'
import * as orderItemNomenclatureNullability from './202607240003-order-item-nomenclature-nullability.js'
import * as nomenclatureConstraints from './202607240004-nomenclature-constraints.js'

export const migrations = [
  initialSchema,
  financialConstraints,
  nomenclatureItems,
  orderItemNomenclatureNullability,
  nomenclatureConstraints,
]
