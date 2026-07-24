import * as initialSchema from './202607230001-initial-schema.js'
import * as financialConstraints from './202607240001-financial-constraints.js'
import * as nomenclatureItems from './202607240002-nomenclature-items.js'
import * as orderItemNomenclatureNullability from './202607240003-order-item-nomenclature-nullability.js'
import * as nomenclatureConstraints from './202607240004-nomenclature-constraints.js'
import * as orderNumberScope from './202607240005-order-number-scope.js'
import * as defectGroups from './202607240006-defect-groups.js'
import * as priceListNomenclature from './202607240007-price-list-nomenclature.js'
import * as priceListServiceNullability from './202607240008-price-list-service-nullability.js'

export const migrations = [
  initialSchema,
  financialConstraints,
  nomenclatureItems,
  orderItemNomenclatureNullability,
  nomenclatureConstraints,
  orderNumberScope,
  defectGroups,
  priceListNomenclature,
  priceListServiceNullability,
]
