// Muskelpalett (skogsgron) - delad logik for MuscleMap och MuscleHeatmap.
// Synca med --muscle-* i src/index.css om du andrar nyanserna.

export const MUSCLE_UNTRAINED = [45, 80, 22]   // #2D5016 - skogsgron, outranad/vilad baseline
export const MUSCLE_RESTED    = [45, 80, 22]   // #2D5016 - baseline vilad gron
export const MUSCLE_TRAINED   = [245, 208, 32] // #F5D020 - full accent gul

// Hex-strangar for CSS-fallbacks och inline-anvandning
export const MUSCLE_UNTRAINED_HEX = '#2D5016'
export const MUSCLE_RESTED_HEX    = '#2D5016'
export const MUSCLE_TRAINED_HEX   = '#F5D020'

function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

/**
 * Mappa intensity (0-1) till en farg pa skogsgron-skalan.
 *   0     → baseline skogsgron (outranad/vilad - samma farg)
 *   0 → 1 → gradient fran baseline-gron till full accent-gul
 */
export function colorForIntensity(intensity) {
  if (!intensity || intensity <= 0) {
    const c = MUSCLE_RESTED
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
  }
  const c = lerp(MUSCLE_RESTED, MUSCLE_TRAINED, Math.min(1, intensity))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}
