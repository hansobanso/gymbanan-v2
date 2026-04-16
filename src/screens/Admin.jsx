import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import styles from './Admin.module.css'

const ADMIN_PASSWORD = 'banana2024'

const MUSCLE_GROUPS = [
  'Bröst', 'Rygg', 'Axlar', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Rumpa', 'Core', 'Vader', 'Underarmar', 'Övrigt',
]

const EQUIPMENT_OPTIONS = [
  'Skivstång', 'Hantel', 'Maskin', 'Kabel',
  'Kroppsvikt', 'Smithmaskin', 'Övrigt',
]

const MOVEMENT_OPTIONS = [
  'Press', 'Drag', 'Squat', 'Hinge', 'Carry', 'Isolation', 'Övrigt',
]

// ── DB helpers ──────────────────────────────────────────────────

async function adminGetExercises() {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('muscle_group', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

async function adminSaveExercise(ex) {
  const { data, error } = await supabase.from('exercises').insert(ex).select().single()
  if (error) throw error
  return data
}

async function adminUpdateExercise(id, patch) {
  const { data, error } = await supabase.from('exercises').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

async function adminDeleteExercise(id) {
  const { error } = await supabase.from('exercises').delete().eq('id', id)
  if (error) throw error
}

async function adminGetGlobalPrograms() {
  const { data, error } = await supabase.from('programs').select('*').eq('is_global', true).order('name')
  if (error) throw error
  return data ?? []
}

async function adminSaveProgram(prog) {
  const { data, error } = await supabase.from('programs').insert(prog).select().single()
  if (error) throw error
  return data
}

async function adminUpdateProgram(id, patch) {
  const { data, error } = await supabase.from('programs').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

async function adminDeleteProgram(id) {
  const { error } = await supabase.from('programs').delete().eq('id', id)
  if (error) throw error
}

async function adminGetWorkouts() {
  const { data, error } = await supabase
    .from('workouts')
    .select('user_id, finished_at, session_name, exercises')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return data ?? []
}

async function adminGetProfiles() {
  const { data, error } = await supabase.from('profiles').select('id, display_name')
  if (error) throw error
  return data ?? []
}

async function adminUpsertProfile(userId, displayName) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, display_name: displayName || null, updated_at: new Date().toISOString() })
  if (error) throw error
}

// ── Helpers ─────────────────────────────────────────────────────

function newSession() {
  return { _id: Math.random().toString(36).slice(2), name: 'Nytt pass', exercises: [] }
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
  }
}

function hydrateSession(s) {
  return {
    _id: Math.random().toString(36).slice(2),
    ...s,
    exercises: (s.exercises ?? []).map(e => ({
      _id: Math.random().toString(36).slice(2),
      ...e,
    })),
  }
}

// ── GripIcon ─────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="2.5" r="1.2"/><circle cx="9" cy="2.5" r="1.2"/>
      <circle cx="3" cy="7"   r="1.2"/><circle cx="9" cy="7"   r="1.2"/>
      <circle cx="3" cy="11.5" r="1.2"/><circle cx="9" cy="11.5" r="1.2"/>
    </svg>
  )
}

// ── REST labels ──────────────────────────────────────────────────

const REST_OPTS = [
  { label: '30s',   value: '30' },
  { label: '1m',    value: '60' },
  { label: '1m30s', value: '90' },
  { label: '2m',    value: '120' },
  { label: '3m',    value: '180' },
]

// ── SortableExerciseRow ──────────────────────────────────────────

