import { motion } from 'framer-motion'
import { displayWeightStr } from '../../lib/weightUtils'
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

function fmtVolume(kg) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k`
  return String(Math.round(kg))
}

export default function PostWorkoutFeedback({ sessionName, exercises, feedbackStatus, feedbackText, onDone, equipmentMap = {} }) {
  const { sets, volume, exCount } = calcStats(exercises)

  return (
    <motion.div
      className={styles.screen}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
        {/* ── Topp-sektion ── */}
        <motion.div
          className={styles.hero}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          <span className={styles.heroIcon}>🎉</span>
          <h2 className={styles.heroTitle}>Pass klart!</h2>
          <p className={styles.heroName}>{sessionName}</p>
        </motion.div>

        {/* ── Stats ── */}
        <motion.div
          className={styles.stats}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <div className={styles.stat}>
            <span className={styles.statValue}>{exCount}</span>
            <span className={styles.statLabel}>övningar</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statValue}>{sets}</span>
            <span className={styles.statLabel}>arbetsset</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statValue}>{fmtVolume(volume)}</span>
            <span className={styles.statLabel}>kg volym</span>
          </div>
        </motion.div>

        {/* ── PT-feedback ── */}
        <motion.div
          className={styles.feedbackCard}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          <div className={styles.feedbackHeader}>
            <span className={styles.ptBadge}>PT</span>
            <span className={styles.feedbackTitle}>Feedback på passet</span>
          </div>

          {feedbackStatus === 'loading' && (
            <div className={styles.loading}>
              <div className={styles.loadingDots}>
                <span /><span /><span />
              </div>
              <p className={styles.loadingText}>Din PT analyserar passet…</p>
            </div>
          )}

          {feedbackStatus === 'done' && feedbackText && (
            <div className={styles.feedbackText}>
              {feedbackText.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')}
            </div>
          )}

          {feedbackStatus === 'done' && !feedbackText && (
            <p className={styles.feedbackNone}>
              Ingen feedback tillgänglig just nu – försök igen från historiken.
            </p>
          )}

          {feedbackStatus === 'error' && (
            <p className={styles.feedbackNone}>
              Kunde inte hämta feedback. Kolla anslutningen och försök igen.
            </p>
          )}
        </motion.div>

        {/* ── Övningslista (kollapsad) ── */}
        <motion.div
          className={styles.exerciseList}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3 }}
        >
          {exercises.map(ex => {
            const work = ex.sets.filter(s => s.type === 'work' && s.done)
            if (work.length === 0) return null
            return (
              <div key={ex.localId} className={styles.exRow}>
                <span className={styles.exName}>{ex.name}</span>
                <span className={styles.exMeta}>
                  {work.length} set · {displayWeightStr(work[work.length - 1]?.weight, equipmentMap[ex.name]) || '?'} kg
                </span>
              </div>
            )
          })}
        </motion.div>

      {/* ── Knapp ── */}
      <motion.div
        className={styles.footer}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.3 }}
      >
        <button
          className={styles.doneBtn}
          onClick={onDone}
          type="button"
          disabled={feedbackStatus === 'loading'}
        >
          {feedbackStatus === 'loading' ? 'Väntar på PT…' : 'Till hemskärmen'}
        </button>
        {feedbackStatus === 'loading' && (
          <button
            className={styles.skipBtn}
            onClick={onDone}
            type="button"
          >
            Skippa feedback
          </button>
        )}
      </motion.div>
    </motion.div>
  )
}
