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

const COACH_SUGGESTIONS = [
  'Hur ser min progression ut?',
  'Lägg till en övning i mitt program',
  'Byt ut en övning i nästa pass',
  'Tips för att komma vidare?',
]

export default function AiChat({ open, onClose, getContext, getMemory, getDeloadStatus, introMessage, introLoading, workoutNotes, onUpdateNotes, onApplyAdjustment, onApplyDeload, onApplyWorkoutPlan, onApplyProgramChange, onApplyProgramSwitch, onApplyNewProgram, getProgramsList, getAvailableExercises, freeWorkoutMode, inline = false }) {
  const [input, setInput] = useState('')
  const [copiedIdx, setCopiedIdx] = useState(null) // vilken bubbla som nyss kopierats
  const [notesOpen, setNotesOpen] = useState(false)
  const messagesEndRef = useRef(null)
  const messagesRef = useRef(null)
  const inputRef = useRef(null)
  const notesRef = useRef(null)
  const { messages, loading, error, send, reset, markAdjustmentApplied, markDeloadApplied, markWorkoutApplied, markProgramChangeApplied, markProgramSwitchApplied, markNewProgramApplied } = useAI({ getContext, getMemory, getDeloadStatus, getAvailableExercises, getProgramsList, coachMode: inline })

  // Fokusera input när sheeten öppnar
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 320)
      return () => clearTimeout(t)
    }
  }, [open])

  // Las bakgrundsscrollen medan chatten ar oppen, sa passet bakom inte
  // kan dras med / studsa nar man drar pa den fasta PT-panelen (iOS).
  // I inline-lage (egen flik) ar chatten sjalva sidan - da ska normal
  // sidscroll galla, sa vi hoppar over lasningen.
  useEffect(() => {
    if (inline) return
    if (!open) return
    const scrollY = window.scrollY
    const body = document.body
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      window.scrollTo(0, scrollY)
    }
  }, [open])

  // Scrolla meddelandelistan till botten sa senaste meddelandet syns.
  // Scrollar containern direkt (inte scrollIntoView) sa hela sheeten
  // inte flyttas, och kor en extra gang efter att layouten satt sig.
  useEffect(() => {
    const scrollToBottom = () => {
      const el = messagesRef.current
      if (el) el.scrollTop = el.scrollHeight
    }
    scrollToBottom()
    // Flera fordrojda forsok sa vi fangar svar som renderas i steg
    // (t.ex. nar PT-svaret kommer in eller layouten satter sig).
    const timers = [50, 150, 300, 500, 800].map(ms => setTimeout(scrollToBottom, ms))
    return () => timers.forEach(clearTimeout)
  }, [messages, loading])

  // Nar PT-chatten eller anteckningspanelen ar oppen: folj visuella
  // viewporten sa tangentbordet inte lamnar luft / gommer textrutan (iOS).
  // Satter bade hojd och topp-offset, med extra fordrojda matningar
  // eftersom iOS inte alltid fyrar resize direkt nar tangentbordet glider upp.
  useEffect(() => {
    if (!open && !notesOpen) return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      document.documentElement.style.setProperty('--kbd-vh', `${vv.height}px`)
      document.documentElement.style.setProperty('--kbd-top', `${vv.offsetTop}px`)
      // Nar tangentbordet andrar storlek (t.ex. akar upp nar man fokuserar
      // textfaltet): hall meddelandelistan vid botten sa senaste svaret syns.
      if (open) {
        const el = messagesRef.current
        if (el) el.scrollTop = el.scrollHeight
      }
    }
    update()
    const timers = [120, 300, 550, 800].map(ms => setTimeout(update, ms))
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      timers.forEach(clearTimeout)
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      document.documentElement.style.removeProperty('--kbd-vh')
      document.documentElement.style.removeProperty('--kbd-top')
    }
  }, [open, notesOpen])

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

  // Innehallet (header + body + input) som ren JSX - INTE en egen
  // komponent, sa att fokus pa textfaltet inte tappas vid omrender.
  const content = (
    <>
            {/* Header */}
            {inline ? (
              <div className={styles.inlineHeader}>
                <h1 className={styles.inlineTitle}>Personlig tränare</h1>
                {messages.length > 0 && (
                  <button className={styles.newChatBtn} onClick={reset} type="button">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Ny chatt
                  </button>
                )}
              </div>
            ) : (
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
            )}

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
            <div className={styles.messages} ref={messagesRef}>
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
                      : inline
                        ? 'Ställ frågor om träning, eller be mig ändra i ditt program – lägga till, ta bort eller byta övningar, eller byta program.'
                        : 'Ställ frågor om teknik, belastning, återhämtning eller progression.'}
                  </p>
                  <div className={styles.suggestions}>
                    {(freeWorkoutMode ? FREE_WORKOUT_SUGGESTIONS : inline ? COACH_SUGGESTIONS : SUGGESTIONS).map(s => (
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
                  {msg.role === 'assistant' && (msg.displayContent ?? msg.content) && (
                    <button
                      className={styles.copyBtn}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(msg.displayContent ?? msg.content)
                          setCopiedIdx(i)
                          setTimeout(() => setCopiedIdx(v => (v === i ? null : v)), 1500)
                        } catch { /* clipboard nekad - ignorera */ }
                      }}
                      type="button"
                      aria-label="Kopiera meddelandet"
                    >
                      {copiedIdx === i ? 'Kopierad ✓' : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect width="14" height="14" x="8" y="8" rx="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                          </svg>
                          Kopiera
                        </>
                      )}
                    </button>
                  )}
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
                  {msg.role === 'assistant' && msg.programChange && !msg.programChangeApplied && onApplyProgramChange && (
                    <button
                      className={styles.adjustmentBtn}
                      onClick={async () => {
                        const ok = await onApplyProgramChange(msg.programChange)
                        if (ok !== false) markProgramChangeApplied(i)
                      }}
                      type="button"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                      </svg>
                      <span className={styles.adjustmentBtnText}>{msg.programChange.summary}</span>
                    </button>
                  )}
                  {msg.role === 'assistant' && msg.programChangeApplied && (
                    <div className={styles.adjustmentApplied}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                      Sparat i programmet
                    </div>
                  )}
                  {msg.role === 'assistant' && msg.programSwitch && !msg.programSwitchApplied && onApplyProgramSwitch && (
                    <button
                      className={styles.adjustmentBtn}
                      onClick={async () => {
                        const ok = await onApplyProgramSwitch(msg.programSwitch)
                        if (ok !== false) markProgramSwitchApplied(i)
                      }}
                      type="button"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
                      </svg>
                      <span className={styles.adjustmentBtnText}>{msg.programSwitch.summary}</span>
                    </button>
                  )}
                  {msg.role === 'assistant' && msg.programSwitchApplied && (
                    <div className={styles.adjustmentApplied}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                      Program bytt
                    </div>
                  )}
                  {msg.role === 'assistant' && msg.newProgram && !msg.newProgramApplied && onApplyNewProgram && (
                    <button
                      className={styles.adjustmentBtn}
                      onClick={async () => {
                        const ok = await onApplyNewProgram(msg.newProgram)
                        if (ok !== false) markNewProgramApplied(i)
                      }}
                      type="button"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14M12 5v14"/>
                      </svg>
                      <span className={styles.adjustmentBtnText}>
                        Skapa program: {msg.newProgram.name} ({msg.newProgram.sessions.length} pass)
                      </span>
                    </button>
                  )}
                  {msg.role === 'assistant' && msg.newProgramApplied && (
                    <div className={styles.adjustmentApplied}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                      Program sparat
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
    </>
  )

  // Inline-lage: chatten ar sjalva sidan (egen flik). Ingen overlay/animering.
  if (inline) {
    return <div className={styles.inlineContainer}>{content}</div>
  }

  // Overlay-lage: sheet som glider in over passet (oforandrat beteende).
  return (
    <AnimatePresence>
      {open && (
        <>
          <div className={styles.sheetBackdrop} />
          <motion.div
            className={styles.sheet}
            initial={{ x: '100%', opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
          >
            {content}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
