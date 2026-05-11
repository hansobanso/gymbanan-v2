// Muskelpalett (skogsgron) - delad logik for MuscleMap och MuscleHeatmap.
// Synca med --muscle-* i src/index.css om du andrar nyanserna.

export const MUSCLE_UNTRAINED = [26, 46, 16]   // #1A2E10 - mork dov gron, outranad
export const MUSCLE_RESTED    = [61, 107, 31]  // #3D6B1F - baseline vilad gron, lite ljusare
export const MUSCLE_TRAINED   = [245, 208, 32] // #F5D020 - full accent gul

// Hex-strangar for CSS-fallbacks och inline-anvandning
export const MUSCLE_UNTRAINED_HEX = '#1A2E10'
export const MUSCLE_RESTED_HEX    = '#3D6B1F'
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
 *   0          → extra mork gron (helt outranad)
 *   0 → 0.15   → snabb overgang till baseline-vilad (muskeln har "lyfts")
 *   0.15 → 1.0 → gradient fran baseline-gron till full accent-gul
 */
export function colorForIntensity(intensity) {
  if (!intensity || intensity <= 0) {
    const c = MUSCLE_UNTRAINED
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
  }
  let c
  if (intensity < 0.15) {
    c = lerp(MUSCLE_UNTRAINED, MUSCLE_RESTED, intensity / 0.15)
  } else {
    c = lerp(MUSCLE_RESTED, MUSCLE_TRAINED, (intensity - 0.15) / 0.85)
  }
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}