function SortableExerciseRow({ exercise, sessionId, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise._id,
    data: { type: 'exercise', exercise, sessionId },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.25 : 1 }}
      className={styles.exCard}
    >
      <div className={styles.exCardTop}>
        <div className={styles.exCardHandle} {...attributes} {...listeners}>
          <GripIcon />
        </div>
        <div className={styles.exCardName}>{exercise.name}</div>
        <button
          className={styles.exCardExpandBtn}
          onClick={() => setExpanded(v => !v)}
          type="button"
          aria-label={expanded ? 'Kollapsa' : 'Expandera'}
        >
          {expanded ? '∧' : '∨'}
        </button>
        <button className={styles.exCardRemove} onClick={onRemove} type="button" aria-label="Ta bort övning">×</button>
      </div>
      <div className={`${styles.exCardBody} ${expanded ? styles.exCardBodyExpanded : ''}`}>
        <div className={styles.exCardSteppers}>
          <Stepper label="WU"       value={exercise.warmupSets  ?? 1} min={0} onChange={v => onUpdate({ warmupSets:  v })} />
          <Stepper label="Set"      value={exercise.workSets    ?? 3} min={1} onChange={v => onUpdate({ workSets:    v })} />
          <Stepper label="Back-off" value={exercise.backoffSets ?? 0} min={0} onChange={v => onUpdate({ backoffSets: v })} />
        </div>

        <div className={styles.exCardRow}>
          <span className={styles.exCardRowLabel}>Reps</span>
          <input
            type="text" inputMode="numeric" className={styles.repsInput}
            value={exercise.repsMin ?? ''}
            placeholder="–"
            onFocus={e => e.target.select()}
            onChange={e => onUpdate({ repsMin: e.target.value.replace(/\D/g, '') === '' ? null : parseInt(e.target.value.replace(/\D/g, '')) })}
            onBlur={e => { if (!e.target.value.trim()) onUpdate({ repsMin: null }) }}
          />
          <span className={styles.repsDash}>–</span>
          <input
            type="text" inputMode="numeric" className={styles.repsInput}
            value={exercise.repsMax ?? ''}
            placeholder="–"
            onFocus={e => e.target.select()}
            onChange={e => onUpdate({ repsMax: e.target.value.replace(/\D/g, '') === '' ? null : parseInt(e.target.value.replace(/\D/g, '')) })}
            onBlur={e => { if (!e.target.value.trim()) onUpdate({ repsMax: null }) }}
          />
        </div>

        <div className={styles.exCardRow}>
          <span className={styles.exCardRowLabel}>Vila</span>
          <select
            className={styles.vilaSelect}
            value={exercise.restSeconds != null ? String(exercise.restSeconds) : ''}
            onChange={e => onUpdate({ restSeconds: e.target.value ? +e.target.value : null })}
          >
            {REST_OPTS.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

function Stepper({ label, value, min = 0, onChange }) {
  return (
    <div className={styles.stepper}>
      <span className={styles.stepperLabel}>{label}</span>
      <div className={styles.stepperControls}>
        <button className={styles.stepBtn} onClick={() => onChange(Math.max(min, value - 1))} type="button">−</button>
        <span className={styles.stepVal}>{value}</span>
        <button className={styles.stepBtn} onClick={() => onChange(value + 1)} type="button">+</button>
      </div>
    </div>
  )
}

// ── SessionColumn ────────────────────────────────────────────────

function SessionColumn({ session, allExercises, isOver, onUpdateName, onAddExercise, onRemoveExercise, onUpdateExercise, onRemoveSession }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: session._id,
    data: { type: 'session' },
  })

  const [search, setSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)

  const filtered = allExercises.filter(e =>
    !search.trim() || e.name.toLowerCase().includes(search.toLowerCase())
  )

  const groups = filtered.reduce((acc, ex) => {
    const g = ex.muscle_group || 'Övrigt'
    if (!acc[g]) acc[g] = []
    acc[g].push(ex)
    return acc
  }, {})

  const sortedGroups = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b, 'sv'))
    .map(([g, exs]) => [g, exs.sort((a, b) => a.name.localeCompare(b.name, 'sv'))])

  const noResults = search.trim() && filtered.length === 0

  function pick(name) {
    onAddExercise(name)
    setShowPicker(false)
    setSearch('')
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.25 : 1 }}
      className={`${styles.sessionCol} ${isOver ? styles.sessionColOver : ''}`}
    >
      {/* Column header */}
      <div className={styles.sessionColHeader}>
        <div className={styles.sessionColHandle} {...attributes} {...listeners}>
          <GripIcon />
        </div>
        <input
          className={styles.sessionColName}
          value={session.name}
          onChange={e => onUpdateName(e.target.value)}
        />
        <button className={styles.sessionColDelete} onClick={onRemoveSession} type="button" aria-label="Ta bort pass">×</button>
      </div>

      {/* Exercise list */}
      <SortableContext items={(session.exercises ?? []).map(e => e._id)} strategy={verticalListSortingStrategy}>
        <div className={styles.sessionExList}>
          {(session.exercises ?? []).map(ex => (
            <SortableExerciseRow
              key={ex._id}
              exercise={ex}
              sessionId={session._id}
              onUpdate={patch => onUpdateExercise(ex._id, patch)}
              onRemove={() => onRemoveExercise(ex._id)}
            />
          ))}
          {(session.exercises ?? []).length === 0 && (
            <div className={styles.colDropHint}>Dra övningar hit</div>
          )}
        </div>
      </SortableContext>

      {/* Footer: add exercise */}
      <div className={styles.sessionColFooter}>
        {showPicker ? (
          <div className={styles.colPicker}>
            <div className={styles.colPickerSearch}>
              <input
                className={styles.colPickerInput}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Sök övning…"
                autoFocus
              />
              <button className={styles.colPickerClose} onClick={() => { setShowPicker(false); setSearch('') }} type="button">Stäng</button>
            </div>
            <div className={styles.colPickerList}>
              {noResults ? (
                <button className={styles.colPickerNew} onClick={() => pick(search.trim())} type="button">
                  + Skapa &quot;{search.trim()}&quot;
                </button>
              ) : (
                sortedGroups.map(([group, exs]) => (
                  <div key={group}>
                    <div className={styles.colPickerGroup}>{group}</div>
                    {exs.map(ex => (
                      <button key={ex.id ?? ex.name} className={styles.colPickerItem} onClick={() => pick(ex.name)} type="button">
                        {ex.name}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <button className={styles.colAddExBtn} onClick={() => setShowPicker(true)} type="button">
            + Lägg till övning
          </button>
        )}
      </div>
    </div>
  )
}

// ── ProgramEditor ────────────────────────────────────────────────

function ProgramEditor({ program, allExercises, onSave, onBack, saveError }) {
  const [name, setName] = useState(program.name ?? '')
  const [sessions, setSessions] = useState(() =>
    (program.sessions ?? []).map(hydrateSession)
  )
  const [saving, setSaving] = useState(false)

  // DnD state
  const [activeId, setActiveId]     = useState(null)
  const [activeType, setActiveType] = useState(null)
  const [activeData, setActiveData] = useState(null)
  const [overColId, setOverColId]   = useState(null)
  const exSessionRef = useRef(null) // tracks current session of dragged exercise

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  function handleDragStart({ active }) {
    setActiveId(active.id)
    setActiveType(active.data.current?.type)
    setActiveData(active.data.current)
    if (active.data.current?.type === 'exercise') {
      exSessionRef.current = active.data.current.sessionId
    }
  }

  function handleDragOver({ active, over }) {
    if (!over) return
    if (active.data.current?.type !== 'exercise') return

    const fromId = exSessionRef.current
    const overT  = over.data.current?.type
    const toId   = overT === 'session' ? over.id : over.data.current?.sessionId

    setOverColId(toId ?? null)

    if (!toId || fromId === toId) return

    // Move exercise across sessions
    setSessions(prev => {
      const fromSession = prev.find(s => s._id === fromId)
      if (!fromSession) return prev
      const exercise = fromSession.exercises.find(e => e._id === active.id)
      if (!exercise) return prev

      const toSession = prev.find(s => s._id === toId)
      if (!toSession) return prev

      const overExIdx = overT === 'exercise'
        ? toSession.exercises.findIndex(e => e._id === over.id)
        : toSession.exercises.length
      const insertAt = overExIdx === -1 ? toSession.exercises.length : overExIdx

      return prev.map(s => {
        if (s._id === fromId) return { ...s, exercises: s.exercises.filter(e => e._id !== active.id) }
        if (s._id === toId) {
          const arr = [...s.exercises]
          arr.splice(insertAt, 0, exercise)
          return { ...s, exercises: arr }
        }
        return s
      })
    })

    exSessionRef.current = toId
  }

  function handleDragEnd({ active, over }) {
    const type = activeType
    setActiveId(null)
    setActiveType(null)
    setActiveData(null)
    setOverColId(null)
    const finalSessionId = exSessionRef.current
    exSessionRef.current = null

    if (!over || active.id === over.id) return

    if (type === 'session') {
      setSessions(prev => {
        const oi = prev.findIndex(s => s._id === active.id)
        const ni = prev.findIndex(s => s._id === over.id)
        if (oi === -1 || ni === -1) return prev
        return arrayMove(prev, oi, ni)
      })
    } else if (type === 'exercise') {
      // Only same-session reorder remains (cross-session was handled in onDragOver)
      const overSessionId = over.data.current?.sessionId
      if (!overSessionId || overSessionId !== finalSessionId) return
      setSessions(prev => {
        const session = prev.find(s => s._id === overSessionId)
        if (!session) return prev
        const oi = session.exercises.findIndex(e => e._id === active.id)
        const ni = session.exercises.findIndex(e => e._id === over.id)
        if (oi === -1 || ni === -1 || oi === ni) return prev
        return prev.map(s => s._id === overSessionId
          ? { ...s, exercises: arrayMove(s.exercises, oi, ni) }
          : s
        )
      })
    }
  }

  function handleDragCancel() {
    setActiveId(null)
    setActiveType(null)
    setActiveData(null)
    setOverColId(null)
    exSessionRef.current = null
  }

  // Session helpers
  function addSession() {
    setSessions(prev => [...prev, newSession()])
  }

  function removeSession(id) {
    setSessions(prev => prev.filter(s => s._id !== id))
  }

  function updateSessionName(id, val) {
    setSessions(prev => prev.map(s => s._id === id ? { ...s, name: val } : s))
  }

  function addExercise(sessionId, exName) {
    setSessions(prev => prev.map(s =>
      s._id === sessionId ? { ...s, exercises: [...s.exercises, newExercise(exName)] } : s
    ))
  }

  function removeExercise(sessionId, exId) {
    setSessions(prev => prev.map(s =>
      s._id === sessionId ? { ...s, exercises: s.exercises.filter(e => e._id !== exId) } : s
    ))
  }

  function updateExercise(sessionId, exId, patch) {
    setSessions(prev => prev.map(s =>
      s._id === sessionId
        ? { ...s, exercises: s.exercises.map(e => e._id === exId ? { ...e, ...patch } : e) }
        : s
    ))
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        is_global: true,
        sessions: sessions.map(({ _id, ...s }) => ({
          ...s,
          exercises: (s.exercises ?? []).map(({ _id: _eid, ...e }) => e),
        })),
      })
    } finally { setSaving(false) }
  }

  // Find dragged items for overlay
  const draggedExercise = activeType === 'exercise'
    ? sessions.flatMap(s => s.exercises).find(e => e._id === activeId)
    : null
  const draggedSession = activeType === 'session'
    ? sessions.find(s => s._id === activeId)
    : null

  return (
    <div className={styles.progEditor}>
      {/* Top bar */}
      <div className={styles.progEditorTop}>
        <button className={styles.backLinkBtn} onClick={onBack} type="button">← Tillbaka</button>
        <input
          className={styles.progNameInput}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Programnamn"
        />
        <button className={styles.saveProgBtn} onClick={handleSave} disabled={!name.trim() || saving} type="button">
          {saving ? 'Sparar…' : 'Spara program'}
        </button>
      </div>

      {saveError && <div className={styles.saveErrorBanner}>Fel: {saveError}</div>}

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={sessions.map(s => s._id)} strategy={horizontalListSortingStrategy}>
          <div className={styles.boardScroll}>
            <div className={styles.board}>
              {sessions.map(session => (
                <SessionColumn
                  key={session._id}
                  session={session}
                  allExercises={allExercises}
                  isOver={overColId === session._id && activeType === 'exercise'}
                  onUpdateName={val => updateSessionName(session._id, val)}
                  onAddExercise={name => addExercise(session._id, name)}
                  onRemoveExercise={exId => removeExercise(session._id, exId)}
                  onUpdateExercise={(exId, patch) => updateExercise(session._id, exId, patch)}
                  onRemoveSession={() => removeSession(session._id)}
                />
              ))}

              <button className={styles.addSessionCol} onClick={addSession} type="button">
                <span className={styles.addSessionColPlus}>+</span>
                Lägg till pass
              </button>
            </div>
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {draggedExercise && (
            <div className={styles.dragOverlayExercise}>
              <div className={styles.dragOverlayExName}>{draggedExercise.name}</div>
              <div className={styles.dragOverlayExMeta}>
                {draggedExercise.workSets ?? 3} set{(draggedExercise.repsMin || draggedExercise.repsMax) ? ` · ${draggedExercise.repsMin ?? ''}–${draggedExercise.repsMax ?? ''} reps` : ''}
              </div>
            </div>
          )}
          {draggedSession && (
            <div className={styles.dragOverlaySession}>
              {draggedSession.name}
              <span className={styles.dragOverlaySessionMeta}> · {(draggedSession.exercises ?? []).length} öv.</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ── ExercisesTab ────────────────────────────────────────────────

function ExercisesTab() {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(null)        // draft for detail panel
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    adminGetExercises().then(data => {
      setExercises(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = exercises.filter(ex => {
    const matchSearch = !search.trim() || ex.name.toLowerCase().includes(search.toLowerCase())
    const matchGroup = !filterGroup || ex.muscle_group === filterGroup
    return matchSearch && matchGroup
  })

  // Group filtered exercises by muscle group for display
  const groups = filtered.reduce((acc, ex) => {
    const g = ex.muscle_group || 'Övrigt'
    if (!acc[g]) acc[g] = []
    acc[g].push(ex)
    return acc
  }, {})
  const sortedGroups = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b, 'sv'))

  function selectExercise(ex) {
    setSelectedId(ex.id)
    setForm({
      name: ex.name ?? '',
      muscle_group: ex.muscle_group ?? '',
      secondary_muscle: ex.secondary_muscle ?? '',
      equipment: ex.equipment ?? '',
      movement_pattern: ex.movement_pattern ?? '',
      notes: ex.notes ?? '',
    })
    setSaveError(null)
    setDeleteConfirm(false)
  }

  function startNew() {
    setSelectedId('__new__')
    setForm({ name: '', muscle_group: '', secondary_muscle: '', equipment: '', movement_pattern: '', notes: '' })
    setSaveError(null)
    setDeleteConfirm(false)
  }

  function friendlyError(e) {
    const msg = e?.message ?? ''
    if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
      return 'Det finns redan en övning med det namnet. Välj ett annat namn.'
    }
    return msg || 'Något gick fel. Försök igen.'
  }

  async function handleSave() {
    if (!form?.name?.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      if (selectedId === '__new__') {
        const saved = await adminSaveExercise({
          name: form.name.trim(),
          muscle_group: form.muscle_group || null,
          secondary_muscle: form.secondary_muscle || null,
          equipment: form.equipment || null,
          movement_pattern: form.movement_pattern || null,
          notes: form.notes || null,
        })
        setExercises(prev => [...prev, saved].sort((a, b) => {
          const g = (a.muscle_group ?? '').localeCompare(b.muscle_group ?? '', 'sv')
          return g !== 0 ? g : a.name.localeCompare(b.name, 'sv')
        }))
        setSelectedId(saved.id)
      } else {
        const updated = await adminUpdateExercise(selectedId, {
          name: form.name.trim(),
          muscle_group: form.muscle_group || null,
          secondary_muscle: form.secondary_muscle || null,
          equipment: form.equipment || null,
          movement_pattern: form.movement_pattern || null,
          notes: form.notes || null,
        })
        setExercises(prev => prev.map(e => e.id === selectedId ? updated : e))
      }
    } catch (e) {
      setSaveError(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await adminDeleteExercise(selectedId)
      setExercises(prev => prev.filter(e => e.id !== selectedId))
      setSelectedId(null)
      setForm(null)
    } catch (e) { setSaveError(friendlyError(e)) }
    finally { setSaving(false) }
  }

  const selectedEx = selectedId && selectedId !== '__new__'
    ? exercises.find(e => e.id === selectedId)
    : null

  if (loading) return <div className={styles.loading}><div className="spinner" /></div>

  return (
    <div className={styles.exMasterDetail}>
      {/* ── Exercise list panel ── */}
      <div className={styles.exListPanel}>
        <div className={styles.exListTop}>
          <input
            className={styles.exListSearch}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Sök övning…"
          />
          <button className={styles.addBtn} onClick={startNew} type="button">+ Ny</button>
        </div>

        {/* Muscle group chips */}
        <div className={styles.exListChips}>
          <button
            className={`${styles.exListChip} ${!filterGroup ? styles.exListChipActive : ''}`}
            onClick={() => setFilterGroup(null)}
            type="button"
          >Alla</button>
          {MUSCLE_GROUPS.map(g => (
            <button
              key={g}
              className={`${styles.exListChip} ${filterGroup === g ? styles.exListChipActive : ''}`}
              onClick={() => setFilterGroup(fg => fg === g ? null : g)}
              type="button"
            >{g}</button>
          ))}
        </div>

        <div className={styles.exListItems}>
          {filtered.length === 0 && (
            <p className={styles.empty} style={{ padding: '16px' }}>Inga övningar.</p>
          )}
          {sortedGroups.map(([group, exs]) => (
            <div key={group}>
              <div className={styles.exListGroup}>{group}</div>
              {exs.map(ex => (
                <button
                  key={ex.id}
                  className={`${styles.exListItem} ${selectedId === ex.id ? styles.exListItemActive : ''}`}
                  onClick={() => selectExercise(ex)}
                  type="button"
                >
                  <span className={styles.exListItemName}>{ex.name}</span>
                  {ex.equipment && <span className={styles.exListItemMeta}>{ex.equipment}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Detail panel ── */}
      <div className={styles.exDetailPanel}>
        {!form ? (
          <div className={styles.exDetailEmpty}>
            <p>Välj en övning för att redigera</p>
            <button className={styles.addBtn} onClick={startNew} type="button">+ Ny övning</button>
          </div>
        ) : (
          <div className={styles.exDetailForm}>
            <div className={styles.exDetailHeader}>
              <h2 className={styles.exDetailTitle}>
                {selectedId === '__new__' ? 'Ny övning' : (selectedEx?.name ?? 'Redigera')}
              </h2>
              {selectedId !== '__new__' && selectedEx && !selectedEx.is_builtin && (
                <button
                  className={styles.deleteRowBtn}
                  onClick={() => setDeleteConfirm(true)}
                  type="button"
                >Ta bort</button>
              )}
            </div>

            {deleteConfirm && (
              <div className={styles.deleteConfirmBar}>
                <span>Ta bort &quot;{selectedEx?.name}&quot;?</span>
                <button className={styles.confirmDeleteBtn} onClick={handleDelete} disabled={saving} type="button">Ja, ta bort</button>
                <button className={styles.cancelRowBtn} onClick={() => setDeleteConfirm(false)} type="button">Avbryt</button>
              </div>
            )}

            {saveError && <div className={styles.saveErrorBanner} style={{ margin: '0 0 12px' }}>{saveError}</div>}

            <div className={styles.exDetailFields}>
              <div className={styles.exDetailField}>
                <label className={styles.exDetailLabel}>Namn</label>
                <input
                  className={styles.cellInput}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Övningsnamn"
                  autoFocus={selectedId === '__new__'}
                />
              </div>

              <div className={styles.exDetailFieldRow}>
                <div className={styles.exDetailField}>
                  <label className={styles.exDetailLabel}>Muskelgrupp</label>
                  <select
                    className={styles.cellSelect}
                    value={form.muscle_group}
                    onChange={e => setForm(f => ({ ...f, muscle_group: e.target.value }))}
                    style={{ width: '100%' }}
                  >
                    <option value="">—</option>
                    {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div className={styles.exDetailField}>
                  <label className={styles.exDetailLabel}>Sekundär muskelgrupp</label>
                  <select
                    className={styles.cellSelect}
                    value={form.secondary_muscle}
                    onChange={e => setForm(f => ({ ...f, secondary_muscle: e.target.value }))}
                    style={{ width: '100%' }}
                  >
                    <option value="">Ingen</option>
                    {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div className={styles.exDetailField}>
                  <label className={styles.exDetailLabel}>Utrustning</label>
                  <select
                    className={styles.cellSelect}
                    value={form.equipment}
                    onChange={e => setForm(f => ({ ...f, equipment: e.target.value }))}
                    style={{ width: '100%' }}
                  >
                    <option value="">—</option>
                    {EQUIPMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div className={styles.exDetailField}>
                  <label className={styles.exDetailLabel}>Rörelsemönster</label>
                  <select
                    className={styles.cellSelect}
                    value={form.movement_pattern}
                    onChange={e => setForm(f => ({ ...f, movement_pattern: e.target.value }))}
                    style={{ width: '100%' }}
                  >
                    <option value="">—</option>
                    {MOVEMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.exDetailField}>
                <label className={styles.exDetailLabel}>Instruktioner / anteckningar</label>
                <textarea
                  className={styles.exDetailTextarea}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Tekniknoteringar, coaching cues…"
                  rows={5}
                />
              </div>
            </div>

            <div className={styles.exDetailActions}>
              <button
                className={styles.saveProgBtn}
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
                type="button"
              >
                {saving ? 'Sparar…' : 'Spara'}
              </button>
              <button
                className={styles.cancelRowBtn}
                onClick={() => { setSelectedId(null); setForm(null) }}
                type="button"
              >Avbryt</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ProgramsTab ─────────────────────────────────────────────────

function ProgramsTab({ allExercises }) {
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    adminGetGlobalPrograms().then(setPrograms).finally(() => setLoading(false))
  }, [])

  async function handleSaveProg(payload) {
    setSaveError(null)
    try {
      if (editing._isNew) {
        const saved = await adminSaveProgram({ ...payload, is_global: true, user_id: null })
        setPrograms(prev => [...prev, saved])
      } else {
        const updated = await adminUpdateProgram(editing.id, { ...payload, is_global: true })
        setPrograms(prev => prev.map(p => p.id === editing.id ? updated : p))
      }
      setEditing(null)
    } catch (e) {
      console.error('adminSaveProgram error:', e)
      setSaveError(e.message ?? 'Okänt fel vid sparning')
    }
  }

  async function handleDelete(id) {
    try {
      await adminDeleteProgram(id)
      setPrograms(prev => prev.filter(p => p.id !== id))
      setDeleteConfirm(null)
    } catch (e) { alert('Fel: ' + e.message) }
  }

  if (loading) return <div className={styles.loading}><div className="spinner" /></div>

  if (editing) {
    return (
      <ProgramEditor
        program={editing}
        allExercises={allExercises}
        onSave={handleSaveProg}
        onBack={() => { setEditing(null); setSaveError(null) }}
        saveError={saveError}
      />
    )
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarInfo}>{programs.length} globala program</span>
        <button
          className={styles.addBtn}
          onClick={() => setEditing({ _isNew: true, name: '', sessions: [], is_global: true })}
          type="button"
        >
          + Nytt globalt program
        </button>
      </div>

      <div className={styles.progList}>
        {programs.length === 0 && <p className={styles.empty}>Inga globala program ännu.</p>}
        {programs.map(prog => (
          <div key={prog.id} className={styles.progCard}>
            <div className={styles.progCardInfo}>
              <span className={styles.progCardName}>{prog.name}</span>
              <span className={styles.progCardMeta}>
                {(prog.sessions ?? []).length} pass ·{' '}
                {(prog.sessions ?? []).reduce((n, s) => n + (s.exercises ?? []).length, 0)} övningar
              </span>
            </div>
            <div className={styles.rowActions}>
              {deleteConfirm === prog.id ? (
                <>
                  <button className={styles.confirmDeleteBtn} onClick={() => handleDelete(prog.id)} type="button">Ja, ta bort</button>
                  <button className={styles.cancelRowBtn} onClick={() => setDeleteConfirm(null)} type="button">Avbryt</button>
                </>
              ) : (
                <>
                  <button className={styles.editRowBtn} onClick={() => setEditing(prog)} type="button">Redigera</button>
                  <button className={styles.deleteRowBtn} onClick={() => setDeleteConfirm(prog.id)} type="button">Ta bort</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── UsersTab ────────────────────────────────────────────────────

function UsersTab() {
  const [workouts, setWorkouts]   = useState([])
  const [profiles, setProfiles]   = useState({})   // { userId: displayName }
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [editingName, setEditingName] = useState({}) // { userId: draftName }
  const [savingName, setSavingName]   = useState(null)

  useEffect(() => {
    Promise.all([adminGetWorkouts(), adminGetProfiles()])
      .then(([wks, profs]) => {
        setWorkouts(wks)
        setProfiles(Object.fromEntries(profs.map(p => [p.id, p.display_name ?? ''])))
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function saveName(userId) {
    const draft = editingName[userId] ?? ''
    setSavingName(userId)
    try {
      await adminUpsertProfile(userId, draft)
      setProfiles(prev => ({ ...prev, [userId]: draft }))
      setEditingName(prev => { const c = { ...prev }; delete c[userId]; return c })
    } catch (e) { alert('Fel: ' + e.message) }
    finally { setSavingName(null) }
  }

  if (loading) return <div className={styles.loading}><div className="spinner" /></div>
  if (error) return <p className={styles.errorMsg}>Fel: {error}</p>

  // Start from all known profiles so we include users without workouts too
  const byUser = {}
  for (const userId of Object.keys(profiles)) {
    byUser[userId] = { userId, count: 0, lastAt: null }
  }
  for (const w of workouts) {
    if (!byUser[w.user_id]) byUser[w.user_id] = { userId: w.user_id, count: 0, lastAt: w.finished_at }
    byUser[w.user_id].count++
    if (!byUser[w.user_id].lastAt || w.finished_at > byUser[w.user_id].lastAt) {
      byUser[w.user_id].lastAt = w.finished_at
    }
  }
  const users = Object.values(byUser).sort((a, b) => b.count - a.count)

  return (
    <div className={styles.tabContent}>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statCardValue}>{users.length}</div>
          <div className={styles.statCardLabel}>Aktiva användare</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardValue}>{workouts.length}</div>
          <div className={styles.statCardLabel}>Loggade pass (senaste 1000)</div>
        </div>
      </div>
      <div className={styles.tableWrap} style={{ marginTop: 24 }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th} style={{ width: 160 }}>Namn</th>
              <th className={styles.th}>User ID</th>
              <th className={styles.th} style={{ width: 100 }}>Antal pass</th>
              <th className={styles.th} style={{ width: 140 }}>Senaste aktivitet</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const isEditing = u.userId in editingName
              const draft = editingName[u.userId] ?? ''
              const saved = profiles[u.userId] ?? ''
              return (
                <tr key={u.userId} className={styles.tr}>
                  <td className={styles.td}>
                    {isEditing ? (
                      <input
                        className={styles.cellInput}
                        value={draft}
                        autoFocus
                        placeholder="Namn…"
                        onChange={e => setEditingName(prev => ({ ...prev, [u.userId]: e.target.value }))}
                        onBlur={() => saveName(u.userId)}
                        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingName(prev => { const c = { ...prev }; delete c[u.userId]; return c }) }}
                        disabled={savingName === u.userId}
                        style={{ width: '100%' }}
                      />
                    ) : (
                      <button
                        className={styles.nameCellBtn}
                        onClick={() => setEditingName(prev => ({ ...prev, [u.userId]: saved }))}
                        type="button"
                        title="Klicka för att redigera"
                      >
                        {saved || <span className={styles.nameCellEmpty}>Namnlös</span>}
                      </button>
                    )}
                  </td>
                  <td className={styles.td}><span className={styles.monoText}>{u.userId}</span></td>
                  <td className={styles.td}><span className={styles.cellText}>{u.count}</span></td>
                  <td className={styles.td}><span className={styles.cellText}>{new Date(u.lastAt).toLocaleDateString('sv-SE')}</span></td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr><td colSpan={4} className={styles.emptyTd}>Inga pass loggade ännu.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── StatsTab ────────────────────────────────────────────────────

function StatsTab() {
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    adminGetWorkouts().then(setWorkouts).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className={styles.loading}><div className="spinner" /></div>
  if (error) return <p className={styles.errorMsg}>Fel: {error}</p>

  const users = new Set(workouts.map(w => w.user_id)).size
  const totalSets = workouts.reduce((n, w) =>
    n + (w.exercises ?? []).reduce((m, e) =>
      m + (e.sets ?? []).filter(s => s.done && s.type === 'work').length, 0), 0)

  const exCount = {}
  for (const w of workouts) {
    for (const e of (w.exercises ?? [])) {
      exCount[e.name] = (exCount[e.name] ?? 0) + 1
    }
  }
  const top10 = Object.entries(exCount).sort((a, b) => b[1] - a[1]).slice(0, 10)

  return (
    <div className={styles.tabContent}>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statCardValue}>{users}</div>
          <div className={styles.statCardLabel}>Totalt antal användare</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardValue}>{workouts.length}</div>
          <div className={styles.statCardLabel}>Totalt antal pass</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardValue}>{totalSets}</div>
          <div className={styles.statCardLabel}>Totalt antal set</div>
        </div>
      </div>
      <div className={styles.sectionLabel} style={{ marginTop: 32, marginBottom: 12 }}>
        Populäraste övningar — topp 10
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.thCenter}`} style={{ width: 50 }}>#</th>
              <th className={styles.th}>Övning</th>
              <th className={styles.th} style={{ width: 140 }}>Förekomster</th>
            </tr>
          </thead>
          <tbody>
            {top10.map(([exName, count], i) => (
              <tr key={exName} className={styles.tr}>
                <td className={`${styles.td} ${styles.tdCenter}`}><span className={styles.rankText}>{i + 1}</span></td>
                <td className={styles.td}><span className={styles.cellName}>{exName}</span></td>
                <td className={styles.td}><span className={styles.cellText}>{count}</span></td>
              </tr>
            ))}
            {top10.length === 0 && (
              <tr><td colSpan={3} className={styles.emptyTd}>Inga data ännu.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────

const TABS = [
  { id: 'exercises', label: 'Övningar' },
  { id: 'programs', label: 'Globala program' },
  { id: 'users', label: 'Användare' },
  { id: 'stats', label: 'Statistik' },
]

export default function Admin() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('admin_auth') === '1')
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)
  const [tab, setTab] = useState('exercises')
  const [allExercises, setAllExercises] = useState([])

  useEffect(() => {
    if (!unlocked) return
    adminGetExercises().then(setAllExercises).catch(() => {})
  }, [unlocked])

  function handleUnlock(e) {
    e.preventDefault()
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_auth', '1')
      setUnlocked(true)
    } else {
      setPwError(true)
      setPw('')
    }
  }

  if (!unlocked) {
    return (
      <div className={styles.gate}>
        <div className={styles.gateLogo}>🍌</div>
        <h2 className={styles.gateTitle}>Gymbanan Admin</h2>
        <form className={styles.gateForm} onSubmit={handleUnlock}>
          <input
            className={`${styles.gateInput} ${pwError ? styles.inputError : ''}`}
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setPwError(false) }}
            placeholder="Lösenord"
            autoFocus
            autoComplete="current-password"
          />
          {pwError && <p className={styles.gateError}>Fel lösenord</p>}
          <button className={styles.gateBtn} type="submit">Lås upp</button>
        </form>
      </div>
    )
  }

  return (
    <div className={styles.adminLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <span className={styles.brandIcon}>🍌</span>
          <div className={styles.brandText}>
            <span className={styles.brandName}>Gymbanan</span>
            <span className={styles.brandSub}>Admin</span>
          </div>
        </div>
        <nav className={styles.sidebarNav}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`${styles.navItem} ${tab === t.id ? styles.navItemActive : ''}`}
              onClick={() => setTab(t.id)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </nav>
        <button
          className={styles.logoutBtn}
          onClick={() => { sessionStorage.removeItem('admin_auth'); setUnlocked(false) }}
          type="button"
        >
          Logga ut
        </button>
      </aside>

      <main className={styles.content}>
        <div className={styles.contentHeader}>
          <h1 className={styles.contentTitle}>{TABS.find(t => t.id === tab)?.label}</h1>
        </div>
        <div className={styles.contentBody}>
          {tab === 'exercises' && <ExercisesTab />}
          {tab === 'programs' && <ProgramsTab allExercises={allExercises} />}
          {tab === 'users' && <UsersTab />}
          {tab === 'stats' && <StatsTab />}
        </div>
      </main>
    </div>
  )
}
