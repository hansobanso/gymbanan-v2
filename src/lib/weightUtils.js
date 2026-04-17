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
  const w = displayWeight(weight, equipment)
  return w % 1 === 0 ? String(w) : w.toFixed(1)
}
