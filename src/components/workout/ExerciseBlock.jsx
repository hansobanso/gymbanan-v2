import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import SetHero from './SetHero'
import { getPreviousSetsForExercise, getExerciseByName } from '../../lib/db'
import { displayWeightStr, defaultWeightIncrement } from '../../lib/weightUtils'
import styles from './ExerciseBlock.module.css'

// Tre slags set: uppvarmning (w), arbetsset (k) och backoff (b). Samma
// indelning anvands for etiketter och for att para ihop med forra passet.
function setKind(s) {
  if (s.type === 'warmup') return 'w'
  return s.subtype === 'backoff' ? 'b' : 'k'
}

function kindIndex(set, allSets) {
  const kind = setKind(set)
  let i = 0
  for (const s of allSets) {
    if (setKind(s) === kind) i++
    if (s.id === set.id) break
  }
  return i
}

function shortLabel(set, allSets) {
  const i = kindIndex(set, allSets)
  const kind = setKind(set)
  return kind === 'w' ? `V${i}` : kind === 'b' ? `B${i}` : String(i)
}

function longLabel(set, allSets) {
  const i = kindIndex(set, allSets)
  const kind = setKind(set)
  if (kind === 'w') return `Uppvärmning ${i}`
  if (kind === 'b') return `Backoff ${i}`
  const total = allSets.filter(s => setKind(s) === 'k').length
  return `Set ${i} av ${total}`
}

const CheckIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

