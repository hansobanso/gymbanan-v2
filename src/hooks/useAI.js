import { useState, useCallback } from 'react'
import { chatWithAI, parseAdjustment, parseDeload } from '../lib/ai'

export function useAI({ getContext, getMemory, getDeloadStatus }) {
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
      const deloadStatus = getDeloadStatus?.()
      const reply = await chatWithAI({ messages: next, context, memory, deloadStatus })
      // Parsar EN av två möjliga: adjustment eller deload (inte båda)
      const adj = parseAdjustment(reply)
      const dl = parseDeload(adj.displayText)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,
        displayContent: dl.displayText || adj.displayText || reply,
        adjustment: adj.adjustment,
        deload: dl.deload,
      }])
    } catch (err) {
      setError('Kunde inte nå PT – försök igen.')
    } finally {
      setLoading(false)
    }
  }, [messages, loading, getContext, getMemory, getDeloadStatus])

  const reset = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  const markAdjustmentApplied = useCallback((messageIndex) => {
    setMessages(prev => prev.map((m, i) =>
      i === messageIndex ? { ...m, adjustmentApplied: true } : m
    ))
  }, [])

  const markDeloadApplied = useCallback((messageIndex) => {
    setMessages(prev => prev.map((m, i) =>
      i === messageIndex ? { ...m, deloadApplied: true } : m
    ))
  }, [])

  return { messages, loading, error, send, reset, markAdjustmentApplied, markDeloadApplied }
}
