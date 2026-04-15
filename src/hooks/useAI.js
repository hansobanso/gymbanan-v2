import { useState, useCallback } from 'react'
import { chatWithAI } from '../lib/ai'

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
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
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

  return { messages, loading, error, send, reset }
}
