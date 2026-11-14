import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { weekReport, fmtMinutes } from '../../lib/homeStats'
import { getExercises } from '../../lib/db'
import { displayWeightStr } from '../../lib/weightUtils'
import MuscleMap from '../shared/MuscleMap'
import { colorForIntensityRed } from '../../lib/muscleColor'
import day from './DaySheet.module.css'
import styles from './WeekSheet.module.css'

const DAYS = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag']

/**
 * Veckorapport: vad som blev gjort en vecka. week = { week, workouts, isCurrent }.
 * Utan exerciseMap hamtar arket ovningsbiblioteket sjalvt (cachat).
 */
export default function WeekSheet({ week, exerciseMap: givenMap, onClose }) {
  const [ownMap, setOwnMap] = useState(null)
  useEffect(() => {
    if (!week || givenMap || ownMap) return
    let alive = true
    getExercises().then(list => {
      if (!alive) return
      const m = {}
      for (const e of list ?? []) m[e.name] = e
      setOwnMap(m)
    }).catch(() => {})
    return () => { alive = false }
  }, [week, givenMap, ownMap])
  const exerciseMap = givenMap ?? ownMap ?? {}
  const r = week ? weekReport(week.workouts, exerciseMap) : null

  return (
    <AnimatePresence>
      {week && r && (
        <>
          <motion.div className={day.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className={day.sheet}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            role="dialog"
            aria-label={`Veckorapport vecka ${week.week}`}
          >
            <div className={day.handle} />
            <div className={day.header}>
              <span className={day.eyebrow}>{week.isCurrent ? 'Veckan hittills' : 'Veckorapport'}</span>
              <button className={day.closeBtn} onClick={onClose} type="button" aria-label="Stäng">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className={day.body}>
              <h2 className={day.title}>Vecka {week.week}</h2>

              {r.count === 0 ? (
                <p className={styles.empty}>
                  {week.isCurrent ? 'Inga pass än den här veckan. Den börjar när du gör det.' : 'Inga pass den här veckan.'}
                </p>
              ) : (
                <>
                  <div className={styles.stats}>
                    <div className={styles.stat}><span className={styles.num}>{r.count}</span><span className={styles.unit}>pass</span></div>
                    <div className={styles.stat}><span className={styles.num}>{fmtMinutes(r.minutes) ?? '0 min'}</span><span className={styles.unit}>tid</span></div>
                    <div className={styles.stat}><span className={styles.num}>{r.sets}</span><span className={styles.unit}>set</span></div>
                    <div className={styles.stat}><span className={`${styles.num} ${r.pbs.length ? styles.numPb : ''}`}>{r.pbs.length}</span><span className={styles.unit}>PB</span></div>
                  </div>

                  {r.groups.length > 0 && (
                    <>
                      <span className={styles.label}>Tränade muskler</span>
                      <div className={styles.muscles}>
                        <MuscleMap workouts={r.workouts} exerciseMap={exerciseMap} colorFn={colorForIntensityRed} sensitivity={10} size={92} />
                        <div className={styles.groupList}>
                          {r.groups.map(g => (
                            <div key={g.group} className={styles.groupRow}>
                              <span>{g.group}</span>
                              <span className={styles.groupSets}>{g.sets} set</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {r.rested.length > 0 && (
                        <p className={styles.rested}>Fick vila: {r.rested.join(', ')}</p>
                      )}
                    </>
                  )}

                  {r.pbs.length > 0 && (
                    <>
                      <span className={styles.label}>Nya PB</span>
                      <div className={styles.rows}>
                        {r.pbs.map(pb => (
                          <div key={pb.name} className={styles.row}>
                            <span className={styles.rowName}>{pb.name}</span>
                            <span className={styles.pb}>
                              {pb.weight > 0 ? `${displayWeightStr(pb.weight, exerciseMap[pb.name]?.equipment)} kg × ${pb.reps}` : `${pb.reps} reps`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <span className={styles.label}>Passen</span>
                  <div className={styles.rows}>
                    {r.workouts.map((w, i) => (
                      <div key={w.id ?? i} className={styles.row}>
                        <span className={styles.rowName}>{w.session_name ?? 'Pass'}</span>
                        <span className={styles.rowMeta}>
                          {[DAYS[new Date(w.finished_at).getDay()], fmtMinutes(Math.round((new Date(w.finished_at) - new Date(w.started_at)) / 60000))].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
