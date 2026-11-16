import { fmtRest } from '../../lib/plural.js'
import { AnimatePresence, motion } from 'framer-motion'
import ExerciseMuscles from '../shared/ExerciseMuscles'
import styles from './ExerciseDetailBottomSheet.module.css'

const REST_OPTIONS = [null, 30, 60, 90, 120, 180].map(value => ({ label: fmtRest(value), value }))

function Stepper({ label, value, min = 0, onChange }) {
  return (
    <div className={styles.stepper}>
      <span className={styles.stepperCaption}>{label}</span>
      <span className={styles.stepVal}>{value}</span>
      <div className={styles.stepperControls}>
        <button
          className={styles.stepBtn}
          onClick={() => onChange(Math.max(min, value - 1))}
          type="button"
          aria-label={`Färre ${label.toLowerCase()}`}
        >−</button>
        <button
          className={styles.stepBtn}
          onClick={() => onChange(value + 1)}
          type="button"
          aria-label={`Fler ${label.toLowerCase()}`}
        >+</button>
      </div>
    </div>
  )
}

// Ett tal i repintervallet: - [tal] +. Talet gar fortfarande att skriva i.
function RepNum({ value, onChange, label }) {
  return (
    <div className={styles.repNum}>
      <button className={styles.repBtn} type="button" aria-label={`${label} minus ett`} onClick={() => onChange(-1)}>−</button>
      <input
        type="text" inputMode="numeric"
        className={styles.repsInput}
        aria-label={label}
        value={value ?? ''}
        placeholder="–"
        onFocus={e => e.target.select()}
        onChange={e => {
          const v = e.target.value.replace(/\D/g, '')
          onChange(null, v === '' ? null : parseInt(v))
        }}
      />
      <button className={styles.repBtn} type="button" aria-label={`${label} plus ett`} onClick={() => onChange(1)}>+</button>
    </div>
  )
}

export default function ExerciseDetailBottomSheet({ exercise, info, onUpdate, onClose, onSwap, isCardio }) {
  if (!exercise) return null

  const repsMin = exercise.repsMin ?? ''
  const repsMax = exercise.repsMax ?? ''

  return (
    <AnimatePresence>
      {exercise && (
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
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={styles.header}>
              <span className={styles.title}>{exercise.name}</span>
              <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Stäng">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className={styles.content}>
              {info && !isCardio && (
                <ExerciseMuscles
                  primary={info.muscle_group}
                  secondary={info.secondary_muscles ?? []}
                  tertiary={info.tertiary_muscles ?? []}
                />
              )}
              <div className={styles.stepGrid}>
              {!isCardio && (
                <Stepper
                  label="Uppvärmning"
                  value={exercise.warmupSets ?? 1}
                  min={0}
                  onChange={v => onUpdate({ warmupSets: v })}
                />
              )}
              <Stepper
                label={isCardio ? 'Rundor' : 'Arbetsset'}
                value={exercise.workSets ?? (isCardio ? 1 : 3)}
                min={1}
                onChange={v => onUpdate({ workSets: v })}
              />
              {!isCardio && (
                <Stepper
                  label="Back-off"
                  value={exercise.backoffSets ?? 0}
                  min={0}
                  onChange={v => onUpdate({ backoffSets: v })}
                />
              )}
              </div>

              {isCardio && (
                <p className={styles.cardioHint}>Distans (km) och tid (min) fyller du i under passet.</p>
              )}

              {/* Reps */}
              {!isCardio && (
              <div className={styles.repsRow}>
                <span className={styles.stepperLabel}>Reps</span>
                <div className={styles.repsInputs}>
                  <RepNum
                    label="Minsta reps"
                    value={exercise.repsMin}
                    onChange={(d, typed) => {
                      if (d == null) return onUpdate({ repsMin: typed })
                      const cur = exercise.repsMin ?? 8
                      const next = Math.max(1, cur + d)
                      const max = exercise.repsMax ?? Math.max(next, 12)
                      onUpdate({ repsMin: next, repsMax: Math.max(max, next) })
                    }}
                  />
                  <span className={styles.repsDash}>–</span>
                  <RepNum
                    label="Högsta reps"
                    value={exercise.repsMax}
                    onChange={(d, typed) => {
                      if (d == null) return onUpdate({ repsMax: typed })
                      const cur = exercise.repsMax ?? 12
                      const next = Math.max(1, cur + d)
                      const min = exercise.repsMin ?? Math.min(next, 8)
                      onUpdate({ repsMax: next, repsMin: Math.min(min, next) })
                    }}
                  />
                </div>
              </div>
              )}

              {/* Rest chips */}
              <div className={styles.restSection}>
                <span className={styles.stepperLabel}>Vila</span>
                <div className={styles.chips}>
                  {REST_OPTIONS.map(opt => (
                    <button
                      key={opt.label}
                      className={`${styles.chip} ${exercise.restSeconds === opt.value ? styles.chipActive : ''}`}
                      onClick={() => onUpdate({ restSeconds: opt.value })}
                      type="button"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className={styles.notesSection}>
                <span className={styles.stepperLabel}>Anteckningar</span>
                <textarea
                  className={styles.textarea}
                  value={exercise.notes ?? ''}
                  onChange={e => onUpdate({ notes: e.target.value })}
                  placeholder="Noteringar för detta pass…"
                  rows={3}
                />
              </div>

              {/* Swap exercise */}
              {onSwap && (
                <button
                  className={styles.swapBtn}
                  onClick={onSwap}
                  type="button"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M16 3h5v5"/>
                    <path d="M8 21H3v-5"/>
                    <path d="M21 3l-7 7"/>
                    <path d="M3 21l7-7"/>
                  </svg>
                  Byt övning
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
