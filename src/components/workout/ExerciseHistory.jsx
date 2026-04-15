import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getWorkouts } from '../../lib/db'
import styles from './ExerciseHistory.module.css'

function relativeDate(iso) {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d) / 86_400_000)
  if (diffDays === 0) return 'Idag'
  if (diffDays === 1) return 'Igår'
  if (diffDays < 7) return `${diffDays} dagar sedan`
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

export default function ExerciseHistory({ open, exerciseName, userId, onClose }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !exerciseName || !userId) return
    setLoading(true)
    getWorkouts(userId, 50)
      .then(workouts => {
        const entries = []
        for (const w of workouts) {
          const match = (w.exercises ?? []).find(
            e => e.name?.toLowerCase() === exerciseName.toLowerCase()
          )
          if (!match) continue
          const workSets = (match.sets ?? []).filter(s => s.type === 'work' && s.done)
          if (workSets.length === 0) continue
          entries.push({ date: w.finished_at, sets: workSets })
        }
        setHistory(entries)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, exerciseName, userId])

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
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.handle} />
            <div className={styles.header}>
              <div>
                <p className={styles.title}>{exerciseName}</p>
                <p className={styles.subtitle}>Historik</p>
              </div>
              <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Stäng">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className={styles.list}>
              {loading && <p className={styles.empty}>Laddar…</p>}
              {!loading && history.length === 0 && (
                <p className={styles.empty}>Inga tidigare set med {exerciseName}</p>
              )}
              {!loading && history.map((entry, i) => (
                <div key={i} className={styles.entry}>
                  <div className={styles.entryDate}>{relativeDate(entry.date)}</div>
                  <div className={styles.sets}>
                    {entry.sets.map((s, j) => (
                      <div key={j} className={styles.setRow}>
                        <span className={styles.setLabel}>Set {j + 1}</span>
                        <span className={styles.setVal}>{s.weight || '–'} kg</span>
                        <span className={styles.setVal}>× {s.reps || '–'}</span>
                        {s.rir !== null && s.rir !== undefined && (
                          <span className={styles.setRir}>RIR {s.rir}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
