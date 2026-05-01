import { useMemo, useState } from 'react'
import { EXERCISES } from '../../data/exercises'
import styles from './MuscleSetSummary.module.css'

// ── Volume calculation ─────────────────────────────────────────
// Beräknar effektiv volym per muskelgrupp baserat på övningarnas
// primary/secondary muscles. Primär = 1 set, sekundär = 0.5 set.
//
// Tar in en lista av `exercises` (en session) ELLER en lista av sessions.
// När `multiSession` = true tolkas första argumentet som array av sessions.
export function computeMuscleSets(exercises, allExercises) {
  const lookupBy = {}
  for (const ex of allExercises ?? []) lookupBy[ex.name] = ex
  const totals = {}
  for (const ex of exercises) {
    const sets = (ex.workSets ?? 3) + (ex.backoffSets ?? 0)
    if (sets <= 0) continue
    const data = lookupBy[ex.name] ?? EXERCISES[ex.name] ?? {}
    const primary = data.muscle_group
    const secondary = data.secondary_muscle
    if (primary) totals[primary] = (totals[primary] ?? 0) + sets
    if (secondary && secondary !== primary) {
      totals[secondary] = (totals[secondary] ?? 0) + sets * 0.5
    }
  }
  return Object.entries(totals)
    .map(([muscle, sets]) => ({ muscle, sets: Math.round(sets * 10) / 10 }))
    .sort((a, b) => b.sets - a.sets)
}

// Aggregera över flera sessions (ett helt program)
export function computeProgramMuscleSets(sessions, allExercises) {
  const allExs = []
  for (const s of sessions ?? []) {
    for (const ex of (s.exercises ?? [])) allExs.push(ex)
  }
  return computeMuscleSets(allExs, allExercises)
}

function fmt(sets) {
  return sets === Math.floor(sets) ? String(sets) : sets.toFixed(1)
}

// ── UI: SessionMuscleSetSummary (used in SessionEdit) ─────────
export default function MuscleSetSummary({ exercises, allExercises, label = 'Set per muskel', totalLabel = 'totalt', defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const breakdown = useMemo(() => computeMuscleSets(exercises, allExercises), [exercises, allExercises])
  if (breakdown.length === 0) return null
  const totalSets = exercises.reduce((n, ex) => n + (ex.workSets ?? 3) + (ex.backoffSets ?? 0), 0)
  return (
    <div className={styles.summary}>
      <button
        type="button"
        className={styles.headerToggle}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className={styles.label}>{label}</span>
        <span className={styles.total}>{totalSets} {totalLabel}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className={styles.list}>
          {breakdown.map(({ muscle, sets }) => (
            <div key={muscle} className={styles.row}>
              <span className={styles.name}>{muscle}</span>
              <span className={styles.count}>{fmt(sets)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── UI: ProgramMuscleSetSummary (used in ProgramEdit) ─────────
export function ProgramMuscleSetSummary({ sessions, allExercises, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const breakdown = useMemo(() => computeProgramMuscleSets(sessions, allExercises), [sessions, allExercises])
  if (breakdown.length === 0) return null
  const totalSets = (sessions ?? []).reduce(
    (n, s) => n + (s.exercises ?? []).reduce(
      (m, ex) => m + (ex.workSets ?? 3) + (ex.backoffSets ?? 0), 0
    ), 0
  )
  return (
    <div className={styles.summary}>
      <button
        type="button"
        className={styles.headerToggle}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className={styles.label}>Set per muskel · per vecka</span>
        <span className={styles.total}>{totalSets} totalt</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className={styles.list}>
          {breakdown.map(({ muscle, sets }) => (
            <div key={muscle} className={styles.row}>
              <span className={styles.name}>{muscle}</span>
              <span className={styles.count}>{fmt(sets)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
