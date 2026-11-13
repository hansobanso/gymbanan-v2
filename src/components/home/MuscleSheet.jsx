import { AnimatePresence, motion } from 'framer-motion'
import { daysLabel } from '../../lib/homeStats'
import { displayWeightStr } from '../../lib/weightUtils'
import day from './DaySheet.module.css'
import styles from './MuscleSheet.module.css'

const MONTHS_SHORT = ['jan', 'feb', 'mars', 'april', 'maj', 'juni', 'juli', 'aug', 'sep', 'okt', 'nov', 'dec']

function statusLine(m) {
  const when = m.days == null ? null : m.days <= 1 ? `senast ${daysLabel(m.days)}` : `senast för ${daysLabel(m.days)} sedan`
  if (m.state === 'resting') return ['Vilar', m.readyLabel, when].filter(Boolean).join(' · ')
  if (m.state === 'ready') return ['Redo', when].filter(Boolean).join(' · ')
  return m.days == null ? 'Inte tränad än' : ['Inte tränad på länge', when].filter(Boolean).join(' · ')
}

function lastLine(row, equipment) {
  if (!row.last) return 'Inte kört än'
  const d = row.last.at
  const what = row.last.weight > 0
    ? `${displayWeightStr(row.last.weight, equipment)} kg × ${row.last.reps}`
    : `${row.last.reps} reps`
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} · ${what}`
}

function Row({ row, equipment, extra, nextName, onAdd, onRemove }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowName}>{row.name}</span>
        <span className={styles.rowMeta}>
          {[row.sessions.join(', ') || null, lastLine(row, equipment)].filter(Boolean).join(' · ')}
        </span>
      </div>
      {row.inNext ? (
        <span className={styles.inNext}>I {nextName ?? 'nästa pass'}</span>
      ) : extra ? (
        <button className={styles.added} onClick={() => onRemove(row.name)} type="button" aria-label={`Ta bort ${row.name} från nästa pass`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
          Tillagd
        </button>
      ) : (
        <button className={styles.add} onClick={() => onAdd(row)} type="button" aria-label={`Lägg till 2 set ${row.name} i nästa pass`}>
          + 2 set
        </button>
      )}
    </div>
  )
}

/** En muskelgrupp fran Muskellaget: vad som tranar den och genvag till nasta pass. */
export default function MuscleSheet({ muscle, detail, exerciseMap, extras, nextName, onAdd, onRemove, onClose }) {
  const isExtra = name => extras.some(e => e.name === name)
  return (
    <AnimatePresence>
      {muscle && detail && (
        <>
          <motion.div className={day.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className={day.sheet}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            role="dialog"
            aria-label={`Muskelläge ${muscle.group}`}
          >
            <div className={day.handle} />
            <div className={day.header}>
              <span className={day.eyebrow}>Muskelläge</span>
              <button className={day.closeBtn} onClick={onClose} type="button" aria-label="Stäng">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className={day.body}>
              <h2 className={day.title}>{muscle.group}</h2>
              <p className={`${styles.status} ${styles[muscle.state]}`}>{statusLine(muscle)}</p>

              {detail.inProgram.length > 0 ? (
                <>
                  <span className={styles.label}>I ditt program</span>
                  <div className={styles.rows}>
                    {detail.inProgram.map(row => (
                      <Row key={row.name} row={row} equipment={exerciseMap?.[row.name]?.equipment} extra={isExtra(row.name)} nextName={nextName} onAdd={onAdd} onRemove={onRemove} />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className={styles.note}>Inget i ditt program har {muscle.group.toLowerCase()} som huvudmuskel.</p>
                  {detail.suggestions.length > 0 && (
                    <>
                      <span className={styles.label}>Förslag</span>
                      <div className={styles.rows}>
                        {detail.suggestions.map(row => (
                          <Row key={row.name} row={row} equipment={exerciseMap?.[row.name]?.equipment} extra={isExtra(row.name)} nextName={nextName} onAdd={onAdd} onRemove={onRemove} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {[...detail.inProgram, ...detail.suggestions].some(r => !r.inNext) && (
                <p className={styles.foot}>
                  "+ 2 set" lägger övningen sist i nästa pass du startar, en gång. Programmet ändras inte.
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
