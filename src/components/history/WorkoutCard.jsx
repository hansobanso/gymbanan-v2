import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { displayWeightStr } from '../../lib/weightUtils'
import styles from './WorkoutCard.module.css'

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

export default function WorkoutCard({ workout, onShowCharts, onDelete, equipmentMap = {} }) {
  const [open, setOpen] = useState(false)
  const [ptOpen, setPtOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const exercises = workout.exercises ?? []
  const { sets, volume, exCount } = calcStats(exercises)

  return (
    <div className={styles.card}>
      {/* Header */}
      <button className={styles.header} onClick={() => setOpen(v => !v)} type="button">
        <div className={styles.headerTop}>
          <span className={styles.name}>{workout.session_name ?? 'Pass'}</span>
          <div className={styles.headerRight} onClick={e => e.stopPropagation()}>
            {confirmDelete ? (
              <div className={styles.confirmRow}>
                <span className={styles.confirmLabel}>Ta bort?</span>
                <button className={styles.confirmYes} onClick={() => onDelete?.(workout.id)} type="button">Ja</button>
                <button className={styles.confirmNo} onClick={() => setConfirmDelete(false)} type="button">Nej</button>
              </div>
            ) : (
              <button className={styles.deleteBtn} onClick={() => setConfirmDelete(true)} type="button" aria-label="Ta bort pass">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 6H5H21M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.metaDate}>{fmtDate(workout.started_at)} · {fmtTime(workout.started_at)}</span>
          <div className={styles.chips}>
            <span className={styles.chip}>{exCount} övn</span>
            <span className={styles.chip}>{sets} set</span>
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
                      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

              {/* Styrkegrafer */}
              {onShowCharts && (
                <button className={styles.chartsBtn} onClick={onShowCharts} type="button">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M3 20L8 14L12 17L17 10L21 13M3 20H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Styrkegrafer
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
