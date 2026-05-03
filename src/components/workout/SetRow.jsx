import { useRef, useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import styles from './SetRow.module.css'

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

export default function SetRow({
  set,
  displayLabel,
  isWarmup,
  isNext,
  allSets,
  prev1RM,
  prefilled,
  onUpdate,
  onRemove,
  onDuplicate,
  onComplete,
  onOpenRIR,
}) {
  const containerRef = useRef(null)
  const x = useMotionValue(0)
  const deleteBgOpacity = useTransform(x, [-80, -30], [1, 0])
  const duplicateBgOpacity = useTransform(x, [30, 80], [0, 1])
  const rowOpacity = useTransform(x, [-80, 0, 80], [0.75, 1, 0.85])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let startX = 0, startY = 0, direction = null
    function onTouchStart(e) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      direction = null
    }
    function onTouchMove(e) {
      if (direction === null) {
        const dx = Math.abs(e.touches[0].clientX - startX)
        const dy = Math.abs(e.touches[0].clientY - startY)
        if (dx > 5 || dy > 5) direction = dx > dy ? 'h' : 'v'
      }
      if (direction === 'h') e.preventDefault()
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  function handleDragEnd(_, info) {
    // Higher threshold (90px) + check velocity so small/uncertain swipes always snap back cleanly
    const offset = info.offset.x
    const velocity = info.velocity.x
    const passedLeft = offset < -90 || (offset < -40 && velocity < -500)
    const passedRight = offset > 90 || (offset > 40 && velocity > 500)

    if (passedLeft) {
      animate(x, -80, { type: 'spring', stiffness: 500, damping: 40 })
    } else if (passedRight && onDuplicate) {
      animate(x, 80, { type: 'spring', stiffness: 500, damping: 40 })
    } else {
      // Snap back - closes both delete and duplicate reveals
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 })
    }
  }

  function handleDuplicateClick() {
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 })
    onDuplicate?.()
  }

  const best1RM = !isWarmup ? (getBest1RM(allSets) || prev1RM) : null
  const suggested = !isWarmup && set.subtype !== 'backoff' && set.weight ? suggestReps(set.weight, best1RM) : null
  const repPlaceholder = suggested ? `~${suggested}` : 'Reps'

  const rirValue = !isWarmup && set.rir !== null && set.rir !== undefined ? String(set.rir) : null

  function adjustWeight(delta) {
    if (set.done) return
    const cur = parseFloat(set.weight) || 0
    const next = Math.round((cur + delta) * 2) / 2
    onUpdate('weight', String(next))
  }

  function adjustReps(delta) {
    if (set.done) return
    const cur = parseInt(set.reps) || 0
    const next = Math.max(0, cur + delta)
    onUpdate('reps', next > 0 ? String(next) : '')
  }

  return (
    <div className={styles.wrapper} ref={containerRef} data-set-id={set.id}>
      {/* Delete reveal */}
      <motion.button
        className={styles.deleteBg}
        style={{ opacity: deleteBgOpacity }}
        onClick={onRemove}
        type="button"
        aria-label="Ta bort set"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 6H21M8 6V4H16V6M19 6L18.1 20H5.9L5 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className={styles.deleteBgLabel}>Ta bort</span>
      </motion.button>

      {/* Duplicate reveal (höger) */}
      <motion.button
        className={styles.duplicateBg}
        style={{ opacity: duplicateBgOpacity }}
        onClick={handleDuplicateClick}
        type="button"
        aria-label="Dubblera set"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" stroke="#000" strokeWidth="2" />
          <path d="M5 15V5a1 1 0 0 1 1-1h10" stroke="#000" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className={styles.duplicateBgLabel}>Dubblera</span>
      </motion.button>

      {/* Row: # | Kg | Reps(+RIR overlay) | ✓ */}
      <motion.div
        className={`${styles.row} ${set.done ? styles.done : ''} ${isWarmup ? styles.warmup : ''} ${isNext ? styles.nextSet : ''}`}
        style={{ x, opacity: rowOpacity }}
        drag={set.done ? false : 'x'}
        dragConstraints={{ left: -80, right: 80 }}
        dragElastic={{ left: 0.08, right: 0.08 }}
        onDragEnd={handleDragEnd}
        dragDirectionLock
      >
        {/* # */}
        <span className={styles.label}>{displayLabel}</span>

        {/* Kg stepper */}
        <div className={`${styles.stepper} ${set.done ? styles.stepperDone : ''}`}>
          <button
            className={styles.stepBtn}
            onClick={e => { e.stopPropagation(); adjustWeight(-2.5) }}
            onPointerDown={e => e.stopPropagation()}
            type="button"
            disabled={set.done}
            aria-label="Minska vikt"
            tabIndex={-1}
          >−</button>
          <input
            className={styles.stepInput}
            type="number"
            inputMode="decimal"
            value={set.weight}
            onChange={e => onUpdate('weight', e.target.value)}
            onFocus={e => e.target.select()}
            placeholder="Kg"
            disabled={set.done}
          />
          <button
            className={styles.stepBtn}
            onClick={e => { e.stopPropagation(); adjustWeight(2.5) }}
            onPointerDown={e => e.stopPropagation()}
            type="button"
            disabled={set.done}
            aria-label="Öka vikt"
            tabIndex={-1}
          >+</button>
        </div>

        {/* Reps stepper + RIR split pill */}
        <div className={`${styles.splitPill} ${set.done ? styles.splitPillDone : ''}`}>
          <div className={styles.splitBox}>
            <button
              className={styles.stepBtn}
              onClick={e => { e.stopPropagation(); adjustReps(-1) }}
              onPointerDown={e => e.stopPropagation()}
              type="button"
              disabled={set.done}
              aria-label="Minska reps"
              tabIndex={-1}
            >−</button>
            <input
              className={styles.splitInput}
              type="number"
              inputMode="numeric"
              value={set.reps}
              onChange={e => onUpdate('reps', e.target.value)}
              onFocus={e => e.target.select()}
              placeholder={repPlaceholder}
              disabled={set.done}
            />
            <button
              className={styles.stepBtn}
              onClick={e => { e.stopPropagation(); adjustReps(1) }}
              onPointerDown={e => e.stopPropagation()}
              type="button"
              disabled={set.done}
              aria-label="Öka reps"
              tabIndex={-1}
            >+</button>
          </div>
          {!isWarmup ? (
            <button
              className={`${styles.splitRir} ${rirValue !== null ? styles.splitRirSet : ''}`}
              onClick={e => {
                e.stopPropagation()
                if (set.done) return
                // Cycle: null → 0 → 1 → 2 → 3 → 4 → 5 → null
                const current = set.rir
                let next
                if (current === null || current === undefined) next = 0
                else if (current >= 5) next = null
                else next = current + 1
                onUpdate('rir', next)
              }}
              type="button"
              aria-label={rirValue !== null ? `RIR: ${rirValue}` : 'Sätt RIR'}
            >
              {rirValue !== null ? rirValue : 'RIR'}
            </button>
          ) : (
            <div className={styles.rirSpacer} aria-hidden="true" />
          )}
        </div>

        {/* Fyll-cirkel */}
        <button
          className={`${styles.checkBtn} ${set.done ? styles.checked : ''}`}
          onClick={() => onComplete()}
          type="button"
          aria-label={set.done ? 'Ångra set' : 'Markera set som klart'}
        />
      </motion.div>
    </div>
  )
}
