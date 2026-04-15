import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getWorkouts } from '../../lib/db'
import styles from './ExerciseHistory.module.css'
import wStyles from './WorkoutHistorySheet.module.css'

function fmtDate(iso) {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d) / 86_400_000)
  if (diffDays === 0) return 'Idag'
  if (diffDays === 1) return 'Igår'
  if (diffDays < 7) return `${diffDays} dagar sedan`
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return null
  const mins = Math.round((new Date(finishedAt) - new Date(startedAt)) / 60_000)
  if (mins < 1) return null
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function hasContent(w) {
  const exercises = w.exercises ?? []
  if (!exercises.length) return false
  return exercises.some(ex =>
    (ex.sets ?? []).some(s => s.type === 'work' && s.done && (parseFloat(s.weight) > 0 || parseInt(s.reps) > 0))
  )
}

export default function WorkoutHistorySheet({ open, userId, onClose }) {
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !userId) return
    setLoading(true)
    getWorkouts(userId, 30)
      .then(data => { setWorkouts(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [open, userId])

  const filtered = workouts.filter(hasContent)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={styles.sheet}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className={styles.handle} />
            <div className={styles.header}>
              <div>
                <p className={styles.title}>Passhistorik</p>
                <p className={styles.subtitle}>{filtered.length} avslutade pass</p>
              </div>
              <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Stäng">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className={styles.list}>
              {loading && <p className={styles.empty}>Laddar…</p>}
              {!loading && filtered.length === 0 && (
                <p className={styles.empty}>Inga avslutade pass ännu</p>
              )}
              {filtered.map(w => {
                const exercises = w.exercises ?? []
                const duration = fmtDuration(w.started_at, w.finished_at)
                return (
                  <div key={w.id} className={styles.entry}>
                    <div className={styles.entryDate}>
                      <span>{fmtDate(w.finished_at)}</span>
                      <span className={wStyles.entryMeta}>
                        {w.session_name || 'Pass'}{duration ? ` · ${duration}` : ''}
                      </span>
                    </div>
                    <div className={wStyles.exList}>
                      {exercises.map((ex, i) => {
                        const workSets = (ex.sets ?? []).filter(
                          s => s.type === 'work' && s.done &&
                            (parseFloat(s.weight) > 0 || parseInt(s.reps) > 0)
                        )
                        if (!workSets.length) return null
                        const summary = workSets
                          .map(s => {
                            const w = parseFloat(s.weight) > 0 ? `${s.weight}kg` : null
                            const r = parseInt(s.reps) > 0 ? `×${s.reps}` : null
                            return [w, r].filter(Boolean).join('')
                          })
                          .join('  ')
                        return (
                          <div key={i} className={wStyles.exRow}>
                            <span className={wStyles.exName}>{ex.name}</span>
                            <span className={wStyles.exSets}>{summary}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
