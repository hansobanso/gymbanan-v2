import { useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { ProgramMuscleSetSummary } from './MuscleSetSummary'
import styles from './ProgramEdit.module.css'

function newSession() {
  return {
    _id: Math.random().toString(36).slice(2),
    _isNew: true,
    name: 'Nytt pass',
    exercises: [],
  }
}

function SessionItem({ session, deleteConfirmId, setDeleteConfirmId, handleDeleteSession, onEditSession, setSessions }) {
  const dragControls = useDragControls()
  const isConfirming = deleteConfirmId === session._id

  return (
    <Reorder.Item
      value={session}
      as="div"
      className={styles.sessionItem}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      whileDrag={{
        scale: 1.02,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        zIndex: 10,
      }}
      transition={{ type: 'spring', stiffness: 600, damping: 40 }}
    >
      <span
        className={styles.dragHandle}
        onPointerDown={(e) => {
          // Only left mouse button or touch
          if (e.button !== undefined && e.button !== 0) return
          dragControls.start(e)
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <div className={styles.sessionInfo}>
        <span className={styles.sessionName}>{session.name}</span>
        <span className={styles.sessionMeta}>
          {(session.exercises ?? []).length} övningar
        </span>
      </div>
      {isConfirming ? (
        <div className={styles.deleteConfirm}>
          <button
            className={styles.deleteConfirmYes}
            onClick={() => handleDeleteSession(session._id)}
            type="button"
          >Ta bort</button>
          <button
            className={styles.deleteConfirmNo}
            onClick={() => setDeleteConfirmId(null)}
            type="button"
          >Avbryt</button>
        </div>
      ) : (
        <>
          <button
            className={styles.editBtn}
            onClick={() => onEditSession(session, newSessions => setSessions(newSessions))}
            type="button"
          >
            Redigera
          </button>
          <button
            className={styles.sessionDeleteBtn}
            onClick={() => setDeleteConfirmId(session._id)}
            type="button"
            aria-label="Ta bort pass"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 6H21M8 6V4H16V6M19 6L18.1 20H5.9L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      )}
    </Reorder.Item>
  )
}

export default function ProgramEdit({ program, allExercises, onSave, onDelete, onBack, onEditSession, saveError, activeProgramId, onSetActive }) {
  const [name, setName] = useState(program.name ?? '')
  const [sessions, setSessions] = useState(
    (program.sessions ?? []).map(s => ({ _id: Math.random().toString(36).slice(2), ...s }))
  )
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({
        ...program,
        name: name.trim(),
        sessions: sessions.map(({ _id, ...rest }) => rest),
      })
    } finally {
      setSaving(false)
    }
  }

  function handleAddSession() {
    const s = newSession()
    setSessions(prev => [...prev, s])
    onEditSession(s, newSessions => setSessions(newSessions))
  }

  function handleDeleteSession(id) {
    setSessions(prev => prev.filter(s => s._id !== id))
    setDeleteConfirmId(null)
  }

  return (
    <div className={styles.view}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack} type="button" aria-label="Tillbaka">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className={styles.topBarTitle}>Redigera program</span>
        <div style={{ width: 36 }} />
      </div>

      <div className={styles.scroll}>
        {/* Programnamn */}
        <div className={styles.section}>
          <label className={styles.label}>Programnamn</label>
          <input
            className={styles.nameInput}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="T.ex. Push/Pull/Ben"
          />
        </div>

        {/* Pass */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.label}>Pass</span>
            <button className={styles.addBtn} onClick={handleAddSession} type="button">
              + Lägg till pass
            </button>
          </div>

          {sessions.length === 0 && (
            <p className={styles.empty}>Inga pass – lägg till ett pass för att komma igång.</p>
          )}

          <Reorder.Group
            axis="y"
            values={sessions}
            onReorder={setSessions}
            as="div"
            className={styles.sessionList}
          >
            {sessions.map(s => (
              <SessionItem
                key={s._id}
                session={s}
                deleteConfirmId={deleteConfirmId}
                setDeleteConfirmId={setDeleteConfirmId}
                handleDeleteSession={handleDeleteSession}
                onEditSession={onEditSession}
                setSessions={setSessions}
              />
            ))}
          </Reorder.Group>
        </div>

        {sessions.length > 0 && (
          <div className={styles.summarySection}>
            <ProgramMuscleSetSummary sessions={sessions} allExercises={allExercises} />
          </div>
        )}
      </div>

      <div className={styles.footer}>
        {saveError && (
          <div className={styles.saveErrorBanner}>
            Kunde inte spara: {saveError}
          </div>
        )}
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={!name.trim() || saving}
          type="button"
        >
          {saving ? 'Sparar…' : 'Spara program'}
        </button>
        {!program._isNew && (
          <button
            className={activeProgramId === program.id ? styles.setActiveBtnActive : styles.setActiveBtn}
            onClick={() => onSetActive(program.id)}
            type="button"
            disabled={activeProgramId === program.id}
          >
            {activeProgramId === program.id ? '✓ Aktivt program' : 'Sätt som aktivt program'}
          </button>
        )}
        {!program._isNew && (
          showDeleteConfirm ? (
            <div className={styles.deleteProgramConfirm}>
              <p className={styles.deleteProgramConfirmText}>
                Är du säker på att du vill ta bort <strong>{name || 'programmet'}</strong>? Det går inte att ångra.
              </p>
              <div className={styles.deleteProgramConfirmBtns}>
                <button
                  className={styles.deleteProgramConfirmYes}
                  onClick={() => onDelete(program)}
                  type="button"
                >Ta bort</button>
                <button
                  className={styles.deleteProgramConfirmNo}
                  onClick={() => setShowDeleteConfirm(false)}
                  type="button"
                >Avbryt</button>
              </div>
            </div>
          ) : (
            <button
              className={styles.deleteBtn}
              onClick={() => setShowDeleteConfirm(true)}
              type="button"
            >
              Ta bort program
            </button>
          )
        )}
      </div>
    </div>
  )
}
