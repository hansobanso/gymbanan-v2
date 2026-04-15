import { AnimatePresence, motion } from 'framer-motion'
import styles from './ExerciseDetailBottomSheet.module.css'

const REST_OPTIONS = [
  { label: '30s',   value: 30 },
  { label: '1m',    value: 60 },
  { label: '1m30s', value: 90 },
  { label: '2m',    value: 120 },
  { label: '3m',    value: 180 },
]

function Stepper({ label, value, min = 0, onChange }) {
  return (
    <div className={styles.stepperRow}>
      <span className={styles.stepperLabel}>{label}</span>
      <div className={styles.stepperControls}>
        <button
          className={styles.stepBtn}
          onClick={() => onChange(Math.max(min, value - 1))}
          type="button"
        >−</button>
        <span className={styles.stepVal}>{value}</span>
        <button
          className={styles.stepBtn}
          onClick={() => onChange(value + 1)}
          type="button"
        >+</button>
      </div>
    </div>
  )
}

export default function ExerciseDetailBottomSheet({ exercise, onUpdate, onClose }) {
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
              <Stepper
                label="Uppvärmning"
                value={exercise.warmupSets ?? 1}
                min={0}
                onChange={v => onUpdate({ warmupSets: v })}
              />
              <Stepper
                label="Arbetsset"
                value={exercise.workSets ?? 3}
                min={1}
                onChange={v => onUpdate({ workSets: v })}
              />
              <Stepper
                label="Back-off"
                value={exercise.backoffSets ?? 0}
                min={0}
                onChange={v => onUpdate({ backoffSets: v })}
              />

              {/* Reps */}
              <div className={styles.repsRow}>
                <span className={styles.stepperLabel}>Reps</span>
                <div className={styles.repsInputs}>
                  <input
                    type="text" inputMode="numeric"
                    className={styles.repsInput}
                    value={repsMin}
                    placeholder="–"
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '')
                      onUpdate({ repsMin: v === '' ? null : parseInt(v) })
                    }}
                    onBlur={e => { if (!e.target.value.trim()) onUpdate({ repsMin: null }) }}
                  />
                  <span className={styles.repsDash}>–</span>
                  <input
                    type="text" inputMode="numeric"
                    className={styles.repsInput}
                    value={repsMax}
                    placeholder="–"
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '')
                      onUpdate({ repsMax: v === '' ? null : parseInt(v) })
                    }}
                    onBlur={e => { if (!e.target.value.trim()) onUpdate({ repsMax: null }) }}
                  />
                </div>
              </div>

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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
