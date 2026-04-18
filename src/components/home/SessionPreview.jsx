import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getPreviousSetsForExercise } from '../../lib/db'
import { displayWeightStr } from '../../lib/weightUtils'
import styles from './SessionPreview.module.css'

// Mirrors the progression logic in useWorkout.js (calcProgression)
function calcProgression(prevW, prevR, repsMin, repsMax) {
  if (!prevW || !prevR) return { targetW: prevW || 0, targetR: prevR || 0 }
  if (repsMin != null && repsMax != null && prevR >= repsMax) {
    const targetW = Math.round((prevW + 2.5) * 2) / 2
    return { targetW, targetR: repsMin, promoted: true }
  }
  const targetR = repsMax != null ? Math.min(prevR + 1, repsMax) : prevR + 1
  return { targetW: prevW, targetR }
}

export default function SessionPreview({ open, session, userId, onStart, onClose }) {
  const [exerciseData, setExerciseData] = useState({}) // { exerciseName: { prevSets, targets } }
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !session || !userId) return
    let cancelled = false
    setLoading(true)
    const exercises = session.exercises ?? []
    Promise.all(
      exercises.map(ex =>
        getPreviousSetsForExercise(userId, ex.name).then(prevSets => ({
          name: ex.name,
          prevSets,
          repsMin: ex.repsMin ?? null,
          repsMax: ex.repsMax ?? null,
          workSets: ex.workSets ?? 0,
          warmupSets: ex.warmupSets ?? 0,
          backoffSets: ex.backoffSets ?? 0,
        }))
      )
    ).then(results => {
      if (cancelled) return
      const data = {}
      for (const r of results) {
        // Compute per-set targets based on previous session's sets
        const prevWork = (r.prevSets ?? []).filter(s => s.type === 'work' && s.subtype !== 'backoff')
        const targets = []
        for (let i = 0; i < r.workSets; i++) {
          const prevSet = prevWork[i]
          if (prevSet) {
            const prevW = parseFloat(prevSet.weight) || 0
            const prevR = parseInt(prevSet.reps) || 0
            const { targetW, targetR } = calcProgression(prevW, prevR, r.repsMin, r.repsMax)
            targets.push({ weight: targetW, reps: targetR })
          } else {
            targets.push(null) // no history for this set
          }
        }
        data[r.name] = {
          prevSets: r.prevSets,
          targets,
          repsMin: r.repsMin,
          repsMax: r.repsMax,
          workSets: r.workSets,
          warmupSets: r.warmupSets,
          backoffSets: r.backoffSets,
        }
      }
      setExerciseData(data)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [open, session, userId])

  if (!session) return null

  const exercises = session.exercises ?? []

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
              <h2 className={styles.title}>{session.name}</h2>
              <p className={styles.subtitle}>
                {exercises.length} övningar
              </p>
            </div>

            <div className={styles.body}>
              {loading && exercises.length > 0 && (
                <p className={styles.loadingText}>Hämtar historik…</p>
              )}

              {!loading && exercises.length === 0 && (
                <p className={styles.emptyText}>Inga övningar i passet</p>
              )}

              {exercises.map((ex, idx) => {
                const data = exerciseData[ex.name]
                const rangeStr = ex.repsMin != null && ex.repsMax != null
                  ? `${ex.repsMin}–${ex.repsMax}`
                  : null
                return (
                  <div key={idx} className={styles.exRow}>
                    <div className={styles.exHeader}>
                      <span className={styles.exName}>{ex.name}</span>
                      {rangeStr && <span className={styles.exRange}>{rangeStr}</span>}
                    </div>
                    <div className={styles.exMeta}>
                      {ex.warmupSets > 0 && (
                        <span className={styles.metaChip}>{ex.warmupSets} värm</span>
                      )}
                      <span className={styles.metaChip}>{ex.workSets} set</span>
                      {ex.backoffSets > 0 && (
                        <span className={styles.metaChip}>{ex.backoffSets} back-off</span>
                      )}
                    </div>
                    {data?.targets && data.targets.some(t => t != null) && (
                      <div className={styles.setsList}>
                        {data.targets.map((t, i) => (
                          <div key={i} className={styles.setLine}>
                            <span className={styles.setLabel}>S{i + 1}</span>
                            {t ? (
                              <span className={styles.setValue}>
                                {t.weight > 0
                                  ? `${displayWeightStr(t.weight)} kg × ${t.reps} reps`
                                  : `${t.reps} reps`}
                              </span>
                            ) : (
                              <span className={styles.setValueEmpty}>— ingen tidigare data —</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {data && (!data.targets || data.targets.every(t => t == null)) && (
                      <p className={styles.noHistory}>Första gången — inga tidigare vikter</p>
                    )}
                  </div>
                )
              })}
            </div>

            <div className={styles.footer}>
              <button
                className={styles.startBtn}
                onClick={onStart}
                type="button"
              >
                Starta pass
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
