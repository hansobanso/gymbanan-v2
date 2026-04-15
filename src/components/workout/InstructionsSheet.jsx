import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getExerciseByName, upsertExerciseByName } from '../../lib/db'
import styles from './InstructionsSheet.module.css'

export default function InstructionsSheet({ open, exerciseName, userId, onClose }) {
  const [exercise, setExercise] = useState(null)
  const [editing, setEditing] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !exerciseName) {
      setExercise(null)
      setEditing(false)
      return
    }
    getExerciseByName(exerciseName).then(ex => {
      setExercise(ex)
      setInstructions(ex?.instructions ?? '')
      setNotes(ex?.notes ?? '')
    }).catch(() => {})
  }, [open, exerciseName])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      const saved = await upsertExerciseByName(
        exerciseName,
        { instructions: instructions || null, notes: notes || null },
        userId
      )
      setExercise(saved)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const hasContent = instructions.trim() || notes.trim()

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={styles.sheet}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.handle} />
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <span className={styles.title}>{exerciseName}</span>
                <span className={styles.subtitle}>Instruktioner</span>
              </div>
              <div className={styles.headerBtns}>
                {!editing && (
                  <button className={styles.editBtn} onClick={() => setEditing(true)} type="button" aria-label="Redigera">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
                <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Stäng">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className={styles.body}>
              {editing ? (
                <>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Instruktioner</label>
                    <textarea
                      className={styles.textarea}
                      value={instructions}
                      onChange={e => setInstructions(e.target.value)}
                      placeholder="Teknikpunkter, cues…"
                      rows={6}
                      autoFocus
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Anteckningar</label>
                    <textarea
                      className={styles.textarea}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Kortare noteringar…"
                      rows={3}
                    />
                  </div>
                  <div className={styles.editFooter}>
                    <button className={styles.saveBtn} onClick={handleSave} disabled={saving} type="button">
                      {saving ? 'Sparar…' : 'Spara'}
                    </button>
                    <button className={styles.cancelBtn} onClick={() => { setEditing(false); setInstructions(exercise?.instructions ?? ''); setNotes(exercise?.notes ?? '') }} type="button">
                      Avbryt
                    </button>
                  </div>
                </>
              ) : hasContent ? (
                <>
                  {instructions.trim() && (
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Instruktioner</label>
                      <p className={styles.text}>{instructions}</p>
                    </div>
                  )}
                  {notes.trim() && (
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Anteckningar</label>
                      <p className={styles.text}>{notes}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.empty}>
                  <p>Inga instruktioner än.</p>
                  <button className={styles.emptyAdd} onClick={() => setEditing(true)} type="button">
                    + Lägg till instruktioner
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
