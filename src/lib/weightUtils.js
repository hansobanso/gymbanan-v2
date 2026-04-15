/**
 * Returns display weight for the user.
 * Dumbbell exercises: multiply by 2 (total load both hands).
 */
export function displayWeight(weight, equipment) {
  const w = parseFloat(weight) || 0
  if (!w) return w
  return equipment === 'Hantel' ? w * 2 : w
}

/**
 * Format weight for display with unit.
 * e.g. displayWeightStr(20, 'Hantel') → '40'
 */
export function displayWeightStr(weight, equipment) {
  const w = displayWeight(weight, equipment)
  return w % 1 === 0 ? String(w) : w.toFixed(1)
}
