import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { updateExercise, copyExerciseForUser, upsertRestOverride, deleteRestOverride } from '../lib/db'
import { EXERCISES, MUSCLE_GROUPS } from '../data/exercises'
import styles from './ExerciseDetail.module.css'

const EQUIPMENT = ['Skivstång', 'Hantel', 'Maskin', 'Kabel', 'Kroppsvikt', 'Övrigt']
const MOVEMENT  = ['Press', 'Drag', 'Squat', 'Hinge', 'Carry', 'Övrigt']
const REST_PRESETS = [30, 60, 90, 120, 180]

function fmtRest(s) {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60), rem = s % 60
  return rem ? `${m}m${rem}s` : `${m}m`
}

function builtinDefaults(name) {
  const data = EXERCISES[name] ?? {}
  return {
    name,
    muscle_group:     data.muscle_group ?? '',
    secondary_muscle: data.secondary_muscle ?? '',
    equipment:        data.equipment ?? '',
    movement_pattern: data.movement_pattern ?? '',
    default_rest:     null,
    instructions:     '',
    isBuiltin:        true,
  }
}

export default function ExerciseDetail() {
  const { id } = useParams()
  const decoded     = decodeURIComponent(id)
  const isBuiltin   = decoded.startsWith('__builtin__')
  const builtinName = isBuiltin ? decoded.replace('__builtin__', '') : null

  const navigate = useNavigate()
  const [userId, setUserId]   = useState(null)
  const [form, setForm]       = useState(null)
  const [dbId, setDbId]       = useState(null)
  const [isOwned, setIsOwned] = useState(false) // true if user owns this row
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [copying, setCopying] = useState(false)
  const [saveErr, setSaveErr] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      setUserId(uid)

      if (isBuiltin) {
        const base = builtinDefaults(builtinName)
        // Load rest override from user_rest_overrides (not from exercises copy)
        if (uid) {
          const { data: restRow } = await supabase
            .from('user_rest_overrides')
            .select('rest_seconds')
            .eq('user_id', uid)
            .eq('exercise_name', builtinName)
            .maybeSingle()
          if (restRow) base.default_rest = restRow.rest_seconds
        }
        setIsOwned(false)
        setForm(base)
      } else {
        const { data, error } = await supabase
          .from('exercises').select('*').eq('id', decoded).single()
        if (!error && data) {
          const owned = data.user_id === uid
          setDbId(data.id)
          setIsOwned(owned)
          if (!owned && uid) {
            // Global exercise: load rest override from user_rest_overrides
            const { data: restRow } = await supabase
              .from('user_rest_overrides')
              .select('rest_seconds')
              .eq('user_id', uid)
              .eq('exercise_name', data.name)
              .maybeSingle()
            setForm({ ...data, default_rest: restRow ? restRow.rest_seconds : (data.default_rest ?? null) })
          } else {
            setForm(data)
          }
        }
      }
    }
    load()
  }, [decoded, isBuiltin, builtinName])

  // True when viewing a global (shared) exercise without a user-owned copy
  const isGlobal = !isOwned && (isBuiltin || (form != null && form.user_id === null))

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
    setSaveErr(null)
  }

  async function handleSave() {
    if (!form || saving) return
    setSaving(true)
    setSaveErr(null)
    try {
      if (isOwned && dbId) {
        // User-owned exercise: save all fields
        const payload = {
          name:             form.name,
          muscle_group:     form.muscle_group     || null,
          secondary_muscle: form.secondary_muscle || null,
          equipment:        form.equipment        || null,
          movement_pattern: form.movement_pattern || null,
          default_rest:     form.default_rest     ?? null,
          instructions:     form.instructions     || null,
        }
        const result = await updateExercise(dbId, payload)
        if (result && result.id) {
          setSaved(true)
        } else {
          setSaveErr('Kunde inte spara. Försök igen.')
          console.error('updateExercise returned no result')
        }
      } else {
        // Global/builtin exercise: save rest to user_rest_overrides table (no copy created)
        if (!userId) { setSaveErr('Inte inloggad.'); return }
        if (form.default_rest == null) {
          await deleteRestOverride(userId, form.name)
          setSaved(true)
        } else {
          const result = await upsertRestOverride(userId, form.name, form.default_rest)
          if (result) {
            setSaved(true)
          } else {
            setSaveErr('Kunde inte spara. Försök igen.')
          }
        }
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleCopy() {
    if (!userId || copying) return
    setCopying(true)
    try {
      const source = isBuiltin
        ? { ...builtinDefaults(builtinName), name: builtinName }
        : form
      const copy = await copyExerciseForUser(source, userId)
      navigate(`/exercises/${copy.id}`, { replace: true })
    } catch {
      setCopying(false)
    }
  }

  if (!form) {
    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate('/exercises')} type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className={styles.headerTitle}>Laddar…</span>
          <div style={{ width: 60 }} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/exercises')} type="button" aria-label="Tillbaka">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className={styles.headerTitle} title={form.name}>{form.name}</span>
        {isOwned ? (
          <button
            className={`${styles.saveBtn} ${saved ? styles.saveBtnDone : ''}`}
            onClick={handleSave}
            disabled={saving}
            type="button"
          >
            {saving ? 'Sparar…' : saved ? 'Sparat ✓' : 'Spara'}
          </button>
        ) : (
          <div style={{ width: 60 }} />
        )}
      </div>

      <div className={styles.body}>

        {/* Namn */}
        <div className={styles.section}>
          <label className={styles.label}>Namn</label>
          {isGlobal
            ? <p className={styles.readonlyVal}>{form.name}</p>
            : <input className={styles.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Övningsnamn" />
          }
        </div>

        {/* Muskelgrupper */}
        <div className={styles.section}>
          <label className={styles.label}>Primär muskelgrupp</label>
          {isGlobal
            ? <p className={styles.readonlyVal}>{form.muscle_group || '–'}</p>
            : <select className={styles.select} value={form.muscle_group ?? ''} onChange={e => set('muscle_group', e.target.value)}>
                <option value="">Välj…</option>
                {MUSCLE_GROUPS.map(mg => <option key={mg} value={mg}>{mg}</option>)}
              </select>
          }
        </div>

        <div className={styles.section}>
          <label className={styles.label}>Sekundär muskelgrupp</label>
          {isGlobal
            ? <p className={styles.readonlyVal}>{form.secondary_muscle || '–'}</p>
            : <select className={styles.select} value={form.secondary_muscle ?? ''} onChange={e => set('secondary_muscle', e.target.value)}>
                <option value="">Ingen</option>
                {MUSCLE_GROUPS.map(mg => <option key={mg} value={mg}>{mg}</option>)}
              </select>
          }
        </div>

        {/* Utrustning + Rörelsemönster */}
        <div className={styles.row2}>
          <div className={styles.section}>
            <label className={styles.label}>Utrustning</label>
            {isGlobal
              ? <p className={styles.readonlyVal}>{form.equipment || '–'}</p>
              : <select className={styles.select} value={form.equipment ?? ''} onChange={e => set('equipment', e.target.value)}>
                  <option value="">Välj…</option>
                  {EQUIPMENT.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                </select>
            }
          </div>
          <div className={styles.section}>
            <label className={styles.label}>Rörelsemönster</label>
            {isGlobal
              ? <p className={styles.readonlyVal}>{form.movement_pattern || '–'}</p>
              : <select className={styles.select} value={form.movement_pattern ?? ''} onChange={e => set('movement_pattern', e.target.value)}>
                  <option value="">Välj…</option>
                  {MOVEMENT.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            }
          </div>
        </div>

        {/* Standardvila – always editable */}
        <div className={styles.section}>
          <label className={styles.label}>Standardvila</label>
          <div className={styles.chips}>
            <button
              className={`${styles.chip} ${form.default_rest == null ? styles.chipActive : ''}`}
              onClick={() => set('default_rest', null)}
              type="button"
            >Auto</button>
            {REST_PRESETS.map(s => (
              <button
                key={s}
                className={`${styles.chip} ${Number(form.default_rest) === s ? styles.chipActive : ''}`}
                onClick={() => set('default_rest', s)}
                type="button"
              >{fmtRest(s)}</button>
            ))}
          </div>
          {/* Save button for global exercises (only shows rest preference) */}
          {isGlobal && (
            <button
              className={styles.saveRestBtn}
              onClick={handleSave}
              disabled={saving}
              type="button"
            >
              {saving ? 'Sparar…' : saved ? 'Vila sparad ✓' : 'Spara vila'}
            </button>
          )}
          {saveErr && <p className={styles.saveErr}>{saveErr}</p>}
        </div>

        {/* Instruktioner */}
        <div className={styles.section}>
          <label className={styles.label}>Instruktioner</label>
          {isGlobal
            ? <p className={styles.readonlyInstructions}>{form.instructions || '–'}</p>
            : <textarea
                className={styles.textarea}
                value={form.instructions ?? ''}
                onChange={e => set('instructions', e.target.value)}
                placeholder="Teknikpunkter, personliga cues…"
                rows={5}
              />
          }
        </div>

        {/* Kopiera och anpassa – längst ner för globala övningar */}
        {isGlobal && (
          <div className={styles.section}>
            <button
              className={styles.copyFullBtn}
              onClick={handleCopy}
              disabled={copying || !userId}
              type="button"
            >
              {copying ? 'Kopierar…' : 'Kopiera och anpassa'}
            </button>
            <p className={styles.copyHint}>Skapar en redigerbar kopia i ditt bibliotek</p>
          </div>
        )}

      </div>
    </div>
  )
}
