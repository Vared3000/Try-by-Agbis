import * as initialSchema from './202607230001-initial-schema.js'
import * as financialConstraints from './202607240001-financial-constraints.js'
import * as nomenclatureItems from './202607240002-nomenclature-items.js'

export const migrations = [initialSchema, financialConstraints, nomenclatureItems]
