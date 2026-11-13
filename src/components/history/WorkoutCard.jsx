import { nEx } from '../../lib/plural.js'
import { useState, useRef } from 'react'
import { workoutMinutes, pbCount, fmtMinutes } from '../../lib/homeStats'
import { AnimatePresence, motion } from 'framer-motion'
import { displayWeightStr } from '../../lib/weightUtils'
import styles from './WorkoutCard.module.css'

const DELETE_WIDTH = 80

const WEEKDAYS = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör']

function calcStats(exercises) {
  let sets = 0, exCount = 0
  for (const ex of exercises ?? []) {
    const work = (ex.sets ?? []).filter(s => s.type === 'work' && s.done)
    if (work.length === 0) continue
    exCount++
    sets += work.length
  }
  return { sets, exCount }
}

// Ett pass sets pa en rad: "22 kg × 8 · 8 · 9" nar vikten ar densamma,
// annars "22 × 8 · 24 × 6". PB-set markeras.
export function SetSummary({ sets, equipment, className }) {
  const weights = sets.map(s => parseFloat(s.weight) || 0)
  const sameWeight = weights.every(w => w === weights[0])
  const w0 = weights[0] > 0 ? displayWeightStr(sets[0].weight, equipment) : null
  const anyPb = sets.some(s => s.isPB)
  const sep = (i) => i > 0 ? ' · ' : ''
  if (sameWeight) {
    return (
      <span>
        {w0 && `${w0} kg × `}
        {sets.map((s, i) => (
          <span key={i}>{sep(i)}<span className={s.isPB ? className : undefined}>{s.reps}</span></span>
        ))}
        {!w0 && ' reps'}
        {anyPb && <span className="sr-only"> (personbästa)</span>}
      </span>
    )
  }
  return (
    <span>
      {sets.map((s, i) => (
        <span key={i}>{sep(i)}<span className={s.isPB ? className : undefined}>
          {weights[i] > 0 ? `${displayWeightStr(s.weight, equipment)} × ${s.reps}` : `${s.reps}`}
        </span></span>
      ))}
    </span>
  )
}

export default function WorkoutCard({ workout, onDelete, equipmentMap = {} }) {
  const [open, setOpen] = useState(false)
  const [swipeX, setSwipeX] = useState(0)
  const exercises = workout.exercises ?? []
  const { sets, exCount } = calcStats(exercises)
  const date = new Date(workout.started_at ?? workout.finished_at)
  const pbs = pbCount(workout)
  const meta = [
    workout.adjusted ? 'Anpassat pass' : null,
    fmtMinutes(workoutMinutes(workout)),
    nEx(exCount),
    `${sets} set`,
  ].filter(Boolean).join(' · ')

  // ── Swipe-to-delete (touch) ──
  const swipeXRef = useRef(0)
  const swipeTouchId = useRef(null)
  const swipeStartX = useRef(0)
  const swipeStartY = useRef(0)
  const swipingH = useRef(false)
  const isActivelySwipingH = useRef(false)

  function updateSwipeX(val) {
    swipeXRef.current = val
    setSwipeX(val)
  }

  function handleTouchStart(e) {
    const t = e.touches[0]
    swipeTouchId.current = t.identifier
    swipeStartX.current = t.clientX
    swipeStartY.current = t.clientY
    swipingH.current = false
    isActivelySwipingH.current = false
  }

  function handleTouchMove(e) {
    const t = Array.from(e.touches).find(t => t.identifier === swipeTouchId.current)
    if (!t) return
    const dx = t.clientX - swipeStartX.current
    const adx = Math.abs(dx)
    const ady = Math.abs(t.clientY - swipeStartY.current)
    if (!swipingH.current && adx > 8 && adx > ady * 1.2) {
      swipingH.current = true
    }
    if (swipingH.current) {
      isActivelySwipingH.current = true
      const base = swipeXRef.current === -DELETE_WIDTH ? -DELETE_WIDTH : 0
      const newX = Math.min(0, Math.max(base + dx, -DELETE_WIDTH))
      updateSwipeX(newX)
      try { e.preventDefault() } catch { /* ignored */ }
    }
  }

  function handleTouchEnd() {
    if (swipingH.current) {
      updateSwipeX(swipeXRef.current < -DELETE_WIDTH / 2 ? -DELETE_WIDTH : 0)
    }
    swipingH.current = false
    swipeTouchId.current = null
  }

  // Om kortet ar swipat: stang det istallet for att expandera vid tap.
  function handleHeaderClick() {
    if (swipeXRef.current !== 0) { updateSwipeX(0); return }
    if (isActivelySwipingH.current) { isActivelySwipingH.current = false; return }
    setOpen(v => !v)
  }

  return (
    <div className={styles.swipeWrapper}>
      {/* Ta bort-bakgrund som avslojas vid swipe */}
      <div className={styles.deleteBack} style={{ visibility: swipeX < 0 ? 'visible' : 'hidden' }}>
        <button className={styles.deleteBackBtn} onClick={() => onDelete?.(workout.id)} type="button">Ta bort</button>
      </div>
      <div
        className={`${styles.card} ${open ? styles.cardOpen : ''}`}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isActivelySwipingH.current ? 'none' : 'transform 0.2s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
      <button className={styles.header} onClick={handleHeaderClick} type="button" aria-expanded={open}>
        <span className={styles.date}>
          <span className={styles.dateDay}>{WEEKDAYS[date.getDay()]}</span>
          <span className={styles.dateNum}>{date.getDate()}</span>
        </span>
        <span className={styles.headText}>
          <span className={styles.name}>{workout.session_name ?? 'Pass'}</span>
          <span className={`${styles.meta} ${workout.adjusted ? styles.metaAdjusted : ''}`}>{meta}</span>
        </span>
        {pbs > 0 && <span className={styles.pbBadge}>{pbs} PB</span>}
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className={styles.body}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            <div className={styles.bodyInner}>
              {exercises.filter(ex => ex.sets?.some(s => s.type === 'work' && s.done)).map((ex, i) => {
                const work = ex.sets.filter(s => s.type === 'work' && s.done)
                return (
                  <div key={ex.localId ?? `${ex.name}-${i}`} className={styles.exRow}>
                    <span className={styles.exName}>{ex.name}</span>
                    <span className={styles.exSets}>
                      <SetSummary sets={work} equipment={equipmentMap[ex.name]} className={styles.pbSet} />
                    </span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}
