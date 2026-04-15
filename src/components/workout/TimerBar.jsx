import styles from './TimerBar.module.css'

export default function TimerBar({ timer }) {
  const { active, secondsLeft, totalSeconds } = timer
  const ratio = totalSeconds > 0 ? secondsLeft / totalSeconds : 0

  return (
    <div className={styles.wrapper}>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: active ? `${ratio * 100}%` : '0%' }}
        />
      </div>
    </div>
  )
}
