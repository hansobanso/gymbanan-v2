import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { getExerciseByName, updateExercise, upsertExerciseByName, getUserExerciseNote, upsertUserExerciseNote } from '../lib/db'
import { EXERCISES, MUSCLE_GROUPS } from '../data/exercises'
import detailStyles from './ExerciseDetail.module.css'
import styles from './ExerciseDetailSheet.module.css'

const EQUIPMENT = ['Skivstång', 'Hantel', 'Maskin', 'Kabel', 'Kroppsvikt', 'Övrigt']
const MOVEMENT  = ['Press', 'Drag', 'Squat', 'Hinge', 'Carry', 'Övrigt']

function builtinDefaults(name) {
  const data = EXERCISES[name] ?? {}
  return {
    name,
    muscle_group:     data.muscle_group ?? '',
    secondary_muscle: data.secondary_muscle ?? '',
    equipment:        '',
    movement_pattern: '',
    default_rest:     null,
    default_reps_min: null,
    default_reps_max: null,
    instructions:     '',
    notes:            '',
    isBuiltin:        true,
  }
}

export default function ExerciseDetailSheet({ id, onClose, onNotesSaved, context }) {
  const isWorkoutContext = context === 'workout'
  const decoded    = id ? decodeURIComponent(id) : ''
  const isBuiltin  = decoded.startsWith('__builtin__')
  const builtinName = isBuiltin ? decoded.replace('__builtin__', '') : null

  const [userId, setUserId] = useState(null)
  const [form, setForm]     = useState(null)
  const [dbId, setDbId]     = useState(null)
  const [personalNote, setPersonalNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    if (!id) return
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      setUserId(uid)

      let exerciseName = null

      if (isBuiltin) {
        exerciseName = builtinName
        const base = builtinDefaults(builtinName)
        const override = await getExerciseByName(builtinName)
        if (override) {
          setDbId(override.id)
          setForm({ ...base, ...override, isBuiltin: true })
        } else {
          setForm(base)
        }
      } else {
        const { data, error } = await supabase
          .from('exercises').select('*').eq('id', decoded).single()
        if (!error && data) {
          setDbId(data.id)
          exerciseName = data.name
          setForm({ ...data, isBuiltin: false })
        }
      }

      // Hamta personlig anteckning
      if (uid && exerciseName) {
        const note = await getUserExerciseNote(uid, exerciseName)
        setPersonalNote(note ?? '')
      }
    }
    load()
  }, [id])

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  async function handleSave() {
    if (!form || saving) return
    setSaving(true)
    try {
      // Spara personlig anteckning (alla users, bade workout + settings)
      if (userId && form.name) {
        await upsertUserExerciseNote(userId, form.name, personalNote)
      }

      // Spara ovnings-metadata (instruktioner, muskler, etc) - bara om vi
      // ar i settings-kontext, inte under pagaende pass.
      if (!isWorkoutContext) {
        const payload = {
          muscle_group:     form.muscle_group     || null,
          secondary_muscle: form.secondary_muscle || null,
          equipment:        form.equipment        || null,
          movement_pattern: form.movement_pattern || null,
          default_rest:     form.default_rest     || null,
          default_reps_min: form.default_reps_min ? Number(form.default_reps_min) : null,
          default_reps_max: form.default_reps_max ? Number(form.default_reps_max) : null,
          instructions:     form.instructions     || null,
          notes:            form.notes            || null,
        }

        if (isBuiltin) {
          const savedEx = await upsertExerciseByName(builtinName, payload, userId)
          if (savedEx?.id) setDbId(savedEx.id)
        } else {
          await updateExercise(dbId, { name: form.name, ...payload })
        }
      }

      setSaved(true)
      // Skicka tillbaka personlig anteckning till Workout-vyn via callback
      onNotesSaved?.(form.name, personalNote)
      setTimeout(() => onClose(), 300)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {id && (
        <motion.div
          className={styles.overlay}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        >
          {/* Header */}
          <div className={detailStyles.header}>
            <button className={detailStyles.backBtn} onClick={onClose} type="button" aria-label="Stäng">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className={detailStyles.headerTitle} title={form?.name ?? ''}>{form?.name ?? 'Laddar…'}</span>
            <button
              className={`${detailStyles.saveBtn} ${saved ? detailStyles.saveBtnDone : ''}`}
              onClick={handleSave}
              disabled={saving || !form}
              type="button"
            >
              {saving ? 'Sparar…' : saved ? 'Sparat ✓' : 'Spara'}
            </button>
          </div>

          {form && (
            <div className={detailStyles.body}>

              {/* Namn – ej redigerbart under pass */}
              <div className={detailStyles.section}>
                <label className={detailStyles.label}>Namn</label>
                <input
                  className={detailStyles.input}
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  disabled={isBuiltin || isWorkoutContext}
                  placeholder="Övningsnamn"
                />
              </div>

              {/* Teknikfält – döljs under pass */}
              {!isWorkoutContext && (
                <>
                  <div className={detailStyles.section}>
                    <label className={detailStyles.label}>Primär muskelgrupp</label>
                    <select className={detailStyles.select} value={form.muscle_group ?? ''} onChange={e => set('muscle_group', e.target.value)}>
                      <option value="">Välj…</option>
                      {MUSCLE_GROUPS.map(mg => <option key={mg} value={mg}>{mg}</option>)}
                    </select>
                  </div>

                  <div className={detailStyles.section}>
                    <label className={detailStyles.label}>Sekundär muskelgrupp</label>
                    <select className={detailStyles.select} value={form.secondary_muscle ?? ''} onChange={e => set('secondary_muscle', e.target.value)}>
                      <option value="">Ingen</option>
                      {MUSCLE_GROUPS.map(mg => <option key={mg} value={mg}>{mg}</option>)}
                    </select>
                  </div>

                  <div className={detailStyles.row2}>
                    <div className={detailStyles.section}>
                      <label className={detailStyles.label}>Utrustning</label>
                      <select className={detailStyles.select} value={form.equipment ?? ''} onChange={e => set('equipment', e.target.value)}>
                        <option value="">Välj…</option>
                        {EQUIPMENT.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                      </select>
                    </div>
                    <div className={detailStyles.section}>
                      <label className={detailStyles.label}>Rörelsemönster</label>
                      <select className={detailStyles.select} value={form.movement_pattern ?? ''} onChange={e => set('movement_pattern', e.target.value)}>
                        <option value="">Välj…</option>
                        {MOVEMENT.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Instruktioner - globala, admin-redigerbara.
                  I workout-kontext visas de som lasbar text.
                  I settings-kontext ar de redigerbara. */}
              {isWorkoutContext ? (
                form.instructions ? (
                  <div className={detailStyles.section}>
                    <label className={detailStyles.label}>Instruktioner</label>
                    <div className={styles.instructionsReadonly}>{form.instructions}</div>
                  </div>
                ) : null
              ) : (
                <div className={detailStyles.section}>
                  <label className={detailStyles.label}>Instruktioner</label>
                  <textarea
                    className={detailStyles.textarea}
                    value={form.instructions ?? ''}
                    onChange={e => set('instructions', e.target.value)}
                    placeholder="Teknikpunkter, personliga cues…"
                    rows={5}
                  />
                </div>
              )}

              {/* Personlig anteckning - sparas per user, synkas inte globalt */}
              <div className={detailStyles.section}>
                <label className={detailStyles.label}>Min anteckning</label>
                <textarea
                  className={detailStyles.textarea}
                  value={personalNote}
                  onChange={e => { setPersonalNote(e.target.value); setSaved(false) }}
                  placeholder="Personliga noteringar om övningen…"
                  rows={3}
                />
              </div>

            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
