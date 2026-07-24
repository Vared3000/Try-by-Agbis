import { describe, expect, it } from 'vitest'

import { defectsForNomenclature } from '../features/orders/defect-options.js'

describe('defectsForNomenclature', () => {
  const allDefects = [
    { id: 'tear', name: 'Порыв' },
    { id: 'zipper', name: 'Повреждена молния' },
    { id: 'stain', name: 'Пятно неизвестного происхождения' },
  ]

  it('keeps the common list for nomenclature without a group', () => {
    expect(defectsForNomenclature({ defectGroupId: null }, allDefects)).toEqual(
      allDefects,
    )
  })

  it('returns only defects assigned to the nomenclature group', () => {
    const carpet = {
      defectGroupId: 'carpets',
      defectGroup: {
        defects: [allDefects[0], allDefects[2]],
      },
    }
    expect(defectsForNomenclature(carpet, allDefects)).toEqual([
      allDefects[0],
      allDefects[2],
    ])
  })
})
