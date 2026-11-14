import { useEffect, useState } from 'react'
import { getWorkouts } from '../../lib/db'
import { displayWeightStr } from '../../lib/weightUtils'
import { SetSummary } from './WorkoutCard'
import { BananaIcon } from '../shared/Icons'
import styles from './ExerciseHistory.module.css'

const MONTHS_SHORT = ['jan', 'feb', 'mars', 'april', 'maj', 'juni', 'juli', 'aug', 'sep', 'okt', 'nov', 'dec']
const fmtDate = d => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`

/** Passen dar ovningen korts (nyaste forst) och basta setet bland dem. */
export function exerciseSessions(name, workouts) {
  const rows = []
  for (const w of workouts ?? []) {
    if (!w.finished_at) continue
    const ex = (w.exercises ?? []).find(e => e.name === name)
    const sets = (ex?.sets ?? []).filter(s => s.done && s.type !== 'warmup')
    if (sets.length) rows.push({ id: w.id, at: new Date(w.finished_at), session: w.session_name ?? 'Pass', adjusted: !!w.adjusted, sets })
  }
  rows.sort((a, b) => b.at - a.at)
  let best = null
  for (const r of rows) {
    for (const s of r.sets) {
      const weight = parseFloat(s.weight) || 0
      const reps = parseInt(s.reps) || 0
      if (!best || weight > best.weight || (weight === best.weight && reps > best.reps)) best = { weight, reps, at: r.at }
    }
  }
  return { rows, best }
}

/** Historik-fliken pa ovningssidan: basta set och de senaste passen. */
export default function ExerciseHistory({ name, userId, equipment, onShowProgress }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    if (!userId || !name) return
    let alive = true
    getWorkouts(userId, 40).then(ws => { if (alive) setData(exerciseSessions(name, ws)) }).catch(() => { if (alive) setData({ rows: [], best: null }) })
    return () => { alive = false }
  }, [userId, name])

  if (!data) return <div className={styles.loading} aria-hidden="true" />

  if (!data.rows.length) {
    return (
      <div className={styles.empty}>
        <span className="empty-banana"><BananaIcon /></span>
        <p className={styles.emptyTitle}>Inte kört än</p>
        <p className={styles.emptyText}>När du loggat övningen i ett pass dyker den upp här.</p>
      </div>
    )
  }

  const { rows, best } = data
  return (
    <div className={styles.wrap}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.num}>
            {best.weight > 0 ? `${displayWeightStr(best.weight, equipment)} kg × ${best.reps}` : `${best.reps} reps`}
          </span>
          <span className={styles.unit}>bästa set · {fmtDate(best.at)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.num}>{rows.length}</span>
          <span className={styles.unit}>pass</span>
        </div>
      </div>

      <button className={styles.progressBtn} onClick={onShowProgress} type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m7 14 3-4 3 3 4-6"/>
        </svg>
        Visa utvecklingskurvan
      </button>

      <span className={styles.label}>Senaste passen</span>
      <div className={styles.rows}>
        {rows.map((r, i) => (
          <div key={r.id ?? i} className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowDate}>{fmtDate(r.at)}</span>
              <span className={styles.rowMeta}>{r.adjusted ? `${r.session} · anpassat` : r.session}</span>
            </div>
            <span className={styles.rowSets}>
              <SetSummary sets={r.sets} equipment={equipment} className={styles.pbSet} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
