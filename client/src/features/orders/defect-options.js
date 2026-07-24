export function defectsForNomenclature(nomenclature, allDefects) {
  if (!nomenclature?.defectGroupId) return allDefects ?? []
  return nomenclature.defectGroup?.defects ?? []
}
