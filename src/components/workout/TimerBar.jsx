import styles from './TimerBar.module.css'

function timerColor(ratio) {
  if (ratio > 0.6) return 'var(--timer-safe)'
  if (ratio > 0.3) return 'var(--timer-warn)'
  return 'var(--timer-danger)'
}

export default function TimerBar({ timer }) {
  const { active, secondsLeft, totalSeconds } = timer
  const ratio = totalSeconds > 0 ? secondsLeft / totalSeconds : 0
  const color = timerColor(ratio)

  return (
    <div className={styles.wrapper}>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{
            width: active ? `${ratio * 100}%` : '0%',
            backgroundColor: active ? color : 'var(--timer-safe)',
            transition: 'width 1s linear, background-color 0.6s ease',
          }}
        />
      </div>
    </div>
  )
}
