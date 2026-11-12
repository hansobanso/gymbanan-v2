import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getPreviousSetsForExercise } from '../../lib/db'
import { displayWeightStr } from '../../lib/weightUtils'
import styles from './SessionPreview.module.css'

// Forra passets arbetsset pa en rad: "22 kg × 8 · 8 · 9" nar vikten ar
// densamma, annars "22 × 8 · 24 × 6". (Dagens forslag raknas forst nar
// passet startar, sa har visas det som faktiskt gjordes sist.)
function fmtPrev(prevSets) {
  const work = (prevSets ?? []).filter(s => s.type === 'work' && s.subtype !== 'backoff' && parseInt(s.reps) > 0)
  if (work.length === 0) return null
  const weights = work.map(s => parseFloat(s.weight) || 0)
  if (weights.every(w => w === weights[0])) {
    const reps = work.map(s => s.reps).join(' · ')
    return weights[0] > 0 ? `${displayWeightStr(work[0].weight)} kg × ${reps}` : `${reps} reps`
  }
  return work.map((s, i) => weights[i] > 0 ? `${displayWeightStr(s.weight)} × ${s.reps}` : `${s.reps}`).join(' · ')
}

export default function SessionPreview({ open, session, userId, onStart, onClose }) {
  const [prevByName, setPrevByName] = useState({}) // { exerciseName: prevSets }
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !session || !userId) return
    let cancelled = false
    setLoading(true)
    const exercises = session.exercises ?? []
    Promise.all(
      exercises.map(ex =>
        getPreviousSetsForExercise(userId, ex.name).then(prevSets => [ex.name, prevSets])
      )
    ).then(results => {
      if (cancelled) return
      setPrevByName(Object.fromEntries(results))
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [open, session, userId])

  if (!session) return null

  const exercises = session.exercises ?? []
  const totalSets = exercises.reduce((sum, ex) => sum + (Number(ex.workSets) || 0), 0)

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
            role="dialog"
            aria-label={session.name}
          >
            <div className={styles.handle} />

            <div className={styles.header}>
              <div className={styles.headText}>
                <h2 className={styles.title}>{session.name}</h2>
                <p className={styles.subtitle}>{exercises.length} övningar · {totalSets} set</p>
              </div>
              <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Stäng">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className={styles.body}>
              {exercises.length === 0 && (
                <p className={styles.emptyText}>Inga övningar i passet</p>
              )}

              {exercises.map((ex, idx) => {
                const prev = fmtPrev(prevByName[ex.name])
                const plan = ex.repsMin != null && ex.repsMax != null
                  ? `${ex.workSets} × ${ex.repsMin}–${ex.repsMax}`
                  : `${ex.workSets} set`
                const extras = [
                  ex.warmupSets > 0 ? `${ex.warmupSets} uppvärmning` : null,
                  ex.backoffSets > 0 ? `${ex.backoffSets} backoff` : null,
                ].filter(Boolean).join(' · ')
                return (
                  <div key={idx} className={styles.exRow}>
                    <div className={styles.exHeader}>
                      <span className={styles.exName}>{ex.name}</span>
                      <span className={styles.exPlan}>{plan}</span>
                    </div>
                    <div className={styles.exMeta}>
                      {loading && !(ex.name in prevByName)
                        ? 'Hämtar historik…'
                        : prev ? <>Förra: <span className={styles.exPrev}>{prev}</span></> : 'Första gången'}
                      {extras && ` · ${extras}`}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className={styles.footer}>
              <button className={styles.startBtn} onClick={onStart} type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"/></svg>
                Starta {session.name}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
