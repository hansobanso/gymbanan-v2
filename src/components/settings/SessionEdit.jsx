import { useState, useRef } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import ExerciseDetailBottomSheet from './ExerciseDetailBottomSheet'
import MuscleSetSummary from './MuscleSetSummary'
import { MUSCLE_GROUPS } from '../../data/exercises'
import styles from './SessionEdit.module.css'

const DEFAULT_REST = 120

function fmtRest(s) {
  if (!s) return 'Auto'
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem ? `${m}m${rem}s` : `${m}m`
}

function newExercise(name = '') {
  return {
    _id: Math.random().toString(36).slice(2),
    name,
    warmupSets: 1,
    workSets: 3,
    backoffSets: 0,
    restSeconds: null,
    repsMin: null,
    repsMax: null,
    notes: '',
  }
}

const DELETE_WIDTH = 80

// ── ExerciseRow ──────────────────────────────────────────────
function ExerciseRow({ ex, onTap, onRemove }) {
  const dragControls = useDragControls()
  const [dragging, setDragging] = useState(false)
  const [swipeX, setSwipeX] = useState(0)

  // Drag-to-reorder refs
  const dragTimerRef = useRef(null)
  const dragMovedRef = useRef(false)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const isDraggingNow = useRef(false)
  const lastDragEnd = useRef(0)

  // Swipe-to-delete refs
  const swipeXRef = useRef(0)
  const swipeTouchId = useRef(null)
  const swipeStartX = useRef(0)
  const swipeStartY = useRef(0)
  const swipingH = useRef(false)
  const isActivelySwipingH = useRef(false)

  function updateSwipeX(val) {
    swipeXRef.current = val
    setSwipeX(val)
  }

  // ── Drag (long-press) handlers ──
  function handlePointerDown(e) {
    dragMovedRef.current = false
    dragStartPos.current = { x: e.clientX, y: e.clientY }
    dragTimerRef.current = setTimeout(() => {
      if (dragMovedRef.current) return
      isDraggingNow.current = true
      try { navigator.vibrate?.(30) } catch {}
      setDragging(true)
      dragControls.start(e)
    }, 400)
  }

  function handlePointerMove(e) {
    const dx = Math.abs(e.clientX - dragStartPos.current.x)
    const dy = Math.abs(e.clientY - dragStartPos.current.y)
    if (dx > 8 || dy > 8) {
      dragMovedRef.current = true
      clearTimeout(dragTimerRef.current)
    }
  }

  function handlePointerUp() {
    clearTimeout(dragTimerRef.current)
  }

  // ── Swipe-to-delete (touch) handlers ──
  function handleTouchStart(e) {
    if (isDraggingNow.current) return
    const t = e.touches[0]
    swipeTouchId.current = t.identifier
    swipeStartX.current = t.clientX
    swipeStartY.current = t.clientY
    swipingH.current = false
    isActivelySwipingH.current = false
  }

  function handleTouchMove(e) {
    if (isDraggingNow.current) return
    const t = Array.from(e.touches).find(t => t.identifier === swipeTouchId.current)
    if (!t) return
    const dx = t.clientX - swipeStartX.current
    const adx = Math.abs(dx)
    const ady = Math.abs(t.clientY - swipeStartY.current)
    if (!swipingH.current && adx > 8 && adx > ady * 1.2) {
      swipingH.current = true
    }
    if (swipingH.current) {
      isActivelySwipingH.current = true
      // allow swiping back to 0 from open state, or left from 0
      const base = swipeXRef.current === -DELETE_WIDTH ? -DELETE_WIDTH : 0
      const newX = Math.min(0, Math.max(base + dx, -DELETE_WIDTH))
      updateSwipeX(newX)
      try { e.preventDefault() } catch {}
    }
  }

  function handleTouchEnd() {
    if (swipingH.current) {
      updateSwipeX(swipeXRef.current < -DELETE_WIDTH / 2 ? -DELETE_WIDTH : 0)
    }
    swipingH.current = false
    swipeTouchId.current = null
  }

  // ── Click handler ──
  function handleClick() {
    // Guard: ignore click shortly after drag end
    if (Date.now() - lastDragEnd.current < 300) return
    // If swiped open → close on tap
    if (swipeXRef.current !== 0) { updateSwipeX(0); return }
    // If was swiping → don't open detail
    if (isActivelySwipingH.current) { isActivelySwipingH.current = false; return }
    onTap()
  }

  const workSets   = ex.workSets ?? 3
  const repsMin    = ex.repsMin ?? null
  const repsMax    = ex.repsMax ?? null
  const rest       = ex.restSeconds
  const restLabel  = fmtRest(rest)
  const restCustom = rest !== null && rest !== undefined && rest !== DEFAULT_REST

  return (
    <Reorder.Item
      value={ex}
      as="div"
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={() => {
        setDragging(false)
        isDraggingNow.current = false
        lastDragEnd.current = Date.now()
      }}
      style={{ touchAction: dragging ? 'none' : 'pan-y' }}
      animate={{ scale: dragging ? 1.02 : 1 }}
      className={styles.reorderItem}
    >
      <div className={styles.swipeWrapper}>
        {/* Delete background */}
        <div className={styles.deleteBack}>
          <button className={styles.deleteBackBtn} onClick={onRemove} type="button">Ta bort</button>
        </div>
        {/* Row — slides left to reveal delete */}
        <div
          className={styles.exRow}
          style={{
            transform: `translateX(${swipeX}px)`,
            transition: isActivelySwipingH.current ? 'none' : 'transform 0.2s ease',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
        >
          <div className={styles.exRowContent}>
            <div className={styles.exRowName}>{ex.name}</div>
            <div className={styles.exRowBadges}>
              <span className={styles.badge}>{workSets} set</span>
              {(repsMin !== null || repsMax !== null) && (
                <span className={styles.badge}>{repsMin ?? ''}–{repsMax ?? ''} reps</span>
              )}
              <span className={`${styles.badgeVila} ${restCustom ? styles.badgeAccent : ''}`}>
                {restLabel} vila
              </span>
            </div>
          </div>
          <div className={styles.exRowRight}>
            <span className={styles.chevron}>›</span>
          </div>
        </div>
      </div>
    </Reorder.Item>
  )
}

// ── SessionEdit ──────────────────────────────────────────────
export default function SessionEdit({ session, allExercises, onSave, onDelete, onBack }) {
  const [name, setName]           = useState(session.name ?? '')
  const [exercises, setExercises] = useState(
    (session.exercises ?? []).map(e => ({ _id: Math.random().toString(36).slice(2), notes: '', ...e }))
  )
  const [search, setSearch]           = useState('')
  const [showSearch, setShowSearch]   = useState(false)
  const [muscleFilter, setMuscleFilter] = useState(null)
  const [saving, setSaving]           = useState(false)
  const [selectedExId, setSelectedExId] = useState(null)
  const [swappingExId, setSwappingExId] = useState(null)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const searchRef = useRef(null)

  const filteredExercises = allExercises.filter(e => {
    const matchQ = !search.trim() || e.name.toLowerCase().includes(search.toLowerCase())
    const matchG = !muscleFilter || e.muscle_group === muscleFilter
    return matchQ && matchG
  })

  const noResults = search.trim() && filteredExercises.length === 0

  const pickerGroups = filteredExercises.reduce((acc, ex) => {
    const g = ex.muscle_group || 'Övrigt'
    if (!acc[g]) acc[g] = []
    acc[g].push(ex)
    return acc
  }, {})

  const sortedPickerGroups = Object.entries(pickerGroups)
    .sort(([a], [b]) => a.localeCompare(b, 'sv'))
    .map(([g, exs]) => [g, exs.sort((a, b) => a.name.localeCompare(b.name, 'sv'))])

  const selectedEx = exercises.find(e => e._id === selectedExId) ?? null

  function addExercise(exName) {
    if (swappingExId) {
      // Swap mode: replace name on existing exercise (keep sets/reps/rest/notes)
      setExercises(prev => prev.map(e => e._id === swappingExId ? { ...e, name: exName } : e))
      setSwappingExId(null)
    } else {
      setExercises(prev => [...prev, newExercise(exName)])
    }
    setSearch('')
    setMuscleFilter(null)
    setShowSearch(false)
  }

  function closePicker() {
    setShowSearch(false)
    setSwappingExId(null)
    setSearch('')
    setMuscleFilter(null)
  }

  function removeExercise(id) {
    setExercises(prev => prev.filter(e => e._id !== id))
  }

  function updateEx(id, patch) {
    setExercises(prev => prev.map(e => e._id === id ? { ...e, ...patch } : e))
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({ ...session, name: name.trim(), exercises: exercises.map(({ _id, ...rest }) => rest) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.view}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack} type="button" aria-label="Tillbaka">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className={styles.topBarTitle}>Redigera pass</span>
        <div className={styles.topBarRight}>
          <button
            className={styles.topBarSaveBtn}
            onClick={handleSave}
            disabled={!name.trim() || saving}
            type="button"
          >
            {saving ? 'Sparar…' : 'Spara'}
          </button>
          {!session._isNew && (
            <div className={styles.topBarMenuWrap}>
              <button
                className={styles.topBarMenuBtn}
                onClick={(e) => { e.stopPropagation(); setHeaderMenuOpen(v => !v) }}
                type="button"
                aria-label="Mer"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="1"/>
                  <circle cx="12" cy="5" r="1"/>
                  <circle cx="12" cy="19" r="1"/>
                </svg>
              </button>
              {headerMenuOpen && (
                <>
                  <div className={styles.menuOverlay} onClick={() => setHeaderMenuOpen(false)} />
                  <div className={styles.menu}>
                    <button
                      className={styles.menuItemDanger}
                      onClick={() => { setHeaderMenuOpen(false); onDelete(session) }}
                      type="button"
                    >
                      Ta bort pass
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.scroll}>
        {/* Passnamn */}
        <div className={styles.section}>
          <label className={styles.label}>Passnamn</label>
          <input
            className={styles.nameInput}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="T.ex. Bröst & rygg"
          />
        </div>

        {/* Övningar */}
        <div className={styles.exercisesSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.label}>
              Övningar
              {exercises.length > 0 && (
                <span className={styles.labelCount}>{exercises.length}</span>
              )}
            </span>
            <button
              className={styles.addBtn}
              onClick={() => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 50) }}
              type="button"
            >
              + Lägg till
            </button>
          </div>

          {showSearch && (
            <>
              {/* Backdrop */}
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 9 }}
                onClick={closePicker}
              />
              {/* Picker panel */}
              <div className={styles.picker} onClick={e => e.stopPropagation()}>
                {/* Search + close */}
                <div className={styles.pickerTopBar}>
                  <input
                    ref={searchRef}
                    className={styles.pickerInput}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Sök övning…"
                    autoFocus
                  />
                  <button className={styles.pickerCloseBtn} onClick={closePicker} type="button">Stäng</button>
                </div>

                {/* Muscle group chips */}
                <div className={styles.pickerChips}>
                  <button
                    className={`${styles.pickerChip} ${!muscleFilter ? styles.pickerChipActive : ''}`}
                    onClick={() => setMuscleFilter(null)}
                    type="button"
                  >Alla</button>
                  {MUSCLE_GROUPS.map(mg => (
                    <button
                      key={mg}
                      className={`${styles.pickerChip} ${muscleFilter === mg ? styles.pickerChipActive : ''}`}
                      onClick={() => setMuscleFilter(g => g === mg ? null : mg)}
                      type="button"
                    >{mg}</button>
                  ))}
                </div>

                {/* Grouped list */}
                <div className={styles.pickerList}>
                  {noResults ? (
                    <button className={styles.pickerItemNew} onClick={() => addExercise(search.trim())} type="button">
                      + Skapa &quot;{search.trim()}&quot;
                    </button>
                  ) : (
                    sortedPickerGroups.map(([group, exs]) => (
                      <div key={group}>
                        <div className={styles.pickerGroupHeader}>{group}</div>
                        {exs.map(ex => (
                          <button
                            key={ex.id ?? ex.name}
                            className={styles.pickerItem}
                            onClick={() => addExercise(ex.name)}
                            type="button"
                          >{ex.name}</button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {exercises.length > 0 && (
            <div className={styles.exListScroll}>
              <Reorder.Group
                axis="y"
                values={exercises}
                onReorder={setExercises}
                as="div"
                style={{ touchAction: 'pan-y' }}
              >
                {exercises.map(ex => (
                  <ExerciseRow
                    key={ex._id}
                    ex={ex}
                    onTap={() => setSelectedExId(ex._id)}
                    onRemove={() => removeExercise(ex._id)}
                  />
                ))}
              </Reorder.Group>
            </div>
          )}

          {exercises.length === 0 && !showSearch && (
            <p className={styles.emptyHint}>Inga övningar ännu – tryck "+ Lägg till"</p>
          )}
        </div>

        {exercises.length > 0 && (
          <MuscleSetSummary exercises={exercises} allExercises={allExercises} />
        )}
      </div>

      <div style={{ height: 'env(safe-area-inset-bottom, 0px)', background: 'var(--bg)', flexShrink: 0 }} />

      {/* ── Övningsdetalj bottom sheet ── */}
      <ExerciseDetailBottomSheet
        exercise={selectedEx}
        onUpdate={patch => selectedExId && updateEx(selectedExId, patch)}
        onClose={() => setSelectedExId(null)}
        onSwap={() => {
          // Open the exercise picker in "swap" mode
          setSwappingExId(selectedExId)
          setSelectedExId(null)
          setShowSearch(true)
          setTimeout(() => searchRef.current?.focus(), 50)
        }}
      />
    </div>
  )
}
