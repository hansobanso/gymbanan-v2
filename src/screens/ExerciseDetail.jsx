import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { updateExercise, copyExerciseForUser, deleteExercise, upsertRestOverride, deleteRestOverride, getUserExerciseNote, upsertUserExerciseNote, getExerciseById } from '../lib/db'
import { EXERCISES } from '../data/exercises'
import { MUSCLE_GROUPS } from '../data/muscleGroups'
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

// Sakerstaller att secondary_muscles (array) ar ifylld. Om den saknas/ar tom
// men gamla singular-faltet finns, skapa array fran den (bakatkompatibelt).
function normalizeSecondary(data) {
  if (!data) return data
  const arr = Array.isArray(data.secondary_muscles) ? data.secondary_muscles : []
  if (arr.length === 0 && data.secondary_muscle) {
    return { ...data, secondary_muscles: [data.secondary_muscle] }
  }
  return { ...data, secondary_muscles: arr }
}

function builtinDefaults(name) {
  const data = EXERCISES[name] ?? {}
  return {
    name,
    muscle_group:     data.muscle_group ?? '',
    secondary_muscle: data.secondary_muscle ?? '',
    secondary_muscles: data.secondary_muscle ? [data.secondary_muscle] : [],
    equipment:        data.equipment ?? '',
    movement_pattern: data.movement_pattern ?? '',
    default_rest:     null,
    instructions:     '',
    isBuiltin:        true,
  }
}

const REST_OPTIONS = [
  { value: null, label: 'Auto' },
  ...REST_PRESETS.map(s => ({ value: s, label: fmtRest(s) })),
]

function RestDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const currentLabel = REST_OPTIONS.find(o => o.value === value)?.label ?? 'Auto'

  // Stang vid klick utanfor
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handleClick)
    return () => document.removeEventListener('pointerdown', handleClick)
  }, [open])

  return (
    <div className={styles.restDropdown} ref={ref}>
      <button
        type="button"
        className={styles.restDropdownTrigger}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        {currentLabel}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className={styles.restDropdownMenu}>
          {REST_OPTIONS.map(opt => (
            <button
              key={opt.label}
              type="button"
              className={`${styles.restDropdownItem} ${opt.value === value ? styles.restDropdownItemActive : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false) }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ExerciseDetail() {
  const { id } = useParams()
  const decoded     = decodeURIComponent(id)
  const isBuiltin   = decoded.startsWith('__builtin__')
  const builtinName = isBuiltin ? decoded.replace('__builtin__', '') : null

  const navigate = useNavigate()
  const [userId, setUserId]   = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [form, setForm]       = useState(null)
  const [dbId, setDbId]       = useState(null)
  const [isOwned, setIsOwned] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [copying, setCopying] = useState(false)
  const [saveErr, setSaveErr] = useState(null)
  const [editingMode, setEditingMode] = useState(false)
  const [personalNote, setPersonalNote] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      setUserId(uid)
      setIsAdmin(session?.user?.email === 'hannes@hannesisaksson.com')

      let exerciseName = null

      if (isBuiltin) {
        exerciseName = builtinName
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
        const data = await getExerciseById(decoded)
        if (data) {
          exerciseName = data.name
          const owned = data.user_id === uid
          setDbId(data.id)
          setIsOwned(owned)
          if (!owned && uid) {
            // Hamta vilotids-override och anteckning parallellt (oberoende)
            const [restRes, note] = await Promise.all([
              supabase
                .from('user_rest_overrides')
                .select('rest_seconds')
                .eq('user_id', uid)
                .eq('exercise_name', data.name)
                .maybeSingle(),
              getUserExerciseNote(uid, data.name),
            ])
            const restRow = restRes.data
            setForm(normalizeSecondary({ ...data, default_rest: restRow ? restRow.rest_seconds : (data.default_rest ?? null) }))
            setPersonalNote(note ?? '')
            return
          } else {
            setForm(normalizeSecondary(data))
          }
        }
      }

      // Hamta personlig anteckning (for builtins och egna ovningar)
      if (uid && exerciseName) {
        const note = await getUserExerciseNote(uid, exerciseName)
        setPersonalNote(note ?? '')
      }
    }
    load()
  }, [decoded, isBuiltin, builtinName])

  const isGlobal = !isOwned && (isBuiltin || (form != null && form.user_id === null))
  // Admin far redigera globala ovningar direkt (RLS tillater det).
  const canEditGlobalAsAdmin = isAdmin && isGlobal && !isBuiltin && dbId != null
  const canEdit = (isOwned || canEditGlobalAsAdmin) && editingMode

  // Build muscle intensities for MuscleMap from primary + secondary muscles
  const muscleIntensities = useMemo(() => {
    if (!form) return {}
    const out = {}
    if (form.muscle_group) out[form.muscle_group] = 1.0
    const secondaries = Array.isArray(form.secondary_muscles) && form.secondary_muscles.length
      ? form.secondary_muscles
      : (form.secondary_muscle ? [form.secondary_muscle] : [])
    for (const m of secondaries) {
      if (m && m !== form.muscle_group) out[m] = 0.5
    }
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
      if ((isOwned || canEditGlobalAsAdmin) && dbId) {
        const secArr = (form.secondary_muscles ?? []).filter(m => m && m !== form.muscle_group)
        const payload = {
          name:              form.name,
          muscle_group:      form.muscle_group     || null,
          secondary_muscles: secArr,
          // Hall gamla singular-faltet i synk (forsta muskeln) tills det fasas ut
          secondary_muscle:  secArr[0] || null,
          equipment:         form.equipment        || null,
          movement_pattern:  form.movement_pattern || null,
          default_rest:      form.default_rest     ?? null,
          instructions:      form.instructions     || null,
        }
        const result = await updateExercise(dbId, payload)
        if (result && result.id) {
          setSaved(true)
          setEditingMode(false)
        } else if (result?._error === '23505') {
          setSaveErr('Det finns redan en övning med det namnet.')
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
        {(isOwned || canEditGlobalAsAdmin) ? (
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

          {canEdit ? (
            <div className={styles.secMuscleSection}>
              <span className={styles.infoLabel}>Sekundära muskler</span>
              <div className={styles.secMuscleChips}>
                {(form.secondary_muscles ?? []).map(m => (
                  <span key={m} className={styles.secMuscleChip}>
                    {m}
                    <button
                      type="button"
                      className={styles.secMuscleChipRemove}
                      onClick={() => set('secondary_muscles', (form.secondary_muscles ?? []).filter(x => x !== m))}
                      aria-label={`Ta bort ${m}`}
                    >×</button>
                  </span>
                ))}
                {(form.secondary_muscles ?? []).length < 7 && (
                  <select
                    className={styles.secMuscleAdd}
                    value=""
                    onChange={e => {
                      if (!e.target.value) return
                      const v = e.target.value
                      set('secondary_muscles', [...(form.secondary_muscles ?? []).filter(x => x !== v), v])
                    }}
                  >
                    <option value="">+ Lägg till</option>
                    {MUSCLE_GROUPS
                      .filter(g => g !== form.muscle_group && !(form.secondary_muscles ?? []).includes(g))
                      .map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.secMuscleSection}>
              <span className={styles.infoLabel}>Sekundära muskler</span>
              {(form.secondary_muscles ?? []).length ? (
                <div className={styles.secMuscleChips}>
                  {form.secondary_muscles.map(m => (
                    <span key={m} className={styles.secMuscleChipView}>{m}</span>
                  ))}
                </div>
              ) : (
                <span className={styles.infoValue}>–</span>
              )}
            </div>
          )}

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
          <div className={styles.restRow}>
            <span className={styles.restLabel}>Standardvila</span>
            <RestDropdown
              value={form.default_rest}
              onChange={val => set('default_rest', val)}
            />
            {isGlobal && (
              <button
                className={styles.saveRestBtn}
                onClick={handleSave}
                disabled={saving}
                type="button"
              >
                {saving ? '…' : saved ? '✓' : 'Spara'}
              </button>
            )}
          </div>
          {saveErr && <p className={styles.saveErr}>{saveErr}</p>}
        </div>

        {/* ── Styrkeutveckling (deep-link) ── */}
        <div className={styles.section}>
          <button
            className={styles.progressLink}
            onClick={() => navigate('/history', { state: { progressExercise: form.name } })}
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 3v16a2 2 0 0 0 2 2h16"/>
              <path d="m7 14 3-4 3 3 4-6"/>
            </svg>
            Se din utveckling i {form.name || 'övningen'}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
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

        {/* ── Personlig anteckning ── */}
        {userId && (
          <div className={styles.restCard}>
            <span className={styles.sectionLabel}>Min anteckning</span>
            <textarea
              className={styles.textarea}
              value={personalNote}
              onChange={e => { setPersonalNote(e.target.value); setNoteSaved(false) }}
              placeholder="Personliga noteringar om övningen…"
              rows={3}
            />
          </div>
        )}
        {userId && (
          <button
            className={styles.saveNoteBtn}
            onClick={async () => {
              if (noteSaving || !form?.name) return
              setNoteSaving(true)
              try {
                await upsertUserExerciseNote(userId, form.name, personalNote)
                setNoteSaved(true)
              } catch { /* ignore */ }
              setNoteSaving(false)
            }}
            disabled={noteSaving}
            type="button"
          >
            {noteSaving ? 'Sparar…' : noteSaved ? 'Sparat ✓' : 'Spara anteckning'}
          </button>
        )}

        {/* ── Ta bort ovning (egna, eller globala som admin) ── */}
        {(isOwned || canEditGlobalAsAdmin) && dbId != null && (
          <div className={styles.section}>
            {!deleteArmed ? (
              <button
                className={styles.deleteBtn}
                onClick={() => setDeleteArmed(true)}
                type="button"
              >
                Ta bort övning
              </button>
            ) : (
              <>
                <p className={styles.deleteWarn}>
                  Övningen tas bort ur biblioteket{isGlobal ? ' för alla användare' : ''}.
                  Din historik och dina program påverkas inte.
                </p>
                <div className={styles.deleteRow}>
                  <button className={styles.deleteCancel} onClick={() => setDeleteArmed(false)} type="button">
                    Avbryt
                  </button>
                  <button
                    className={styles.deleteConfirm}
                    onClick={async () => {
                      if (deleting) return
                      setDeleting(true)
                      const ok = await deleteExercise(dbId)
                      setDeleting(false)
                      if (ok) navigate('/exercises')
                      else setDeleteArmed(false)
                    }}
                    disabled={deleting}
                    type="button"
                  >
                    {deleting ? 'Tar bort…' : 'Ja, ta bort'}
                  </button>
                </div>
              </>
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
