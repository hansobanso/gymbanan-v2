/**
 * Liten stiliserad muskelkarta - en framsida-figur dar muskelgrupper
 * lyser upp baserat pa volym (set/vecka). Dim = ej tranat, glow = mer set.
 *
 * breakdown: array of { muscle: string, sets: number }
 */

const MUSCLE_PATHS = {
  // Bröst
  Bröst: 'M 32 24 Q 32 26 35 28 L 35 32 Q 36 35 39 35 L 41 35 Q 44 35 45 32 L 45 28 Q 48 26 48 24 Q 48 22 45 22 L 35 22 Q 32 22 32 24 Z',
  // Axlar (delade i två - vänster + höger)
  Axlar: 'M 28 23 Q 26 22 25 25 L 25 28 Q 26 30 28 30 L 30 30 L 30 24 Z M 50 24 L 50 30 L 52 30 Q 54 30 55 28 L 55 25 Q 54 22 52 23 Z',
  // Biceps
  Biceps: 'M 27 31 Q 25 31 24 33 L 24 38 Q 25 40 27 40 L 28 40 L 28 31 Z M 52 31 L 52 40 L 53 40 Q 55 40 56 38 L 56 33 Q 55 31 53 31 Z',
  // Triceps (visas på framsidan kring biceps också)
  Triceps: 'M 27 31 Q 25 31 24 33 L 24 38 Q 25 40 27 40 L 28 40 L 28 31 Z M 52 31 L 52 40 L 53 40 Q 55 40 56 38 L 56 33 Q 55 31 53 31 Z',
  // Underarmar
  Underarmar: 'M 24 41 Q 23 41 22 43 L 22 50 Q 23 52 25 52 L 26 52 L 26 41 Z M 54 41 L 54 52 L 55 52 Q 57 52 58 50 L 58 43 Q 57 41 56 41 Z',
  // Mage/Core
  Core: 'M 35 36 Q 35 38 36 40 L 36 50 Q 36 52 40 52 L 40 36 Z M 40 36 L 40 52 Q 44 52 44 50 L 44 40 Q 45 38 45 36 Z',
  // Quads
  Quads: 'M 33 53 Q 32 54 32 56 L 32 70 Q 33 72 36 72 L 39 72 L 39 53 Z M 41 53 L 41 72 L 44 72 Q 47 72 48 70 L 48 56 Q 48 54 47 53 Z',
  // Hamstrings (samma plats men "back")
  Hamstrings: 'M 33 53 Q 32 54 32 56 L 32 70 Q 33 72 36 72 L 39 72 L 39 53 Z M 41 53 L 41 72 L 44 72 Q 47 72 48 70 L 48 56 Q 48 54 47 53 Z',
  // Vader
  Vader: 'M 34 73 Q 33 74 33 75 L 33 84 Q 34 86 36 86 L 39 86 L 39 73 Z M 41 73 L 41 86 L 44 86 Q 46 86 47 84 L 47 75 Q 47 74 46 73 Z',
  // Rygg (visas som baksida-skugga av brost-omradet)
  Rygg: 'M 30 23 Q 28 23 27 26 L 27 36 Q 28 39 32 40 L 35 40 L 35 23 Z M 45 23 L 45 40 L 48 40 Q 52 39 53 36 L 53 26 Q 52 23 50 23 Z',
  // Rumpa
  Rumpa: 'M 33 48 Q 32 50 33 53 L 38 53 Q 40 53 40 51 L 40 48 Z M 40 48 L 40 51 Q 40 53 42 53 L 47 53 Q 48 50 47 48 Z',
}

// Hitta intensitet 0-1 baserat pa set-antalet (0 set = 0, 15+ set = 1)
function intensity(sets) {
  if (!sets || sets <= 0) return 0
  return Math.min(1, sets / 15)
}

// Bygg en lookup map { muscle: sets }
function toMap(breakdown) {
  const map = {}
  for (const { muscle, sets } of breakdown ?? []) map[muscle] = sets
  return map
}

