import { AnimatePresence, motion } from 'framer-motion'
import { SetSummary } from '../history/WorkoutCard'
import { workoutMinutes, pbCount, fmtMinutes } from '../../lib/homeStats'
import styles from './DaySheet.module.css'

const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']

/** Passet (eller passen) fran en dag i veckoremsan. */
export default function DaySheet({ day, exerciseMap, onClose }) {
  return (
    <AnimatePresence>
      {day && (
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
            aria-label={`Pass ${day.name} ${day.date.getDate()} ${MONTHS[day.date.getMonth()]}`}
          >
            <div className={styles.handle} />
            <div className={styles.header}>
              <span className={styles.eyebrow}>
                {day.name} {day.date.getDate()} {MONTHS[day.date.getMonth()]}
              </span>
              <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Stäng">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className={styles.body}>
              {day.workouts.map((w, wi) => {
                const exercises = (w.exercises ?? []).filter(ex => ex.sets?.some(s => s.type === 'work' && s.done))
                const sets = exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.type === 'work' && s.done).length, 0)
                const pbs = pbCount(w)
                const meta = [
                  w.adjusted ? 'Anpassat pass' : null,
                  fmtMinutes(workoutMinutes(w)),
                  `${exercises.length} övningar`,
                  `${sets} set`,
                ].filter(Boolean).join(' · ')
                return (
                  <section key={w.id ?? wi} className={styles.workout}>
                    <div className={styles.titleRow}>
                      <h2 className={styles.title}>{w.session_name ?? 'Pass'}</h2>
                      {pbs > 0 && <span className={styles.pbBadge}>{pbs} PB</span>}
                    </div>
                    <p className={`${styles.meta} ${w.adjusted ? styles.metaAdjusted : ''}`}>{meta}</p>
                    <div className={styles.rows}>
                      {exercises.map((ex, i) => (
                        <div key={`${ex.name}-${i}`} className={styles.exRow}>
                          <span className={styles.exName}>{ex.name}</span>
                          <span className={styles.exSets}>
                            <SetSummary
                              sets={ex.sets.filter(s => s.type === 'work' && s.done)}
                              equipment={exerciseMap?.[ex.name]?.equipment}
                              className={styles.pbSet}
                            />
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