const SupersetChip = () => (
  <span className={styles.supersetChip}>
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
    Superset
  </span>
)

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
  onDuplicateSet,
  onCompleteSet,
  onUpdateExerciseReps,
  onRemoveExercise,
  onReplaceExercise,
  onShowHistory,
  onShowInstructions,
  onLongPressStart,
  onTimerStart,
  onActivate,
  autoCenter,
  supersetPartner,
  supersetFirstId,
  onSupersetJump,
  onSupersetLinkStart,
  onSupersetUnlink,
  onShowDetail,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const [editingReps, setEditingReps] = useState(false)
  const [repsEditMin, setRepsEditMin] = useState('')
  const [repsEditMax, setRepsEditMax] = useState('')
  const repsBlurTimer = useRef(null)
  // Reservhamtning (namn-markt) for ovningar vars data inte hunnit laddas.
  // Forra passets set och redskap HARLEDS fran ovningen i forsta hand - forut
  // lag de i lokal state som aldrig nollstalldes, sa efter "Byt ovning"
  // kunde den gamla ovningens "Förra passet" sta kvar.
  const [fetched, setFetched] = useState(null) // { name, prevSets, equipment }
  // Klar ovning som anvandaren sjalv fallt ut igen.
  const [reopened, setReopened] = useState(false)
  // Set som anvandaren tryckt pa for att andra (annars oppnas nasta ej klara).
  const [editSetId, setEditSetId] = useState(null)
  const longRef = useRef(null)
  const menuBtnRef = useRef(null)
  const blockRef = useRef(null)

  // Stäng meny vid klick utanför
  useEffect(() => {
    if (!menuOpen) return
    function handler() { setMenuOpen(false) }
    const t = setTimeout(() => document.addEventListener('pointerdown', handler), 10)
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', handler) }
  }, [menuOpen])

  // Hämta föregående sets + redskap om övningen inte är förinläst
  useEffect(() => {
    if (!userId || exercise.dataLoaded) return
    let cancelled = false
    const name = exercise.name
    Promise.all([
      getPreviousSetsForExercise(userId, name),
      getExerciseByName(name),
    ]).then(([sets, exData]) => {
      if (cancelled) return
      setFetched({ name, prevSets: sets ?? null, equipment: exData?.equipment ?? null })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [userId, exercise.name, exercise.dataLoaded])

  const fetchedForThis = fetched?.name === exercise.name ? fetched : null
  const prevSets = exercise.prevSets ?? fetchedForThis?.prevSets ?? null
  const exEquipment = exercise.exEquipment ?? fetchedForThis?.equipment ?? null

  function handlePointerDown() {
    longRef.current = setTimeout(() => {
      try { navigator.vibrate?.(40) } catch { /* ignored */ }
      onLongPressStart?.()
    }, 500)
  }
  function cancelLong() { clearTimeout(longRef.current) }
  const longPress = {
    onPointerDown: handlePointerDown,
    onPointerUp: cancelLong,
    onPointerLeave: cancelLong,
    onPointerCancel: cancelLong,
  }

  async function handleComplete(setId) {
    const set = exercise.sets.find(s => s.id === setId)
    const wasCompleted = set?.done

    // Prevent marking a set as done without reps filled in.
    // Vikt ar valfritt - kroppsviktsovningar som chins/dips gors utan extra vikt.
    if (!wasCompleted && set?.type === 'work') {
      const hasReps = set.reps !== '' && set.reps !== null && set.reps !== undefined
      if (!hasReps) {
        try { navigator.vibrate?.(20) } catch { /* ignored */ }
        // Focus reps-faltet (andra number-inputen i kortet)
        const rowEl = document.querySelector(`[data-set-id="${setId}"]`)
        const inputs = rowEl?.querySelectorAll('input[type="number"]')
        const target = inputs?.[1] ?? inputs?.[0]
        target?.focus()
        target?.select?.()
        return
      }
    }

    const isLastWorkSetOfExercise = !wasCompleted && set?.type === 'work' &&
      exercise.sets.filter(s => s.type === 'work' && !s.done).length === 1
    const isLastSetOfWorkout = isLastExercise && isLastWorkSetOfExercise

    setEditSetId(null)
    // (Nasta sets vikt/reps fylls i av completeSet i useWorkout.)
    await onCompleteSet(exercise.localId, setId)
    if (!wasCompleted && set?.type === 'work') {
      if (supersetPartner) {
        // Superset: hoppa till partnern om den ligger efter (ingen vila an).
        // Nar bada gjort lika manga set ar paret klart -> vila startar och
        // fokus gar tillbaka till forsta ovningen i paret.
        const doneSelfAfter = exercise.sets.filter(s => s.type === 'work' && s.done).length + 1
        const donePartner = supersetPartner.sets.filter(s => s.type === 'work' && s.done).length
        const partnerHasUndone = supersetPartner.sets.some(s => s.type === 'work' && !s.done)
        if (partnerHasUndone && donePartner < doneSelfAfter) {
          onSupersetJump?.(supersetPartner.localId)
        } else if (!isLastSetOfWorkout) {
          const secs = exercise.restSeconds ?? supersetPartner.restSeconds ?? defaultRestSeconds ?? 120
          onTimerStart?.(`${exercise.name} + ${supersetPartner.name}`, secs)
          if (supersetFirstId) onSupersetJump?.(supersetFirstId)
        }
      } else if (!isLastSetOfWorkout) {
        const secs = exercise.restSeconds ?? defaultRestSeconds ?? 120
        onTimerStart?.(exercise.name, secs)
      }
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
  const setsLeft = workSets.length - doneSets.length
  const allWorkDone = workSets.length > 0 && setsLeft === 0

  // En ovning som blir klar falls ihop igen (aven om den varit utfalld).
  useEffect(() => {
    if (allWorkDone) setReopened(false)
  }, [allWorkDone])

  const isTimeBased = exercise.isTimeBased === true
  const isCardio = exercise.isCardio === true
  const weightUnit = isCardio ? 'km' : 'kg'
  const repsUnit = isCardio ? 'min' : isTimeBased ? 'sek' : 'reps'

  // "22 kg × 8", "8 reps" (kroppsvikt), "5 km × 30 min"
  function fmtSet(s) {
    if (!s) return '–'
    const reps = parseInt(s.reps)
    const w = parseFloat(s.weight) || 0
    if (!reps && !w) return '–'
    const wStr = isCardio ? String(w) : displayWeightStr(s.weight, exEquipment)
    if (isCardio) return w > 0 ? `${wStr} km × ${reps || '–'} min` : `${reps} min`
    const unit = isTimeBased ? ' s' : ''
    if (w > 0) return `${wStr} kg × ${reps || '–'}${unit}`
    return isTimeBased ? `${reps} s` : `${reps} reps`
  }

  const hasValues = s => (parseInt(s.reps) || 0) > 0 || (parseFloat(s.weight) || 0) > 0

  // Forra passets motsvarande set (samma sort, samma ordningsnummer).
  function prevFor(set) {
    if (!prevSets) return null
    const kind = setKind(set)
    const same = prevSets.filter(s => setKind(s) === kind && parseInt(s.reps) > 0)
    return same[kindIndex(set, exercise.sets) - 1] ?? null
  }

  // Beräkna 1RM från förra passet för rep-förslaget i setkortet
  const prev1RM = (() => {
    const work = (prevSets ?? []).filter(s => s.type === 'work' && s.weight && s.reps)
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

  // +/- pa vikten foljer ovningens eget viktsteg (hantel 2, maskin 5,
  // annars 2,5 - eller det som ar satt pa ovningen). Kardio stegar 0,5 km.
  const weightStep = isCardio
    ? 0.5
    : (Number(exercise.weightIncrement) || defaultWeightIncrement(exEquipment))

  const hasTarget = exercise.defaultRepsMin != null || exercise.defaultRepsMax != null
  const targetStr = hasTarget
    ? `${exercise.defaultRepsMin ?? ''}–${exercise.defaultRepsMax ?? ''} ${isTimeBased ? 'sek' : 'reps'}`
    : null

  // PT-raden visas bara nar nagot avviker fran "samma vikt, fyll pa reps"
  // (hojd vikt, uppehall, deload, for tungt ...). Vanliga dagar star malet
  // redan ifyllt i seten.
  const showHint = !!exercise.progressionHint && !(
    exercise.progressionAction === 'keep_weight_add_reps' && /^(Behåll|Kör på)/.test(exercise.progressionHint)
  )

  const mode = allWorkDone && !reopened ? 'done' : (isActive || reopened) ? 'open' : 'upcoming'

  // Vilket set som visas som stort kort: det anvandaren tryckt pa, annars
  // nasta ej klara set i den aktiva ovningen.
  const editSet = exercise.sets.find(s => s.id === editSetId && !s.done)
  const openSetId = editSet?.id ?? (isActive ? exercise.sets.find(s => !s.done)?.id ?? null : null)

  // Hall det oppna setet mitt pa skarmen. Med manga set skulle kortet
  // annars glida ner mot kanten for varje set man bockar av.
  // (autoCenter ar av tills forsta setet i passet ar gjort, sa vyn inte
  // hoppar nar passet startar.)
  useEffect(() => {
    if (!openSetId || !autoCenter) return
    const raf = requestAnimationFrame(() => {
      const el = blockRef.current?.querySelector(`[data-set-id="${openSetId}"]`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(raf)
  }, [openSetId, autoCenter])

  function startRepsEdit(e) {
    e.stopPropagation()
    setRepsEditMin(exercise.defaultRepsMin != null ? String(exercise.defaultRepsMin) : '')
    setRepsEditMax(exercise.defaultRepsMax != null ? String(exercise.defaultRepsMax) : '')
    setEditingReps(true)
  }
  function commitRepsEdit() {
    repsBlurTimer.current = setTimeout(() => {
      setEditingReps(false)
      onUpdateExerciseReps?.(
        exercise.localId,
        repsEditMin !== '' ? parseInt(repsEditMin) : null,
        repsEditMax !== '' ? parseInt(repsEditMax) : null,
      )
    }, 80)
  }

  // ── Klar ovning: en rad ──
  if (mode === 'done') {
    const bestWeight = Math.max(0, ...doneSets.map(s => parseFloat(s.weight) || 0))
    const pbs = doneSets.filter(s => s.isPB).length
    const meta = [
      `${doneSets.length} set`,
      bestWeight > 0 ? `${displayWeightStr(bestWeight, exEquipment)} kg` : null,
    ].filter(Boolean).join(' · ')
    return (
      <div className={styles.blockWrapper} data-exid={exercise.localId}>
        <button className={styles.compact} onClick={() => setReopened(true)} type="button" {...longPress}>
          <span className={styles.compactCheck}><CheckIcon size={14} /></span>
          <span className={styles.compactText}>
            <span className={styles.compactNameDone}>{exercise.name}</span>
            <span className={styles.compactMeta}>{meta}</span>
          </span>
          {pbs > 0 && (
            <span className={styles.compactPb} aria-label={`${pbs} personbästa`}>
              {pbs > 1 ? `${pbs} PB` : 'PB'}
            </span>
          )}
        </button>
      </div>
    )
  }

  // ── Kommande ovning: en rad, tryck for att kora den nu ──
  if (mode === 'upcoming') {
    const meta = [
      `${workSets.length} set`,
      targetStr,
      doneSets.length > 0 ? `${doneSets.length} klara` : null,
    ].filter(Boolean).join(' · ')
    return (
      <div className={styles.blockWrapper} data-exid={exercise.localId}>
        <button className={styles.compact} onClick={() => onActivate?.(exercise.localId)} type="button" {...longPress}>
          <span className={styles.compactRing} />
          <span className={styles.compactText}>
            <span className={styles.compactName}>
              {exercise.name}
              {supersetPartner && <SupersetChip />}
            </span>
            <span className={styles.compactMeta}>{meta}</span>
          </span>
        </button>
      </div>
    )
  }

  // ── Oppen ovning: rubrik + settabell med aktivt set som kort ──
  return (
    <div className={`${styles.blockWrapper} ${styles.open}`} data-exid={exercise.localId} ref={blockRef}>
      <div className={styles.header} {...longPress}>
        <div className={styles.titleRow}>
          <button
            className={styles.nameLink}
            onClick={() => onShowDetail?.(detailId)}
            onPointerDown={e => e.stopPropagation()}
            type="button"
          >
            {exercise.name}
          </button>
          <div className={styles.titleActions}>
            {allWorkDone && <span className={`${styles.leftChip} ${styles.leftChipDone}`}>Klar</span>}
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
          </div>
        </div>

        {/* Raden under namnet visas bara nar den tillfor nagot: en egen
            notering, superset, eller nar rep-malet saknas/redigeras.
            (Malet andras annars via menyn.) */}
        {(editingReps || !hasTarget || exercise.exNotes || supersetPartner) && (
          <div className={styles.metaRow} onPointerDown={e => e.stopPropagation()}>
          {editingReps ? (
            <span className={styles.repsRangeEdit}>
              <input
                className={styles.repsRangeInput}
                type="text"
                inputMode="numeric"
                value={repsEditMin}
                placeholder="–"
                aria-label="Lägsta reps"
                onChange={e => setRepsEditMin(e.target.value.replace(/\D/g, ''))}
                onFocus={e => { clearTimeout(repsBlurTimer.current); e.target.select() }}
                onBlur={commitRepsEdit}
                autoFocus
              />
              <span>–</span>
              <input
                className={styles.repsRangeInput}
                type="text"
                inputMode="numeric"
                value={repsEditMax}
                placeholder="–"
                aria-label="Högsta reps"
                onChange={e => setRepsEditMax(e.target.value.replace(/\D/g, ''))}
                onFocus={e => { clearTimeout(repsBlurTimer.current); e.target.select() }}
                onBlur={commitRepsEdit}
              />
            </span>
          ) : (
            !hasTarget && (
              <button className={styles.metaBtn} onClick={startRepsEdit} type="button">+ Sätt mål</button>
            )
          )}
          {exercise.exNotes && (
            <button className={styles.metaBtn} onClick={() => onShowDetail?.(detailId)} type="button">
              {exercise.exNotes}
            </button>
          )}
          {supersetPartner && <SupersetChip />}
        </div>
        )}

        {showHint && (
          <div className={`${styles.progressionHint} ${
            exercise.progressionAction === 'too_heavy_flag' ? styles.progressionWarn : ''
          }`}>{exercise.progressionHint}</div>
        )}
        {/* Utan rep-mal kan vi inte gora progression (vet inte nar vi ska
            oka vikt vs reps). */}
        {isActive && !hasTarget && !editingReps && (
          <div className={styles.repsWarning}>
            Inget rep-mål är satt, så progressionen fungerar inte. Tryck på "+ Sätt mål" ovan.
          </div>
        )}
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
            <button className={styles.menuItem} onClick={() => { onAddSet(exercise.localId, 'warmup'); setMenuOpen(false) }}>
              + Uppvärmningsset
            </button>
            <button className={styles.menuItem} onClick={() => { onAddSet(exercise.localId, 'work'); setMenuOpen(false) }}>
              + Arbetsset
            </button>
            <button className={styles.menuItem} onClick={() => { onAddBackoffSet?.(exercise.localId); setMenuOpen(false) }}>
              + Back-off set
            </button>
            {openSetId && (
              <>
                <button className={styles.menuItem} onClick={() => { onDuplicateSet?.(exercise.localId, openSetId); setMenuOpen(false) }}>
                  Dubblera det öppna setet
                </button>
                <button className={styles.menuItem} onClick={() => { onRemoveSet(exercise.localId, openSetId); setEditSetId(null); setMenuOpen(false) }}>
                  Ta bort det öppna setet
                </button>
              </>
            )}
            <div className={styles.menuDivider} />
            <button className={styles.menuItem} onClick={e => { setMenuOpen(false); startRepsEdit(e) }}>
              {hasTarget ? `Ändra rep-mål (${targetStr})` : 'Sätt rep-mål'}
            </button>
            <button className={styles.menuItem} onClick={() => { onReplaceExercise?.(exercise); setMenuOpen(false) }}>
              Byt övning
            </button>
            {supersetPartner ? (
              <button className={styles.menuItem} onClick={() => { onSupersetUnlink?.(exercise); setMenuOpen(false) }}>
                Ta bort superset
              </button>
            ) : (
              <button className={styles.menuItem} onClick={() => { onSupersetLinkStart?.(exercise); setMenuOpen(false) }}>
                Superset med…
              </button>
            )}
            <button className={styles.menuItem} onClick={() => { onShowHistory?.(exercise); setMenuOpen(false) }}>Historik</button>
            <button className={styles.menuItem} onClick={() => { onShowInstructions?.(exercise); setMenuOpen(false) }}>Övningsinstruktioner</button>
            {allWorkDone && (
              <button className={styles.menuItem} onClick={() => { setReopened(false); setMenuOpen(false) }}>
                Fäll ihop
              </button>
            )}
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

      {/* ── Settabell: Set / Förra / Idag ── */}
      <div className={styles.table}>
        {exercise.sets.map(set => {
          const prev = prevFor(set)
          if (set.id === openSetId) {
            return (
              <SetHero
                key={set.id}
                set={set}
                label={longLabel(set, exercise.sets)}
                prevText={prev ? fmtSet(prev) : null}
                allSets={exercise.sets}
                prev1RM={prev1RM}
                weightStep={weightStep}
                weightUnit={weightUnit}
                repsUnit={repsUnit}
                showRir={set.type !== 'warmup' && !isCardio && !isTimeBased}
                onUpdate={(field, value) => onUpdateSet(exercise.localId, set.id, field, value)}
                onComplete={() => handleComplete(set.id)}
              />
            )
          }
          const label = shortLabel(set, exercise.sets)
          if (set.done) {
            return (
              <div key={set.id} className={`${styles.tr} ${styles.trDone}`} data-set-id={set.id}>
                <span className={styles.tdLabel}>{label}</span>
                <span>{prev ? fmtSet(prev) : ''}</span>
                <span>
                  {hasValues(set) ? fmtSet(set) : (set.type === 'warmup' ? 'Uppvärmning' : 'Klar')}
                  {set.rir != null && set.rir !== '' && <span className={styles.rirNote}> · RIR {set.rir}</span>}
                </span>
                <button
                  className={`${styles.statusBtn} ${set.isPB ? styles.statusPb : styles.statusDone}`}
                  onClick={() => handleComplete(set.id)}
                  type="button"
                  aria-label={set.isPB ? `Personbästa! Ångra set ${label}` : `Ångra set ${label}`}
                >
                  {set.isPB ? <span className={styles.pbLabel}>PB</span> : <CheckIcon />}
                </button>
              </div>
            )
          }
          return (
            <button
              key={set.id}
              className={`${styles.tr} ${styles.trTodo}`}
              data-set-id={set.id}
              onClick={() => setEditSetId(set.id)}
              type="button"
              aria-label={`Öppna set ${label}`}
            >
              <span className={styles.tdLabel}>{label}</span>
              <span className={styles.tdPrev}>{prev ? fmtSet(prev) : ''}</span>
              <span className={styles.tdToday}>
                {hasValues(set) ? fmtSet(set) : <span className={styles.tdEmpty}>{set.type === 'warmup' ? 'Uppvärmning' : 'Fyll i'}</span>}
              </span>
              <span className={styles.statusTodo} />
            </button>
          )
        })}
      </div>

    </div>
  )
}
