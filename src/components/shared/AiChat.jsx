import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAI } from '../../hooks/useAI'
import styles from './AiChat.module.css'

const SUGGESTIONS = [
  'Hur ser min progression ut?',
  'Är vikterna rimliga?',
  'Tips för nästa pass?',
]

const FREE_WORKOUT_SUGGESTIONS = [
  'Skapa ett helkroppspass',
  'Ge mig ett benpass',
  'Ett överkroppspass med bara kroppsvikt',
  'Ett kort pass, 30 min',
]

export default function AiChat({ open, onClose, getContext, getMemory, getDeloadStatus, introMessage, introLoading, workoutNotes, onUpdateNotes, onApplyAdjustment, onApplyDeload, onApplyWorkoutPlan, getAvailableExercises, freeWorkoutMode }) {
  const [input, setInput] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const notesRef = useRef(null)
  const { messages, loading, error, send, markAdjustmentApplied, markDeloadApplied, markWorkoutApplied } = useAI({ getContext, getMemory, getDeloadStatus, getAvailableExercises })

  // Fokusera input när sheeten öppnar
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 320)
      return () => clearTimeout(t)
    }
  }, [open])

  // Scrolla till botten vid nytt meddelande
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    // Återställ textarea-höjd
    if (inputRef.current) inputRef.current.style.height = 'auto'
    await send(text)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.sheet}
          initial={{ x: '100%', opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.6 }}
          transition={{ type: 'spring', stiffness: 420, damping: 40 }}
        >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <span className={styles.ptBadge}>PT</span>
                <div>
                  <p className={styles.title}>Din personliga tränare</p>
                  <p className={styles.subtitle}>Har tillgång till din passdata</p>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={onClose} aria-label="Stäng">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Anteckningsknapp - oppnar panel i fokus */}
            {onUpdateNotes && (
              <button
                className={styles.notesToggle}
                onClick={() => setNotesOpen(true)}
                type="button"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                </svg>
                <span>{workoutNotes?.trim() ? 'Anteckning till PT' : 'Lägg till anteckning till PT'}</span>
                {workoutNotes?.trim() && <span className={styles.notesDot} />}
              </button>
            )}

            {/* Passnoteringar */}
            {/* Anteckningspanel - slide upp i fokus */}
            <AnimatePresence>
              {notesOpen && onUpdateNotes && (
                <>
                  <motion.div
                    className={styles.notesBackdrop}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setNotesOpen(false)}
                  />
                  <motion.div
                    className={styles.notesPanel}
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 38 }}
                  >
                    <div className={styles.notesPanelHeader}>
                      <span className={styles.notesPanelTitle}>Anteckning till PT</span>
                      <button
                        className={styles.notesDone}
                        onClick={() => setNotesOpen(false)}
                        type="button"
                      >
                        Klar
                      </button>
                    </div>
                    <p className={styles.notesHint}>
                      Något PT bör veta inför svaret – t.ex. dålig sömn, ont i axeln, eller att du bytt övning.
                    </p>
                    <textarea
                      ref={notesRef}
                      className={styles.notesPanelInput}
                      value={workoutNotes || ''}
                      onChange={e => onUpdateNotes(e.target.value)}
                      placeholder="Skriv din anteckning…"
                      rows={4}
                      autoFocus
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Meddelanden */}
            <div className={styles.messages}>
              {introMessage && (
                <div className={styles.introBubble}>
                  <span className={styles.introLabel}>Inför passet</span>
                  <p className={styles.introText}>{introMessage}</p>
                </div>
              )}
              {!introMessage && introLoading && (
                <div className={styles.introBubble}>
                  <span className={styles.introLabel}>Inför passet</span>
                  <div className={styles.introLoadingRow}>
                    <span className={styles.introSpinner} />
                    <span className={styles.introLoadingText}>PT förbereder din genomgång…</span>
                  </div>
                </div>
              )}
              {messages.length === 0 && !introMessage && !introLoading && (
                <div className={styles.empty}>
                  <p className={styles.emptyTitle}>
                    {freeWorkoutMode ? 'Vad vill du träna?' : 'Vad kan jag hjälpa dig med?'}
                  </p>
                  <p className={styles.emptyText}>
                    {freeWorkoutMode
                      ? 'Be mig sätta ihop ett pass åt dig – säg vilken kroppsdel, hur lång tid, eller vilken utrustning du har.'
                      : 'Ställ frågor om teknik, belastning, återhämtning eller progression.'}
                  </p>
                  <div className={styles.suggestions}>
                    {(freeWorkoutMode ? FREE_WORKOUT_SUGGESTIONS : SUGGESTIONS).map(s => (
                      <button
                        key={s}
                        className={styles.suggestion}
                        onClick={() => {
                          setInput(s)
                          inputRef.current?.focus()
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.aiBubble}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {msg.displayContent ?? msg.content}
                  {msg.role === 'assistant' && msg.adjustment && !msg.adjustmentApplied && onApplyAdjustment && (
                    <button
                      className={styles.adjustmentBtn}
                      onClick={() => {
                        const ok = onApplyAdjustment(msg.adjustment)
                        if (ok !== false) markAdjustmentApplied(i)
                      }}
                      type="button"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                      <span className={styles.adjustmentBtnText}>{msg.adjustment.summary}</span>
                    </button>
                  )}
                  {msg.role === 'assistant' && msg.adjustmentApplied && (
                    <div className={styles.adjustmentApplied}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                      Tillämpat
                    </div>
                  )}
                  {msg.role === 'assistant' && msg.deload && !msg.deloadApplied && onApplyDeload && (
                    <button
                      className={styles.deloadBtn}
                      onClick={async () => {
                        const ok = await onApplyDeload(msg.deload)
                        if (ok !== false) markDeloadApplied(i)
                      }}
                      type="button"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      <span className={styles.adjustmentBtnText}>{msg.deload.summary}</span>
                    </button>
                  )}
                  {msg.role === 'assistant' && msg.deloadApplied && (
                    <div className={styles.adjustmentApplied}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                      Deload-vecka aktiverad
                    </div>
                  )}
                  {msg.role === 'assistant' && msg.workoutPlan && !msg.workoutApplied && onApplyWorkoutPlan && (
                    <button
                      className={styles.adjustmentBtn}
                      onClick={() => {
                        const ok = onApplyWorkoutPlan(msg.workoutPlan)
                        if (ok !== false) markWorkoutApplied(i)
                      }}
                      type="button"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                      <span className={styles.adjustmentBtnText}>{msg.workoutPlan.summary}</span>
                    </button>
                  )}
                  {msg.role === 'assistant' && msg.workoutApplied && (
                    <div className={styles.adjustmentApplied}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                      Tillagt i passet
                    </div>
                  )}
                </motion.div>
              ))}

              {loading && (
                <div className={`${styles.bubble} ${styles.aiBubble} ${styles.typing}`}>
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </div>
              )}

              {error && (
                <p className={styles.error}>{error}</p>
              )}

              <div ref={messagesEndRef} />
            </div>


            {/* Input-rad */}
            <div className={styles.inputRow}>
              <textarea
                ref={inputRef}
                className={styles.input}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
                }}
                onKeyDown={handleKeyDown}
                placeholder="Skriv till din PT…"
                rows={1}
                disabled={loading}
              />
              <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={!input.trim() || loading}
                aria-label="Skicka"
                type="button"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </motion.div>
      )}
    </AnimatePresence>
  )
}
