import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { updateExercise, copyExerciseForUser, upsertRestOverride, deleteRestOverride } from '../lib/db'
import { EXERCISES, MUSCLE_GROUPS } from '../data/exercises'
import MuscleMap from '../components/shared/MuscleMap'
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
  const [isOwned, setIsOwned] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [copying, setCopying] = useState(false)
  const [saveErr, setSaveErr] = useState(null)
  const [editingMode, setEditingMode] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      setUserId(uid)

      if (isBuiltin) {
        const base = builtinDefaults(builtinName)
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

  const isGlobal = !isOwned && (isBuiltin || (form != null && form.user_id === null))
  const canEdit = isOwned && editingMode

  // Build muscle intensities for MuscleMap from primary/secondary muscle
  const muscleIntensities = useMemo(() => {
    if (!form) return {}
    const out = {}
    if (form.muscle_group) out[form.muscle_group] = 1.0
    if (form.secondary_muscle) out[form.secondary_muscle] = 0.5
    return out
  }, [form])

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
          setEditingMode(false)
        } else {
          setSaveErr('Kunde inte spara. Försök igen.')
        }
      } else {
        if (!userId) { setSaveErr('Inte inloggad.'); return }
        if (form.default_rest == null) {
          await deleteRestOverride(userId, form.name)
          setSaved(true)
        } else {
          const result = await upsertRestOverride(userId, form.name, form.default_rest)
          if (result) setSaved(true)
          else setSaveErr('Kunde inte spara. Försök igen.')
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
          <div style={{ width: 36 }} />
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
          editingMode ? (
            <button
              className={`${styles.saveBtn} ${saved ? styles.saveBtnDone : ''}`}
              onClick={handleSave}
              disabled={saving}
              type="button"
            >
              {saving ? 'Sparar…' : saved ? 'Sparat ✓' : 'Spara'}
            </button>
          ) : (
            <button
              className={styles.editBtn}
              onClick={() => setEditingMode(true)}
              type="button"
              aria-label="Redigera"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
          )
        ) : (
          <div style={{ width: 36 }} />
        )}
      </div>

      <div className={styles.body}>
        {/* ── Muscle hero section ── */}
        <div className={styles.heroSection}>
          <MuscleMap intensities={muscleIntensities} size={140} />
        </div>

        {/* ── Info card ── */}
        <div className={styles.infoCard}>
          {canEdit && (
            <>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Namn</span>
                <input
                  className={styles.infoInput}
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Övningsnamn"
                />
              </div>
              <div className={styles.divider} />
            </>
          )}

          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Primär muskel</span>
            {canEdit ? (
              <select className={styles.infoSelect} value={form.muscle_group ?? ''} onChange={e => set('muscle_group', e.target.value)}>
                <option value="">Välj…</option>
                {MUSCLE_GROUPS.map(mg => <option key={mg} value={mg}>{mg}</option>)}
              </select>
            ) : (
              <span className={styles.infoValue}>{form.muscle_group || '–'}</span>
            )}
          </div>

          <div className={styles.divider} />

          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Sekundär</span>
            {canEdit ? (
              <select className={styles.infoSelect} value={form.secondary_muscle ?? ''} onChange={e => set('secondary_muscle', e.target.value)}>
                <option value="">Ingen</option>
                {MUSCLE_GROUPS.map(mg => <option key={mg} value={mg}>{mg}</option>)}
              </select>
            ) : (
              <span className={styles.infoValue}>{form.secondary_muscle || '–'}</span>
            )}
          </div>

          <div className={styles.divider} />

          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Utrustning</span>
            {canEdit ? (
              <select className={styles.infoSelect} value={form.equipment ?? ''} onChange={e => set('equipment', e.target.value)}>
                <option value="">Välj…</option>
                {EQUIPMENT.map(eq => <option key={eq} value={eq}>{eq}</option>)}
              </select>
            ) : (
              <span className={styles.infoValue}>{form.equipment || '–'}</span>
            )}
          </div>

          <div className={styles.divider} />

          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Rörelsemönster</span>
            {canEdit ? (
              <select className={styles.infoSelect} value={form.movement_pattern ?? ''} onChange={e => set('movement_pattern', e.target.value)}>
                <option value="">Välj…</option>
                {MOVEMENT.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <span className={styles.infoValue}>{form.movement_pattern || '–'}</span>
            )}
          </div>
        </div>

        {/* ── Standardvila ── */}
        <div className={styles.restCard}>
          <span className={styles.sectionLabel}>Standardvila</span>
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

        {/* ── Instructions ── */}
        {(canEdit || form.instructions) && (
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Instruktioner</span>
            {canEdit ? (
              <textarea
                className={styles.textarea}
                value={form.instructions ?? ''}
                onChange={e => set('instructions', e.target.value)}
                placeholder="Teknikpunkter, personliga cues…"
                rows={5}
              />
            ) : (
              <p className={styles.readonlyInstructions}>{form.instructions}</p>
            )}
          </div>
        )}

        {/* ── Copy and customize for global exercises ── */}
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
