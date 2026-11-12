import { motion } from 'framer-motion'
import styles from './RestDock.module.css'

const R = 19
const CIRC = 2 * Math.PI * R

function fmt(secs) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

/** Vilotimern som en docka langst ner: ring, tid, +15 s och Hoppa over. */
export default function RestDock({ timer, onOpen }) {
  const { secondsLeft, totalSeconds, paused, addSeconds, stop } = timer
  const ratio = totalSeconds > 0 ? Math.min(1, secondsLeft / totalSeconds) : 0
  const low = secondsLeft <= 10

  return (
    <motion.div
      className={styles.dock}
      initial={{ y: 90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 90, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
    >
      <button className={styles.main} onClick={onOpen} type="button" aria-label={`Vila, ${fmt(secondsLeft)} kvar. Öppna timern`}>
        <svg width="46" height="46" viewBox="0 0 46 46" fill="none" aria-hidden="true" className={styles.ring}>
          <circle cx="23" cy="23" r={R} stroke="#2E2E2E" strokeWidth="4" />
          <circle
            cx="23" cy="23" r={R}
            stroke={low ? 'var(--warning)' : 'var(--accent)'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - ratio)}
            transform="rotate(-90 23 23)"
            style={{ transition: 'stroke-dashoffset 0.5s linear' }}
          />
        </svg>
        <span className={styles.text}>
          <span className={`${styles.time} ${low ? styles.timeLow : ''}`}>{fmt(secondsLeft)}</span>
          <span className={styles.label}>{paused ? 'Pausad' : 'Vila'}</span>
        </span>
      </button>
      <button className={styles.add} onClick={() => addSeconds(15)} type="button">+15 s</button>
      <button className={styles.skip} onClick={stop} type="button">Hoppa över</button>
    </motion.div>
  )
}
