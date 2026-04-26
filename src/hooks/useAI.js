import { useState, useCallback } from 'react'
import { chatWithAI, parseAdjustment } from '../lib/ai'

export function useAI({ getContext, getMemory }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const send = useCallback(async (userText) => {
    const text = userText.trim()
    if (!text || loading) return

    const userMsg = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setLoading(true)
    setError(null)

    try {
      const context = getContext?.()
      const memory = getMemory?.()
      const reply = await chatWithAI({ messages: next, context, memory })
      const { displayText, adjustment } = parseAdjustment(reply)
      // Save the raw reply (with the JSON tags) in the API conversation,
      // but render only displayText. Adjustment becomes a button.
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,           // raw - skickas tillbaka till AI:n vid nästa message
        displayContent: displayText || reply,
        adjustment,
      }])
    } catch (err) {
      setError('Kunde inte nå PT – försök igen.')
    } finally {
      setLoading(false)
    }
  }, [messages, loading, getContext])

  const reset = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  // Markera ett meddelandes adjustment som applied (knappen visas inte längre)
  const markAdjustmentApplied = useCallback((messageIndex) => {
    setMessages(prev => prev.map((m, i) =>
      i === messageIndex ? { ...m, adjustmentApplied: true } : m
    ))
  }, [])

  return { messages, loading, error, send, reset, markAdjustmentApplied }
}
