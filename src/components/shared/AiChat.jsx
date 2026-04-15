import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAI } from '../../hooks/useAI'
import styles from './AiChat.module.css'

const SUGGESTIONS = [
  'Hur ser min progression ut?',
  'Är vikterna rimliga?',
  'Tips för nästa pass?',
]

export default function AiChat({ open, onClose, getContext, getMemory, onUpdateMemory, introMessage }) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const { messages, loading, error, send } = useAI({ getContext, getMemory })

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

            {/* Meddelanden */}
            <div className={styles.messages}>
              {introMessage && (
                <div className={styles.introBubble}>
                  <span className={styles.introLabel}>Inför passet</span>
                  <p className={styles.introText}>{introMessage}</p>
                </div>
              )}
              {messages.length === 0 && !introMessage && (
                <div className={styles.empty}>
                  <p className={styles.emptyTitle}>Vad kan jag hjälpa dig med?</p>
                  <p className={styles.emptyText}>
                    Ställ frågor om teknik, belastning, återhämtning eller progression.
                  </p>
                  <div className={styles.suggestions}>
                    {SUGGESTIONS.map(s => (
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
                  {msg.content}
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
        </>
      )}
    </AnimatePresence>
  )
}
