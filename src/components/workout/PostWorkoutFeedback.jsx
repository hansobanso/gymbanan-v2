import { exWord, minWord } from '../../lib/plural.js'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import MuscleMap from '../shared/MuscleMap'
import { SetSummary } from '../history/WorkoutCard'
import { colorForIntensityRed } from '../../lib/muscleColor'
import { displayWeightStr, displayWeight } from '../../lib/weightUtils'
import styles from './PostWorkoutFeedback.module.css'

function calcStats(exercises) {
  let sets = 0, volume = 0, exCount = 0
  for (const ex of exercises) {
    const work = ex.sets.filter(s => s.type === 'work' && s.done)
    if (work.length === 0) continue
    exCount++
    sets += work.length
    volume += work.reduce((s, w) => s + (parseFloat(w.weight) || 0) * (parseInt(w.reps) || 0), 0)
  }
  return { sets, volume, exCount }
}

// Raknar upp fran 0 till target pa ca 0,7 s (ease-out).
function useCountUp(target, delayMs = 250, durationMs = 700) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || !target) { setValue(target); return }
    let raf, start
    const tick = now => {
      if (start == null) start = now + delayMs
      const t = Math.min(1, Math.max(0, (now - start) / durationMs))
      setValue(target * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, delayMs, durationMs])
  return value
}

function Stat({ value, label, format = v => String(Math.round(v)) }) {
  const shown = useCountUp(value)
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{format(shown)}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

function fmtVolume(kg) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1).replace('.', ',')} t`
  return `${Math.round(kg)} kg`
}

const Trophy = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 22h16"/>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
  </svg>
)

export default function PostWorkoutFeedback({
  sessionName, exercises, onDone, equipmentMap = {}, durationMin = null, prs = [],
  muscleWorkout = null, exerciseMap = null,
}) {
  const { sets, volume, exCount } = calcStats(exercises)
  const done = exercises.filter(ex => ex.sets.some(s => s.type === 'work' && s.done))

  // Dagens personbasta: PB-set (samma regel som i passet) + ovningar dar
  // beraknat 1RM ar hogre an nagonsin men inget enskilt set flaggades.
  const pbRows = []
  for (const ex of done) {
    for (const s of ex.sets) {
      if (!s.done || !s.isPB) continue
      const w = parseFloat(s.weight) || 0
      pbRows.push({
        key: `${ex.localId}-${s.id}`,
        name: ex.name,
        value: w > 0 ? `${displayWeightStr(s.weight, equipmentMap[ex.name])} kg × ${s.reps}` : `${s.reps} reps`,
      })
    }
  }
  const pbNames = new Set(pbRows.map(r => r.name))
  for (const pr of prs) {
    if (pbNames.has(pr.name)) continue
    pbRows.push({
      key: `1rm-${pr.name}`,
      name: pr.name,
      value: `1RM ~${Math.round(displayWeight(pr.value, equipmentMap[pr.name]))} kg`,
    })
  }

  return (
    <motion.div
      className={styles.screen}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div className={styles.hero}>
        <span className={styles.heroIcon}><Trophy /></span>
        <span className={styles.eyebrow}>{sessionName}</span>
        <h2 className={styles.heroTitle}>Pass klart!</h2>
      </div>

      <div className={styles.stats}>
        {durationMin != null && <Stat value={durationMin} label={minWord(durationMin)} />}
        <Stat value={exCount} label={exWord(exCount)} />
        <Stat value={sets} label="set" />
        <Stat value={volume} label="lyft totalt" format={fmtVolume} />
      </div>

      {pbRows.length > 0 && (
        <section className={styles.pbCard}>
          <div className={styles.pbHeader}>
            <span className={styles.pbBadge}>PB</span>
            <span className={styles.pbTitle}>
              {pbRows.length === 1 ? 'Ett nytt personbästa' : `${pbRows.length} nya personbästa`}
            </span>
          </div>
          {pbRows.map((r, i) => (
            <div key={r.key} className={styles.pbRow} style={{ animationDelay: `${0.35 + i * 0.07}s` }}>
              <span className={styles.pbName}>{r.name}</span>
              <span className={styles.pbValue}>{r.value}</span>
            </div>
          ))}
        </section>
      )}

      {muscleWorkout && done.length > 0 && (
        <section className={styles.section}>
          <span className={styles.label}>Det här tränade du</span>
          <div className={styles.figure}>
            <MuscleMap workouts={muscleWorkout} exerciseMap={exerciseMap} colorFn={colorForIntensityRed} sensitivity={6} size={120} />
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section className={styles.section}>
          <span className={styles.label}>Övningar</span>
          <div className={styles.exerciseList}>
            {done.map(ex => (
              <div key={ex.localId} className={styles.exRow}>
                <span className={styles.exName}>{ex.name}</span>
                <span className={styles.exMeta}>
                  <SetSummary
                    sets={ex.sets.filter(s => s.type === 'work' && s.done)}
                    equipment={equipmentMap[ex.name]}
                    className={styles.pbSet}
                  />
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className={styles.footer}>
        <button className={styles.doneBtn} onClick={onDone} type="button">
          Klar
        </button>
      </div>
    </motion.div>
  )
}
