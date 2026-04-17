import { useState, useRef, useEffect, Fragment, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import SetRow from './SetRow'
import { getPreviousSetsForExercise, getExerciseByName } from '../../lib/db'
import { displayWeightStr } from '../../lib/weightUtils'
import styles from './ExerciseBlock.module.css'

const REST_PRESETS = [30, 60, 90, 120, 180]

function fmtRest(s) {
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (s < 60) return `${s}s`
  if (rem === 0) return `${m}m`
  return `${m}m${rem}s`
}

function fmtTarget(min, max) {
  if (!min && !max) return null
  if (min && max && min !== max) return `Mål: ${min}–${max} reps`
  return `Mål: ${min || max} reps`
}

function getSetLabel(set, allSets) {
  if (set.subtype === 'backoff') {
    let bIdx = 0
    for (const s of allSets) {
      if (s.subtype === 'backoff') bIdx++
      if (s.id === set.id) break
    }
    return `B${bIdx}`
  }
  let wIdx = 0, kIdx = 0
  for (const s of allSets) {
    if (s.type === 'warmup') wIdx++
    else if (s.type === 'work' && s.subtype !== 'backoff') kIdx++
    if (s.id === set.id) break
  }
  return set.type === 'warmup' ? `V${wIdx}` : `S${kIdx}`
}


export default function ExerciseBlock({
  exercise,
  isActive,
  isLastExercise,
  defaultRestSeconds,
  userId,
  onUpdateSet,
  onAddSet,
  onAddBackoffSet,
  onRemoveSet,
  onCompleteSet,
  onUpdateExercise,
  onUpdateExerciseReps,
  onRemoveExercise,
  onReplaceExercise,
  onShowHistory,
  onShowInstructions,
  onLongPressStart,
  onTimerStart,
  onShowDetail,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const [rirSetId, setRirSetId] = useState(null)
  const [editingReps, setEditingReps] = useState(false)
  const [repsEditMin, setRepsEditMin] = useState('')
  const [repsEditMax, setRepsEditMax] = useState('')
  const repsBlurTimer = useRef(null)
  const [prevSets, setPrevSets] = useState(exercise.prevSets ?? null)
  const [exNotes, setExNotes] = useState(exercise.exNotes ?? null)
  const [exEquipment, setExEquipment] = useState(exercise.exEquipment ?? null)
  const [collapsed, setCollapsed] = useState(false)
  const [manuallyExpanded, setManuallyExpanded] = useState(false)
  const longRef = useRef(null)
  const menuBtnRef = useRef(null)

  // Synka exNotes när förälder uppdaterar (t.ex. efter ExerciseDetailSheet-spara)
  useEffect(() => {
    if (exercise.exNotes !== undefined) setExNotes(exercise.exNotes)
  }, [exercise.exNotes])

  // Stäng meny vid klick utanför
  useEffect(() => {
    if (!menuOpen) return
    function handler() { setMenuOpen(false) }
    const t = setTimeout(() => document.addEventListener('pointerdown', handler), 10)
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', handler) }
  }, [menuOpen])

  // Hämta föregående sets + övningens notes om inte förinläst
  useEffect(() => {
    if (!userId || exercise.dataLoaded) return
    Promise.all([
      getPreviousSetsForExercise(userId, exercise.name),
      getExerciseByName(exercise.name),
    ]).then(([sets, exData]) => {
      if (sets) setPrevSets(sets)
      const notes = exData?.notes || exData?.instructions
      if (notes?.trim()) setExNotes(notes.trim())
      if (exData?.equipment) setExEquipment(exData.equipment)
    }).catch(() => {})
  }, [userId, exercise.name, exercise.dataLoaded])

  function handlePointerDown() {
    longRef.current = setTimeout(() => {
      try { navigator.vibrate?.(40) } catch {}
      onLongPressStart?.()
    }, 500)
  }
  function cancelLong() { clearTimeout(longRef.current) }

  async function handleComplete(setId) {
    const set = exercise.sets.find(s => s.id === setId)
    const wasCompleted = set?.done

    // Prevent marking a set as done without weight and reps filled in.
    // If user tries to check an empty work set, focus the first empty field instead.
    if (!wasCompleted && set?.type === 'work') {
      const hasWeight = set.weight !== '' && set.weight !== null && set.weight !== undefined
      const hasReps = set.reps !== '' && set.reps !== null && set.reps !== undefined
      if (!hasWeight || !hasReps) {
        try { navigator.vibrate?.(20) } catch {}
        // Focus first empty input in this row
        const rowEl = document.querySelector(`[data-set-id="${setId}"]`)
        const inputs = rowEl?.querySelectorAll('input[type="number"]')
        const target = !hasWeight ? inputs?.[0] : inputs?.[1]
        target?.focus()
        target?.select?.()
        return
      }
    }

    const isLastWorkSetOfExercise = !wasCompleted && set?.type === 'work' &&
      exercise.sets.filter(s => s.type === 'work' && !s.done).length === 1
    const isLastSetOfWorkout = isLastExercise && isLastWorkSetOfExercise

    // Copy reps to next undone work set if it's empty or prefilled
    if (!wasCompleted && set?.type === 'work' && set.reps) {
      const currentIdx = exercise.sets.findIndex(s => s.id === setId)
      const nextWorkSet = exercise.sets.slice(currentIdx + 1).find(s => s.type === 'work' && !s.done)
      if (nextWorkSet && (!nextWorkSet.reps || nextWorkSet.prefilled)) {
        onUpdateSet(exercise.localId, nextWorkSet.id, 'reps', set.reps)
      }
    }

    await onCompleteSet(exercise.localId, setId)
    if (!wasCompleted && set?.type === 'work' && !isLastSetOfWorkout) {
      const secs = exercise.restSeconds ?? defaultRestSeconds ?? 120
      onTimerStart?.(exercise.name, secs)
    }
    // Start 1 min rest after last warmup (next set is work)
    if (!wasCompleted && set?.type === 'warmup') {
      const currentIdx = exercise.sets.findIndex(s => s.id === setId)
      const nextSet = exercise.sets[currentIdx + 1]
      if (nextSet && nextSet.type === 'work') {
        onTimerStart?.(exercise.name, 60)
      }
    }
  }

  const workSets = exercise.sets.filter(s => s.type === 'work')
  const doneSets = workSets.filter(s => s.done)
  const allWorkDone = workSets.length > 0 && doneSets.length === workSets.length
  const isInProgress = isActive && !allWorkDone && !collapsed

  // Auto-collapse when all work sets complete
  useEffect(() => {
    if (allWorkDone) {
      setCollapsed(true)
      setManuallyExpanded(false)
    }
  }, [allWorkDone])

  const restSecs = exercise.restSeconds ?? defaultRestSeconds ?? 120
  const rirPickerSet = exercise.sets.find(s => s.id === rirSetId)
  const targetStr = fmtTarget(exercise.defaultRepsMin, exercise.defaultRepsMax)

  const prevStr = prevSets
    ? prevSets
        .filter(s => s.type === 'work' && parseInt(s.reps) > 0)
        .map(s => {
          const w = parseFloat(s.weight) || 0
          return w > 0 ? `${displayWeightStr(s.weight, exEquipment)}kg×${s.reps}` : `${s.reps} reps`
        })
        .join(' / ') || null
    : null

  // Beräkna 1RM från förra passet för rep-kalkylatorn i SetRow
  const prev1RM = (() => {
    const work = (prevSets ?? []).filter(s => s.type === 'work' && s.weight && s.reps)
    if (!work.length) return null
    let best = 0
    for (const s of work) {
      const w = parseFloat(s.weight), r = parseInt(s.reps)
      if (w > 0 && r > 0) best = Math.max(best, w * (1 + r / 30))
    }
    return best || null
  })()

  const detailId = exercise.exerciseId
    ? exercise.exerciseId
    : encodeURIComponent('__builtin__' + exercise.name)

  const hasWarmups = exercise.sets.some(s => s.type === 'warmup')
  const colLabels = ['#', 'Kg', 'Reps', '']

  // Collapsed summary
  const bestWeight = doneSets.length > 0
    ? Math.max(...doneSets.map(s => parseFloat(s.weight) || 0))
    : 0
  const collapsedMeta = `${doneSets.length} set · ${bestWeight > 0 ? displayWeightStr(bestWeight, exEquipment) + ' kg' : '–'}`

  return (
    <div className={styles.blockWrapper}>
      {isInProgress && <div className={styles.progressBar} />}
      {allWorkDone && <div className={styles.doneBar} />}
    <div className={styles.block}>

      {/* ── Collapsed view ── */}
      <AnimatePresence initial={false}>
        {collapsed && (
          <motion.div
            key="collapsed"
            className={styles.collapsedRow}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => { setCollapsed(false); setManuallyExpanded(true) }}
            role="button"
            tabIndex={0}
          >
            <div className={styles.collapsedLeft}>
              <div className={styles.collapsedCheck}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2.5 8L6.5 12L13.5 4" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className={styles.collapsedInfo}>
                <div className={styles.collapsedName}>{exercise.name}</div>
                <div className={styles.collapsedMeta}>{collapsedMeta}</div>
              </div>
            </div>
            <div className={styles.expandBtn} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Full content (hidden when collapsed) ── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >

      {/* ── Header ── */}
      <div
        className={styles.header}
        onPointerDown={handlePointerDown}
        onPointerUp={cancelLong}
        onPointerLeave={cancelLong}
        onPointerCancel={cancelLong}
      >
        <div className={styles.headerInfo}>
          <div className={styles.nameRow}>
            <button
              className={styles.nameLink}
              onClick={() => onShowDetail?.(detailId)}
              onPointerDown={e => e.stopPropagation()}
              type="button"
            >
              {exercise.name}
            </button>
            {editingReps ? (
              <div className={styles.repsRangeEdit} onPointerDown={e => e.stopPropagation()}>
                <input
                  className={styles.repsRangeInput}
                  type="text"
                  inputMode="numeric"
                  value={repsEditMin}
                  placeholder="–"
                  onChange={e => setRepsEditMin(e.target.value.replace(/\D/g, ''))}
                  onFocus={e => { clearTimeout(repsBlurTimer.current); e.target.select() }}
                  onBlur={() => {
                    repsBlurTimer.current = setTimeout(() => {
                      setEditingReps(false)
                      onUpdateExerciseReps?.(
                        exercise.localId,
                        repsEditMin !== '' ? parseInt(repsEditMin) : null,
                        repsEditMax !== '' ? parseInt(repsEditMax) : null,
                      )
                    }, 80)
                  }}
                  autoFocus
                />
                <span className={styles.repsRangeDash}>–</span>
                <input
                  className={styles.repsRangeInput}
                  type="text"
                  inputMode="numeric"
                  value={repsEditMax}
                  placeholder="–"
                  onChange={e => setRepsEditMax(e.target.value.replace(/\D/g, ''))}
                  onFocus={e => { clearTimeout(repsBlurTimer.current); e.target.select() }}
                  onBlur={() => {
                    repsBlurTimer.current = setTimeout(() => {
                      setEditingReps(false)
                      onUpdateExerciseReps?.(
                        exercise.localId,
                        repsEditMin !== '' ? parseInt(repsEditMin) : null,
                        repsEditMax !== '' ? parseInt(repsEditMax) : null,
                      )
                    }, 80)
                  }}
                />
              </div>
            ) : (
              (exercise.defaultRepsMin != null || exercise.defaultRepsMax != null) ? (
                <span
                  className={styles.repsRange}
                  onClick={e => {
                    e.stopPropagation()
                    setRepsEditMin(exercise.defaultRepsMin != null ? String(exercise.defaultRepsMin) : '')
                    setRepsEditMax(exercise.defaultRepsMax != null ? String(exercise.defaultRepsMax) : '')
                    setEditingReps(true)
                  }}
                >
                  {`${exercise.defaultRepsMin ?? ''}–${exercise.defaultRepsMax ?? ''}`}
                </span>
              ) : (
                <span
                  className={styles.repsRangeEmpty}
                  onClick={e => {
                    e.stopPropagation()
                    setRepsEditMin('')
                    setRepsEditMax('')
                    setEditingReps(true)
                  }}
                >
                  + Mål
                </span>
              )
            )}
          </div>
          {exercise.progressionHint && (
            <div className={styles.progressionHint}>{exercise.progressionHint}</div>
          )}
          {exercise.muscleGroup && (
            <div className={styles.metaRow}>
              <span className={styles.muscleTag}>{exercise.muscleGroup}</span>
            </div>
          )}
          <button
            className={styles.exNotesBtn}
            onClick={() => onShowDetail?.(detailId)}
            onPointerDown={e => e.stopPropagation()}
            type="button"
          >
            {exNotes
              ? <span className={styles.exNotes}>{exNotes}</span>
              : <span className={styles.exNotesEmpty}>+ Notering</span>
            }
          </button>
        </div>

        <div className={styles.headerActions}>
          <button
            ref={menuBtnRef}
            className={`${styles.iconBtn} ${menuOpen ? styles.iconBtnActive : ''}`}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation()
              const rect = menuBtnRef.current?.getBoundingClientRect()
              if (rect) setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
              setMenuOpen(v => !v)
            }}
            aria-label="Fler alternativ"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="5" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="19" cy="12" r="1.5" fill="currentColor" />
            </svg>
          </button>
          {allWorkDone && (
            <button
              className={styles.expandBtn}
              onPointerDown={e => { e.stopPropagation(); cancelLong() }}
              onClick={e => { e.stopPropagation(); setCollapsed(true); setManuallyExpanded(false) }}
              type="button"
              aria-label="Kollapsa övning"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 15L12 9L6 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── ··· dropdown ── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className={styles.dropdownFixed}
            style={{ top: menuPos.top, right: menuPos.right }}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            onPointerDown={e => e.stopPropagation()}
          >
            <button className={styles.menuItem} onClick={() => { onShowHistory?.(exercise); setMenuOpen(false) }}>Historik</button>
            <button className={styles.menuItem} onClick={() => { onShowInstructions?.(exercise); setMenuOpen(false) }}>Övningsinstruktioner</button>
            <div className={styles.menuDivider} />
            <button
              className={`${styles.menuItem} ${styles.menuItemDanger}`}
              onClick={() => { onRemoveExercise(exercise.localId); setMenuOpen(false) }}
            >
              Ta bort övning
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Kolumnrubriker ── */}
      <div className={styles.colHeaders}>
        {colLabels.map(l => (
          <span key={l} className={styles.colLabel}>{l}</span>
        ))}
      </div>

      {/* ── Set-rader med uppvärmningsseparator ── */}
      <div className={styles.sets}>
        {exercise.sets.map((set, index) => {
          const isFirstWarmup = set.type === 'warmup' && index === 0
          const isFirstWork = set.type === 'work' && hasWarmups && (index === 0 || exercise.sets[index - 1]?.type === 'warmup')
          return (
            <Fragment key={set.id}>
              {isFirstWork && (
                <div className={styles.warmupDivider} />
              )}
              <SetRow
                set={set}
                displayLabel={getSetLabel(set, exercise.sets)}
                isWarmup={set.type === 'warmup'}
                allSets={exercise.sets}
                prev1RM={prev1RM}
                prefilled={!!set.prefilled}
                onUpdate={(field, value) => onUpdateSet(exercise.localId, set.id, field, value)}
                onRemove={() => onRemoveSet(exercise.localId, set.id)}
                onComplete={() => handleComplete(set.id)}
                onOpenRIR={() => setRirSetId(set.id)}
              />
            </Fragment>
          )
        })}
      </div>

      {/* ── Tidigare vikter ── */}
      {prevStr && (
        <button
          className={styles.prevRow}
          onClick={() => onShowHistory?.(exercise)}
          type="button"
          aria-label="Visa historik för övningen"
        >
          <span className={styles.prevText}>Förra: {prevStr}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={styles.prevChevron}>
            <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* ── Footer ── */}
      <div className={styles.footer}>
        <button className={styles.footerAdd} onClick={() => onAddSet(exercise.localId, 'warmup')} type="button">
          + Värm
        </button>
        <button className={styles.footerAdd} onClick={() => onAddSet(exercise.localId, 'work')} type="button">
          + Set
        </button>
        <button className={styles.footerAdd} onClick={() => onAddBackoffSet?.(exercise.localId)} type="button">
          + Back-off
        </button>
        <button className={styles.footerReplace} onClick={() => onReplaceExercise?.(exercise)} type="button">
          ⇄ Byt
        </button>
      </div>

      {/* ── Hur kändes det? ── */}
      <div className={styles.aiRow}>
        <textarea
          className={styles.aiTextarea}
          value={exercise.aiComment}
          onChange={e => {
            onUpdateExercise(exercise.localId, 'aiComment', e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
          }}
          placeholder="Hur kändes det?"
          rows={1}
        />
      </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RIR-picker (bottom sheet) ── */}
      <AnimatePresence>
        {rirSetId && rirPickerSet && (
          <>
            <motion.div
              className={styles.rirBackdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRirSetId(null)}
            />
            <motion.div
              className={styles.rirSheet}
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              onClick={e => e.stopPropagation()}
            >
              <div className={styles.rirHandle} />
              <p className={styles.rirTitle}>RIR – reps kvar i tanken</p>
              <div className={styles.rirGrid}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <button
                    key={n}
                    className={`${styles.rirOpt} ${rirPickerSet.rir === n ? styles.rirOptActive : ''}`}
                    onClick={() => {
                      onUpdateSet(exercise.localId, rirSetId, 'rir', n)
                      setRirSetId(null)
                    }}
                    type="button"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
    </div>
  )
}
