// Smart default viktsteg baserat pa redskap. Anvands nar ovningen saknar
// eget weight_increment - bade av progressionen och av +/- i passet.
export function defaultWeightIncrement(equipment) {
  const eq = (equipment ?? '').toLowerCase()
  if (eq === 'hantel') return 2
  if (eq === 'maskin') return 5
  return 2.5
}

/**
 * Returns display weight for the user.
 * Always shows the weight as logged (per hand/arm).
 */
export function displayWeight(weight, equipment) {
  return parseFloat(weight) || 0
}

/**
 * Format weight for display.
 */
export function displayWeightStr(weight, equipment) {
  // Upp till tva decimaler utan avslutande nollor. toFixed(1) visade 6.25
  // som "6.3" och 13.75 som "13.8" - fel vikt for 1,25-kilossteg.
  const w = displayWeight(weight, equipment)
  // Svenskt decimalkomma i all visning (inmatningsfalten ar egna).
  return String(Math.round(w * 100) / 100).replace('.', ',')
}
