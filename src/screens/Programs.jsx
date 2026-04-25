import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { saveProgram, updateProgram, deleteProgram, getExercises } from '../lib/db'
import ProgramEdit from '../components/settings/ProgramEdit'
import SessionEdit from '../components/settings/SessionEdit'
import styles from './Programs.module.css'

const ADMIN_EMAIL = 'hannes@hannesisaksson.com'

function newProgram() {
  return { _id: Date.now().toString(), _isNew: true, name: '', sessions: [] }
}

const SLIDE = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
  transition: { type: 'spring', stiffness: 380, damping: 36 },
}

export default function Programs({ session, programs, setPrograms, activeProgramId, onSetActive }) {
  const [allExercises, setAllExercises] = useState([])
  const [loading, setLoading]           = useState(true)
  const [saveError, setSaveError]       = useState(null)
  const [editingProgram, setEditingProgram] = useState(null)
  const [editingSession, setEditingSession] = useState(null)

  const isAdmin = session?.user?.email === ADMIN_EMAIL

  useEffect(() => {
    getExercises()
      .then(exs => setAllExercises(exs))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleProgramSave(program) {
    setSaveError(null)
    try {
      if (program._isNew || !program.id) {
        const { _id, _isNew, ...rest } = program
        const saved = await saveProgram({
          name: rest.name,
          sessions: rest.sessions ?? [],
          is_global: false,
          user_id: session.user.id,
          created_by: session.user.id,
        })
        setPrograms(prev => [...prev, saved])
      } else {
        const { _id, _isNew, ...rest } = program
        const updated = await updateProgram(program.id, { name: rest.name, sessions: rest.sessions ?? [] })
        setPrograms(prev => prev.map(p => p.id === updated.id ? updated : p))
      }
      setEditingProgram(null)
    } catch (err) {
      setSaveError(err?.message ?? String(err))
    }
  }

  async function handleProgramDelete(program) {
    try {
      if (program.id) await deleteProgram(program.id)
      setPrograms(prev => prev.filter(p => p.id !== program.id))
      setEditingProgram(null)
    } catch (err) {
      alert(`Kunde inte ta bort program: ${err.message}`)
    }
  }

  async function handleCopyProgram(program) {
    setSaveError(null)
    try {
      const saved = await saveProgram({
        name: `${program.name} (kopia)`,
        sessions: program.sessions ?? [],
        is_global: false,
        user_id: session.user.id,
        created_by: session.user.id,
      })
      setPrograms(prev => [...prev, saved])
      setEditingProgram({ _id: saved.id, ...saved })
    } catch (err) {
      setSaveError(err?.message ?? String(err))
    }
  }

  function handleEditSession(s, setSessions) {
    setEditingSession({ session: s, setSessions })
  }

  function handleSessionSave(updatedSession) {
    if (editingSession?.setSessions) {
      editingSession.setSessions(prev => {
        const exists = prev.find(s => s._id === updatedSession._id)
        return exists
          ? prev.map(s => s._id === updatedSession._id ? updatedSession : s)
          : [...prev, updatedSession]
      })
    }
    setEditingSession(null)
  }

  function handleSessionDelete(targetSession) {
    if (editingSession?.setSessions) {
      editingSession.setSessions(prev => prev.filter(s => s._id !== targetSession._id))
    }
    setEditingSession(null)
  }

  function openProgram(p) {
    const isGlobal = p.user_id === null
    if (isGlobal && !isAdmin) {
      // Non-admin: copy instead of edit
      handleCopyProgram(p)
    } else {
      setEditingProgram({ _id: p.id, ...p })
    }
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Program</h1>
        <button
          className={styles.headerAddBtn}
          onClick={() => setEditingProgram(newProgram())}
          type="button"
          aria-label="Nytt program"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14"/>
            <path d="M12 5v14"/>
          </svg>
        </button>
      </header>

      <div className={styles.body}>
        {loading && [0, 1, 2].map(i => <div key={i} className={styles.skeleton} />)}

        {!loading && programs.map(p => {
          const isActive = p.id === activeProgramId
          const isGlobal = p.user_id === null
          return (
            <button
              key={p.id}
              className={`${styles.programCard} ${isActive ? styles.programCardActive : ''}`}
              onClick={() => openProgram(p)}
              type="button"
            >
              <div className={styles.programCardInfo}>
                <span className={`${styles.programCardName} ${isActive ? styles.programCardNameActive : ''}`}>
                  {p.name}
                </span>
                <div className={styles.programCardMeta}>
                  <span>{(p.sessions ?? []).length} pass</span>
                  {isGlobal && <span className={styles.globalBadge}>Global</span>}
                  {isGlobal && !isAdmin && <span className={styles.globalBadge}>Tryck för att kopiera</span>}
                </div>
              </div>
              <div className={styles.programCardRight}>
                {isActive && <span className={styles.activeCheck}>✓</span>}
                <span className={styles.chevron}>›</span>
              </div>
            </button>
          )
        })}
      </div>

      <AnimatePresence>
        {editingProgram && (
          <motion.div key="editProgram" className={styles.overlay} {...SLIDE}>
            <ProgramEdit
              program={editingProgram}
              allExercises={allExercises}
              onSave={handleProgramSave}
              onDelete={handleProgramDelete}
              onBack={() => { setEditingProgram(null); setSaveError(null) }}
              onEditSession={handleEditSession}
              saveError={saveError}
              activeProgramId={activeProgramId}
              onSetActive={onSetActive}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingSession && (
          <motion.div key="editSession" className={`${styles.overlay} ${styles.overlayTop}`} {...SLIDE}>
            <SessionEdit
              session={editingSession.session}
              allExercises={allExercises}
              onSave={handleSessionSave}
              onDelete={handleSessionDelete}
              onBack={() => setEditingSession(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
