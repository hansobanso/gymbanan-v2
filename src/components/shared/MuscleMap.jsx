/**
 * MuscleMap - muskelgubbe (framsida + baksida) dar muskelgrupper lyser
 * upp baserat pa volym/intensitet.
 *
 * Anvander den nya MuscleFigure-komponenten med 18 muskelgrupper.
 *
 * Acceptable input (en av tre):
 *   breakdown:    [{ muscle, sets }]            - for ProgramEdit/Admin
 *   workouts:     [{ exercises: [...] }]        - for HomeScreen (7d-vag)
 *   intensities:  { Brost: 0.7, Lats: 1, ... }  - direkt 0-1 (ExerciseDetail)
 *
 * Andra props:
 *   size: figur-bredd i px (default 60). Total svg-bredd ar size*2.
 */

import { EXERCISES } from '../../data/exercises'
import MuscleFigure from '../MuscleFigure'
import { colorForIntensity } from '../../lib/muscleColor'

// Bakåtkompabilitet: gamla muscle_group "Axlar" och "Rygg" mappas till
// subdivisionerna sa volymen visas korrekt aven for gamla pass/program.
const LEGACY_FALLBACK = {
  'Axlar': ['Främre axel', 'Mellersta axel', 'Bakre axel'],
  'Rygg': ['Lats', 'Övre rygg', 'Ländrygg'],
}

// Gamla/omdopta ovningsnamn som inte langre matchar biblioteket. Mappar till
// ett aktuellt biblioteksnamn sa muskelgubben hittar ratt muskler (primar +
// sekundar) aven for gamla loggade pass.
const EXERCISE_ALIASES = {
  'Benböjning sittande': 'Benspark',
  'Benextension': 'Benspark',
  'DB sidolyft': 'Sidolyft med hantlar',
  'Lat-nedragning': 'Latsdrag med smalt neutralt grepp',
  'Lutande hantel press bort': 'Uppåtlutande hantelpress',
  'Pullups nära neutral': 'Pullups',
}

function intensityFromSets(sets) {
  if (!sets || sets <= 0) return 0
  return Math.min(1, sets / 12)
}

// Sekundarmuskler bidrar mindre an primarmuskeln (de jobbar med, men ar
// inte huvudfokus). 0.5 = halva set-poangen jamfort med primarmuskeln.
const SECONDARY_FACTOR = 0.5

// Effort per set utifran RIR (reps in reserve): nara failure = mer
// stimulans. Utan loggat RIR raknas setet som 1.0.
function setEffort(st) {
  const r = st?.rir == null || st.rir === '' ? NaN : Number(st.rir)
  if (Number.isNaN(r)) return 1
  if (r <= 0) return 1.3
  if (r === 1) return 1.15
  if (r === 2) return 1.0
  if (r === 3) return 0.85
  return 0.7
}

function intensitiesFromWorkouts(workouts, exerciseMap) {
  const scores = {}
  const now = Date.now()

  // Lagg till poang for en muskel (sprider till subdivisioner vid legacy)
  function addScore(muscle, amount) {
    const targets = LEGACY_FALLBACK[muscle] ?? [muscle]
    const per = amount / targets.length
    for (const t of targets) scores[t] = (scores[t] ?? 0) + per
  }

  for (const w of workouts ?? []) {
    const finishedAt = w.finished_at ? new Date(w.finished_at).getTime() : now
    const ageDays = (now - finishedAt) / 86_400_000
    if (ageDays > 7) continue
    const decay = Math.max(0, 1 - ageDays / 7)
    for (const ex of w.exercises ?? []) {
      // Slå upp ovningen i biblioteket. Om namnet inte finns (gammalt/omdopt),
      // prova ett alias som pekar pa ett aktuellt biblioteksnamn.
      const aliasName = EXERCISE_ALIASES[ex.name]
      const fromLib = exerciseMap?.[ex.name] ?? (aliasName ? exerciseMap?.[aliasName] : null)
      const mg = ex.muscle_group ?? fromLib?.muscle_group ?? EXERCISES[ex.name]?.muscle_group ?? (aliasName ? EXERCISES[aliasName]?.muscle_group : null)
      const workSets = (ex.sets ?? []).filter(
        s => s.done && s.type !== 'warmup' && s.type !== 'backoff'
      )
      if (workSets.length === 0) continue
      // Effortviktning: ett set nara failure (lag RIR) ger mer stimulans
      // an ett latt set - vikta darfor per set istallet for att bara rakna.
      const baseScore = workSets.reduce((sum, st) => sum + setEffort(st), 0) * decay

      // Primarmuskel - full poang
      if (mg) addScore(mg, baseScore)

      // Sekundarmuskler - reducerad poang. Hamta fran loggen forst,
      // annars fran biblioteket (samma prioritetstanke som primar).
      const secondary = (Array.isArray(ex.secondary_muscles) && ex.secondary_muscles.length
        ? ex.secondary_muscles
        : fromLib?.secondary_muscles) ?? []
      for (const sm of secondary) {
        if (sm && sm !== mg) addScore(sm, baseScore * SECONDARY_FACTOR)
      }
    }
  }
  const out = {}
  // Mattnadskurva istallet for linjar skala: de forsta harda seten ger
  // mest stimulans, sen mattas det av. ~2 harda set -> tydligt gulnande,
  // 4-5 harda set -> full gul (mot tidigare 8 set for full gul).
  for (const [m, s] of Object.entries(scores)) {
    out[m] = Math.min(1, (1 - Math.exp(-s / 3)) / 0.85)
  }
  return out
}

function resolveIntensities({ breakdown, workouts, intensities, exerciseMap }) {
  if (intensities) return intensities
  if (workouts) return intensitiesFromWorkouts(workouts, exerciseMap)
  if (breakdown) {
    const out = {}
    for (const { muscle, sets } of breakdown) {
      const targets = LEGACY_FALLBACK[muscle] ?? [muscle]
      const share = intensityFromSets(sets) / targets.length
      for (const t of targets) {
        out[t] = (out[t] ?? 0) + share
      }
    }
    return out
  }
  return {}
}

// Muskelfargning delegeras till lib/muscleColor.js (skogsgron palett).
const colorFor = colorForIntensity

export default function MuscleMap({ breakdown, workouts, intensities: customIntensities, exerciseMap, size = 60 }) {
  const intensities = resolveIntensities({
    breakdown,
    workouts,
    intensities: customIntensities,
    exerciseMap,
  })

  // Bygg colors-objekt for MuscleFigure
  const colors = {}
  for (const [muscle, intensity] of Object.entries(intensities)) {
    colors[muscle] = colorFor(intensity)
  }

  // size = ungefarlig bredd per figur. SVG har viewBox 800x750 (front + back i samma).
  const totalWidth = size * 2

  return (
    <MuscleFigure
      colors={colors}
      style={{ width: totalWidth, height: 'auto', display: 'block' }}
    />
  )
}
