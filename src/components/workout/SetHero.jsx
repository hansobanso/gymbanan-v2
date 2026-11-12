import styles from './SetHero.module.css'

function epley(weight, reps) {
  const w = parseFloat(weight), r = parseInt(reps)
  if (!w || !r || r <= 0) return null
  return w * (1 + r / 30)
}

function suggestReps(weight, oneRM) {
  const w = parseFloat(weight)
  if (!w || !oneRM || w <= 0 || w >= oneRM) return null
  const r = Math.round((oneRM / w - 1) * 30)
  if (r < 1 || r > 30) return null
  return r
}

function getBest1RM(allSets) {
  let best = 0
  for (const s of allSets) {
    if (s.done && s.type === 'work' && s.weight && s.reps) {
      const rm = epley(s.weight, s.reps)
      if (rm && rm > best) best = rm
    }
  }
  return best || null
}

/**
 * Det oppna setet i passvyn: stora siffror, +/- och "Set klart".
 * Siffrorna ar vanliga textfalt, sa man kan ocksa trycka och skriva.
 */
export default function SetHero({
  set,
  label,
  prevText,
  allSets,
  prev1RM,
  weightStep = 2.5,
  weightUnit = 'kg',
  repsUnit = 'reps',
  showRir,
  onUpdate,
  onComplete,
}) {
  const isWork = set.type === 'work' && set.subtype !== 'backoff'
  const best1RM = isWork ? (getBest1RM(allSets) || prev1RM) : null
  const suggested = isWork && repsUnit === 'reps' && set.weight ? suggestReps(set.weight, best1RM) : null

  function adjustWeight(delta) {
    const cur = parseFloat(set.weight) || 0
    // Avrunda bara bort flyttalsbrus (13,75 + 2,5 ska bli 16,25).
    const next = Math.max(0, Math.round((cur + delta) * 100) / 100)
    onUpdate('weight', String(next))
  }

  function adjustReps(delta) {
    const cur = parseInt(set.reps) || 0
    const next = Math.max(0, cur + delta)
    onUpdate('reps', next > 0 ? String(next) : '')
  }

  // RIR ar en enda knapp som stegar: tom -> 0 -> 1 ... 5 -> tom
  function cycleRir() {
    const cur = set.rir
    let next
    if (cur === null || cur === undefined || cur === '') next = 0
    else if (Number(cur) >= 5) next = null
    else next = Number(cur) + 1
    onUpdate('rir', next)
  }

  const hasRir = set.rir !== null && set.rir !== undefined && set.rir !== ''

  return (
    <div className={styles.card} data-set-id={set.id}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {prevText && <span className={styles.prev}>Förra: <b>{prevText}</b></span>}
      </div>

      <div className={styles.fields}>
        <div className={styles.field}>
          <input
            className={styles.num}
            type="number"
            inputMode="decimal"
            value={set.weight ?? ''}
            onChange={e => onUpdate('weight', e.target.value)}
            onFocus={e => e.target.select()}
            placeholder="0"
            aria-label={weightUnit === 'km' ? 'Distans i km' : 'Vikt i kg'}
          />
          <span className={styles.unit}>{weightUnit}</span>
          <div className={styles.steppers}>
            <button className={styles.step} onClick={() => adjustWeight(-weightStep)} type="button" aria-label="Minska vikt" tabIndex={-1}>−</button>
            <button className={styles.step} onClick={() => adjustWeight(weightStep)} type="button" aria-label="Öka vikt" tabIndex={-1}>+</button>
          </div>
        </div>
        <div className={styles.field}>
          <input
            className={styles.num}
            type="number"
            inputMode="numeric"
            value={set.reps ?? ''}
            onChange={e => onUpdate('reps', e.target.value)}
            onFocus={e => e.target.select()}
            placeholder={suggested ? String(suggested) : '0'}
            aria-label={repsUnit === 'reps' ? 'Reps' : repsUnit === 'min' ? 'Minuter' : 'Sekunder'}
          />
          <span className={styles.unit}>{repsUnit}</span>
          <div className={styles.steppers}>
            <button className={styles.step} onClick={() => adjustReps(-1)} type="button" aria-label="Minska reps" tabIndex={-1}>−</button>
            <button className={styles.step} onClick={() => adjustReps(1)} type="button" aria-label="Öka reps" tabIndex={-1}>+</button>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        {showRir && (
          <button
            className={`${styles.rir} ${hasRir ? styles.rirSet : ''}`}
            onClick={cycleRir}
            type="button"
            aria-label={hasRir ? `RIR ${set.rir}, tryck för att ändra` : 'Sätt RIR, tryck för att stega'}
          >
            <span className={styles.rirLabel}>RIR</span>
            <span className={styles.rirValue}>{hasRir ? set.rir : '–'}</span>
          </button>
        )}
        <button className={styles.doneBtn} onClick={onComplete} type="button" aria-label="Markera set som klart">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          Set klart
        </button>
      </div>
    </div>
  )
}
