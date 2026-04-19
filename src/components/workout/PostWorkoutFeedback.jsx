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
          <svg className={styles.heroIcon} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#F5D020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
            <path d="M4 22h16"/>
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
          </svg>
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
            <svg className={styles.ptBadge} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5D020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>
              <path d="M12 11h.01"/>
              <path d="M16 11h.01"/>
              <path d="M8 11h.01"/>
            </svg>
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
