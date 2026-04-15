import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { getBodyWeights, logBodyWeight } from '../lib/db'
import styles from './BodyWeight.module.css'

function fmtDate(iso) {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d) / 86_400_000)
  if (diffDays === 0) return 'Idag'
  if (diffDays === 1) return 'Igår'
  if (diffDays < 7) return `${diffDays} dagar sedan`
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BodyWeight({ session }) {
  const navigate = useNavigate()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getBodyWeights(session.user.id, 50)
      .then(data => { setEntries(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [session.user.id])

  async function handleSave() {
    const val = parseFloat(input.replace(',', '.'))
    if (!val || val <= 0 || saving) return
    setSaving(true)
    try {
      const entry = await logBodyWeight(session.user.id, val)
      setEntries(prev => [entry, ...prev])
      setInput('')
      setSheetOpen(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} type="button">
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
            <path d="M8.5 1.5L1.5 8L8.5 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className={styles.title}>Kroppsvikt</h1>
        <button className={styles.addBtn} onClick={() => { setInput(''); setSheetOpen(true) }} type="button">
          + Logga
        </button>
      </div>

      <div className={styles.list}>
        {loading && <p className={styles.empty}>Laddar…</p>}
        {!loading && entries.length === 0 && (
          <p className={styles.empty}>Ingen vikt loggad ännu</p>
        )}
        {entries.map((e, i) => (
          <div key={e.id ?? i} className={styles.row}>
            <span className={styles.date}>{fmtDate(e.logged_at)}</span>
            <span className={styles.weight}>{parseFloat(e.weight)} kg</span>
          </div>
        ))}
      </div>

      {/* Input sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              className={styles.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              className={styles.sheet}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              onClick={e => e.stopPropagation()}
            >
              <div className={styles.handle} />
              <p className={styles.sheetTitle}>Logga kroppsvikt</p>
              <button
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={!input || saving}
                type="button"
              >
                {saving ? 'Sparar…' : 'Spara'}
              </button>
              <div className={styles.inputRow}>
                <input
                  className={styles.inputField}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
                <span className={styles.unit}>kg</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
