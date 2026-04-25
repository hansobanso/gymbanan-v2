import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Auth.module.css'

function getErrorMessage(error) {
  if (!error) return null
  const msg = error.message?.toLowerCase() || ''
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials'))
    return 'Fel e-post eller lösenord'
  if (msg.includes('email not confirmed'))
    return 'E-postadressen är inte verifierad'
  if (msg.includes('too many requests'))
    return 'För många försök – vänta en stund'
  return 'Något gick fel, försök igen'
}

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(getErrorMessage(error))
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(getErrorMessage(error))
      else setMessage('Kontrollera din e-post för att bekräfta kontot.')
    }

    setLoading(false)
  }

  return (
    <div className={styles.container}>
      <div className={styles.logo}>
        <svg className={styles.logoIcon} viewBox="0 0 24 24" fill="none" stroke="#F5D020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 8 5"/>
          <path d="M5.15 17.89c5.52-1.52 8.65-6.89 7-12C11.55 4 11.5 2 13 2c3.22 0 5 5.5 5 8 0 6.5-4.2 12-10.49 12C5.55 22 4 21.3 4 20c0-1.1.5-2.31 1.15-2.11Z"/>
        </svg>
        <span className={styles.logoText}>Gymbanan</span>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={mode === 'login' ? styles.tabActive : styles.tab}
            onClick={() => { setMode('login'); setError(null); setMessage(null) }}
          >
            Logga in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? styles.tabActive : styles.tab}
            onClick={() => { setMode('signup'); setError(null); setMessage(null) }}
          >
            Skapa konto
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {message && <p className={styles.message}>{message}</p>}

        <div className={styles.field}>
          <label className={styles.label}>E-post</label>
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="namn@exempel.se"
            required
            autoComplete="email"
            autoCapitalize="none"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Lösenord</label>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={6}
          />
        </div>

        <button className={styles.submitBtn} type="submit" disabled={loading}>
          {loading ? 'Laddar…' : mode === 'login' ? 'Logga in' : 'Skapa konto'}
        </button>
      </form>
    </div>
  )
}
