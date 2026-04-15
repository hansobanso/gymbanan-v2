import { useState } from 'react'
import { Reorder } from 'framer-motion'
import styles from './ProgramEdit.module.css'

function newSession() {
  return {
    _id: Math.random().toString(36).slice(2),
    _isNew: true,
    name: 'Nytt pass',
    exercises: [],
  }
}

export default function ProgramEdit({ program, onSave, onDelete, onBack, onEditSession, saveError, activeProgramId, onSetActive }) {
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
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
              <Reorder.Item key={s._id} value={s} as="div" className={styles.sessionItem}>
                <span className={styles.dragHandle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </span>
                <div className={styles.sessionInfo}>
                  <span className={styles.sessionName}>{s.name}</span>
                  <span className={styles.sessionMeta}>
                    {(s.exercises ?? []).length} övningar
                  </span>
                </div>
                {deleteConfirmId === s._id ? (
                  <div className={styles.deleteConfirm}>
                    <button
                      className={styles.deleteConfirmYes}
                      onClick={() => handleDeleteSession(s._id)}
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
                      onClick={() => onEditSession(s, newSessions => setSessions(newSessions))}
                      type="button"
                    >
                      Redigera
                    </button>
                    <button
                      className={styles.sessionDeleteBtn}
                      onClick={() => setDeleteConfirmId(s._id)}
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
            ))}
          </Reorder.Group>
        </div>
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
