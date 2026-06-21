import { useState, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { displayWeightStr } from '../../lib/weightUtils'
import styles from './WorkoutCard.module.css'

const DELETE_WIDTH = 80

function fmtDate(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now - d) / 86400000)
  if (diff === 0) return 'Idag'
  if (diff === 1) return 'Igår'
  if (diff < 7) return d.toLocaleDateString('sv-SE', { weekday: 'long' })
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

// Passets langd fran start till slut, snyggt formaterat ("52 min" / "1h 5min")
function fmtDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return null
  const ms = new Date(finishedAt) - new Date(startedAt)
  if (ms <= 0) return null
  const mins = Math.round(ms / 60000)
  if (mins < 1) return null
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

function calcStats(exercises) {
  if (!Array.isArray(exercises)) return { sets: 0, volume: 0, exCount: 0 }
  let sets = 0, volume = 0, exCount = 0
  for (const ex of exercises) {
    if (!ex.sets) continue
    const work = ex.sets.filter(s => s.type === 'work' && s.done)
    if (work.length === 0) continue
    exCount++
    sets += work.length
    volume += work.reduce((s, w) => s + (parseFloat(w.weight) || 0) * (parseInt(w.reps) || 0), 0)
  }
  return { sets, volume, exCount }
}

function fmtVolume(kg) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k kg`
  return `${Math.round(kg)} kg`
}

export default function WorkoutCard({ workout, onDelete, equipmentMap = {} }) {
  const [open, setOpen] = useState(false)
  const [ptOpen, setPtOpen] = useState(false)
  const [swipeX, setSwipeX] = useState(0)
  const exercises = workout.exercises ?? []
  const { sets, volume, exCount } = calcStats(exercises)

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
      <div className={styles.deleteBack}>
        <button className={styles.deleteBackBtn} onClick={() => onDelete?.(workout.id)} type="button">Ta bort</button>
      </div>
      <div
        className={styles.card}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isActivelySwipingH.current ? 'none' : 'transform 0.2s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
      {/* Header */}
      <button className={styles.header} onClick={handleHeaderClick} type="button">
        <div className={styles.headerTop}>
          <span className={styles.name}>{workout.session_name ?? 'Pass'}</span>
          <div className={styles.headerRight} onClick={e => e.stopPropagation()}>
            <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.metaDate}>{fmtDate(workout.started_at)} · {fmtTime(workout.started_at)}</span>
          <div className={styles.chips}>
            <span className={styles.chip}>{exCount} övn</span>
            <span className={styles.chip}>{sets} set</span>
            {fmtDuration(workout.started_at, workout.finished_at) && (
              <span className={styles.chip}>{fmtDuration(workout.started_at, workout.finished_at)}</span>
            )}
            {volume > 0 && <span className={styles.chip}>{fmtVolume(volume)}</span>}
          </div>
        </div>
      </button>

      {/* Expanderat innehåll */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className={styles.body}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <div className={styles.bodyInner}>
              {/* Övningar */}
              {exercises.filter(ex => ex.sets?.some(s => s.type === 'work' && s.done)).map(ex => {
                const work = ex.sets.filter(s => s.type === 'work' && s.done)
                const equipment = equipmentMap[ex.name]
                const isDouble = equipment === 'Hantel'
                return (
                  <div key={ex.localId ?? ex.name} className={styles.exBlock}>
                    <div className={styles.exName}>
                      {ex.name}{isDouble && <span className={styles.doubleTag}>×2</span>}
                    </div>
                    <div className={styles.setList}>
                      {work.map((s, i) => (
                        <span key={i} className={styles.setChip}>
                          {s.weight ? `${displayWeightStr(s.weight, equipment)}×${s.reps}` : `${s.reps} reps`}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* AI-feedback – kollapsad */}
              {workout.ai_feedback && (
                <div className={styles.aiFeedback}>
                  <button className={styles.ptToggle} onClick={() => setPtOpen(v => !v)} type="button">
                    <span className={styles.ptBadge}>PT</span>
                    <span className={styles.ptToggleLabel}>Feedback</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ transform: ptOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-3)', marginLeft: 'auto' }}>
                      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <AnimatePresence initial={false}>
                    {ptOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                      >
                        <p className={styles.aiFeedbackText}>{workout.ai_feedback}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}
