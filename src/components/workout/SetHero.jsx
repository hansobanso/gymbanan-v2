import { useRef, useEffect } from 'react'
import styles from './SetHero.module.css'

// Hall inne +/- for att stega snabbt: forsta steget direkt vid tryck,
// sedan upprepning efter 400 ms som gar fortare ju langre man haller.
function StepButton({ label, onStep, children }) {
  const timer = useRef(null)
  const fired = useRef(false)
  const stepRef = useRef(onStep)
  stepRef.current = onStep
  const stop = () => { clearTimeout(timer.current); timer.current = null }
  useEffect(() => stop, [])
  const startHold = () => {
    fired.current = false
    stop()
    let n = 0
    const tick = () => {
      fired.current = true
      stepRef.current()
      n++
      timer.current = setTimeout(tick, n < 6 ? 140 : n < 16 ? 80 : 45)
    }
    timer.current = setTimeout(tick, 400)
  }
  return (
    <button
      className={styles.step}
      type="button"
      aria-label={label}
      tabIndex={-1}
      onPointerDown={startHold}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={e => e.preventDefault()}
      onClick={() => { if (fired.current) { fired.current = false; return } stepRef.current() }}
    >
      {children}
    </button>
  )
}

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
 * Det oppna setet i passvyn: stora siffror, +/- och en stor bock.
 * Siffrorna ar vanliga textfalt, sa man kan ocksa trycka och skriva.
 */
export default function SetHero({
  set,
  label,
  prevText,
  onShowHistory,
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

  // Senaste vardena, sa att upprepade steg (hall inne) inte laser en gammal vikt
  const live = useRef({ weight: set.weight, reps: set.reps })
  live.current = { weight: set.weight, reps: set.reps }

  function adjustWeight(delta) {
    const cur = parseFloat(live.current.weight) || 0
    // Avrunda bara bort flyttalsbrus (13,75 + 2,5 ska bli 16,25).
    const next = Math.max(0, Math.round((cur + delta) * 100) / 100)
    live.current.weight = String(next)
    onUpdate('weight', String(next))
  }

  function adjustReps(delta) {
    const cur = parseInt(live.current.reps) || 0
    const next = Math.max(0, cur + delta)
    live.current.reps = next > 0 ? String(next) : ''
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
        {prevText && (onShowHistory ? (
          <button className={`${styles.prev} ${styles.prevBtn}`} onClick={onShowHistory} type="button" aria-label={`Förra: ${prevText}. Visa historik`}>
            Förra: <b>{prevText}</b>
            <svg width="6" height="10" viewBox="0 0 7 12" fill="none" aria-hidden="true"><path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        ) : (
          <span className={styles.prev}>Förra: <b>{prevText}</b></span>
        ))}
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
          <div className={styles.steppers} data-no-longpress>
            <StepButton label="Minska vikt" onStep={() => adjustWeight(-weightStep)}>−</StepButton>
            <StepButton label="Öka vikt" onStep={() => adjustWeight(weightStep)}>+</StepButton>
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
          <div className={styles.steppers} data-no-longpress>
            <StepButton label="Minska reps" onStep={() => adjustReps(-1)}>−</StepButton>
            <StepButton label="Öka reps" onStep={() => adjustReps(1)}>+</StepButton>
          </div>
        </div>
      </div>

      <div className={styles.actions} data-no-longpress>
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
          {/* En stor bock sager samma sak som "Set klart" (2026-11c) */}
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
