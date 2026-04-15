import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getExercises } from '../lib/db'
import styles from './Settings.module.css'

const REST_PRESETS = [30, 60, 90, 120, 180]
const DEFAULT_REST_KEY = 'gymbanan_default_rest'

function fmtRest(s) {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem ? `${m}m${rem}s` : `${m}m`
}

function Chevron({ rotated }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      className={styles.chevron}
      style={rotated ? { transform: 'rotate(90deg)', transition: 'transform 0.2s' } : { transition: 'transform 0.2s' }}
    >
      <path d="M9 18L15 12L9 6" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Settings({ session }) {
  const navigate = useNavigate()
  const [allExercises, setAllExercises] = useState([])
  const [defaultRest, setDefaultRest] = useState(() => {
    const v = localStorage.getItem(DEFAULT_REST_KEY)
    return v ? Number(v) : 120
  })
  const [loading, setLoading] = useState(true)
  const [restExpanded, setRestExpanded] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft]     = useState('')
  const [nameSaving, setNameSaving]   = useState(false)

  useEffect(() => {
    getExercises()
      .then(setAllExercises)
      .catch(console.error)
      .finally(() => setLoading(false))

    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => { if (data?.display_name) setDisplayName(data.display_name) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDefaultRest(s) {
    setDefaultRest(s)
    localStorage.setItem(DEFAULT_REST_KEY, String(s))
  }

  function openNameEdit() {
    setNameDraft(displayName)
    setEditingName(true)
  }

  async function saveDisplayName() {
    if (nameSaving) return
    setNameSaving(true)
    try {
      await supabase
        .from('profiles')
        .upsert({ id: session.user.id, display_name: nameDraft.trim() || null, updated_at: new Date().toISOString() })
      setDisplayName(nameDraft.trim())
      setEditingName(false)
    } catch (e) { console.error(e) }
    finally { setNameSaving(false) }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h1 className={styles.title}>Inställningar</h1>
      </div>

      <div className={styles.scroll}>

        {/* ── Träning ── */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Träning</div>

          <div className={styles.rowCard}>
            <button className={styles.row} onClick={() => navigate('/exercises')} type="button">
              <span className={styles.rowLabel}>Övningsbibliotek</span>
              <div className={styles.rowRight}>
                {!loading && <span className={styles.rowValue}>{allExercises.length} övningar</span>}
                <Chevron />
              </div>
            </button>
          </div>

          <div className={styles.rowCard}>
            <button className={styles.row} onClick={() => navigate('/body-weight')} type="button">
              <span className={styles.rowLabel}>Kroppsvikt</span>
              <div className={styles.rowRight}>
                <Chevron />
              </div>
            </button>
          </div>

          <div className={styles.rowCard}>
            <button className={styles.row} onClick={() => setRestExpanded(v => !v)} type="button">
              <span className={styles.rowLabel}>Standard vilotid</span>
              <div className={styles.rowRight}>
                <span className={styles.rowValue}>{fmtRest(defaultRest)}</span>
                <Chevron rotated={restExpanded} />
              </div>
            </button>
            {restExpanded && (
              <div className={styles.restGrid}>
                {REST_PRESETS.map(s => (
                  <button
                    key={s}
                    className={`${styles.restPreset} ${defaultRest === s ? styles.restPresetActive : ''}`}
                    onClick={() => { handleDefaultRest(s); setRestExpanded(false) }}
                    type="button"
                  >
                    {fmtRest(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Konto ── */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Konto</div>

          <div className={styles.rowCard}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Inloggad som</span>
              <span className={styles.rowValue}>{session.user.email}</span>
            </div>
          </div>

          <div className={styles.rowCard}>
            <button className={styles.row} onClick={openNameEdit} type="button">
              <span className={styles.rowLabel}>Ditt namn</span>
              <span className={styles.rowValue}>{displayName || 'Ange namn'}</span>
            </button>
            {editingName && (
              <div className={styles.nameEditPanel}>
                <input
                  className={styles.nameInput}
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  placeholder="Ditt namn…"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveDisplayName(); if (e.key === 'Escape') setEditingName(false) }}
                />
                <div className={styles.nameEditActions}>
                  <button className={styles.nameSaveBtn} onClick={saveDisplayName} disabled={nameSaving} type="button">
                    {nameSaving ? 'Sparar…' : 'Spara'}
                  </button>
                  <button className={styles.nameCancelBtn} onClick={() => setEditingName(false)} type="button">Avbryt</button>
                </div>
              </div>
            )}
          </div>

          <div className={styles.rowCard}>
            <button className={`${styles.row} ${styles.rowDanger}`} onClick={handleSignOut} type="button">
              Logga ut
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
