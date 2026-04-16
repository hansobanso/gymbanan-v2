import { AnimatePresence, motion } from 'framer-motion'
import styles from './TimerExpanded.module.css'

function fmt(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function timerColor(ratio) {
  if (ratio > 0.6) return 'var(--timer-safe)'
  if (ratio > 0.3) return 'var(--timer-warn)'
  return 'var(--timer-danger)'
}

export default function TimerExpanded({ open, timer, onClose }) {
  const { active, paused, exerciseName, secondsLeft, totalSeconds, pause, resume, addSeconds, stop } = timer
  const ratio = totalSeconds > 0 ? secondsLeft / totalSeconds : 0
  const color = timerColor(ratio)

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

            <p className={styles.exName}>
              {active ? `${exerciseName} · vila` : 'Ingen aktiv timer'}
            </p>

            <p className={styles.bigTime} style={{ color: active ? color : 'var(--text-3)' }}>
              {fmt(secondsLeft)}
            </p>

            {/* Progress bar */}
            <div className={styles.track}>
              <div
                className={styles.fill}
                style={{
                  width: `${ratio * 100}%`,
                  backgroundColor: color,
                  transition: 'width 1s linear, background-color 0.6s ease',
                }}
              />
            </div>

            {/* Controls */}
            {active && (
              <div className={styles.controls}>
                <button
                  className={styles.ctrlBtn}
                  onClick={() => addSeconds(-30)}
                  type="button"
                >
                  −30s
                </button>
                <button
                  className={styles.ctrlBtn}
                  onClick={() => addSeconds(-15)}
                  type="button"
                >
                  −15s
                </button>
                <button
                  className={styles.ctrlBtn}
                  onClick={() => addSeconds(15)}
                  type="button"
                >
                  +15s
                </button>
                <button
                  className={styles.ctrlBtn}
                  onClick={() => addSeconds(30)}
                  type="button"
                >
                  +30s
                </button>
                <button
                  className={styles.ctrlBtn}
                  onClick={() => addSeconds(60)}
                  type="button"
                >
                  +1 min
                </button>
                <button
                  className={styles.stopBtn}
                  onClick={() => { stop(); onClose() }}
                  type="button"
                >
                  Avsluta
                </button>
              </div>
            )}

            <button className={styles.closeBtn} onClick={onClose}>
              Stäng
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