export default function MuscleMap({ breakdown, size = 60 }) {
  const map = toMap(breakdown)
  const muscleColor = (muscle) => {
    const i = intensity(map[muscle])
    if (i === 0) return '#1f1f1f'
    // Gul med varierande opacitet (24% -> 100%)
    const alpha = 0.24 + i * 0.76
    return `rgba(245, 208, 32, ${alpha})`
  }

  return (
    <svg width={size} height={size * (96 / 80)} viewBox="0 0 80 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Kropp-silhouette (mycket stiliserad, inte anatomiskt korrekt) */}
      <g fill="#0e0e0e" stroke="#2a2a2a" strokeWidth="0.4">
        {/* Huvud */}
        <circle cx="40" cy="10" r="6" />
        {/* Hals */}
        <rect x="37.5" y="14" width="5" height="6" rx="1.5" />
        {/* Torso */}
        <path d="M 27 22 Q 25 22 24 25 L 22 42 Q 22 50 25 52 L 33 52 L 33 53 Q 32 54 32 56 L 32 70 Q 33 72 36 72 L 39 72 L 41 72 L 44 72 Q 47 72 48 70 L 48 56 Q 48 54 47 53 L 47 52 L 55 52 Q 58 50 58 42 L 56 25 Q 55 22 53 22 Z" />
        {/* Armar (overarm) */}
        <path d="M 24 28 Q 22 28 22 30 L 22 50 Q 23 52 25 52 L 27 52 L 27 28 Z" />
        <path d="M 53 28 L 53 52 L 55 52 Q 57 52 58 50 L 58 30 Q 58 28 56 28 Z" />
        {/* Vader */}
        <path d="M 33 72 L 33 86 Q 34 88 37 88 L 40 88 L 40 72 Z" />
        <path d="M 40 72 L 40 88 L 43 88 Q 46 88 47 86 L 47 72 Z" />
      </g>

      {/* Muskelhighlights - lyser upp baserat pa volym */}
      <g>
        {/* Brost */}
        <path d={MUSCLE_PATHS.Bröst} fill={muscleColor('Bröst')} />
        {/* Axlar */}
        <path d={MUSCLE_PATHS.Axlar} fill={muscleColor('Axlar')} />
        {/* Biceps + Triceps overlap */}
        <path d={MUSCLE_PATHS.Biceps} fill={muscleColor('Biceps')} opacity={map.Biceps >= map.Triceps ? 1 : 0.5} />
        {map.Triceps > 0 && map.Triceps > (map.Biceps ?? 0) && (
          <path d={MUSCLE_PATHS.Triceps} fill={muscleColor('Triceps')} />
        )}
        {/* Underarmar */}
        <path d={MUSCLE_PATHS.Underarmar} fill={muscleColor('Underarmar')} />
        {/* Core */}
        <path d={MUSCLE_PATHS.Core} fill={muscleColor('Core')} />
        {/* Quads */}
        <path d={MUSCLE_PATHS.Quads} fill={muscleColor('Quads')} />
        {/* Vader */}
        <path d={MUSCLE_PATHS.Vader} fill={muscleColor('Vader')} />
        {/* Rygg som overlay i samma omrade som brost (mindre opacity, sa det syns nar bara rygg) */}
        {(map.Rygg ?? 0) > 0 && !map.Bröst && (
          <path d={MUSCLE_PATHS.Rygg} fill={muscleColor('Rygg')} opacity="0.7" />
        )}
        {/* Rumpa */}
        {(map.Rumpa ?? 0) > 0 && (
          <path d={MUSCLE_PATHS.Rumpa} fill={muscleColor('Rumpa')} />
        )}
        {/* Hamstrings overlay om mer an quads */}
        {(map.Hamstrings ?? 0) > (map.Quads ?? 0) && (
          <path d={MUSCLE_PATHS.Hamstrings} fill={muscleColor('Hamstrings')} opacity="0.85" />
        )}
      </g>
    </svg>
  )
}
