import { useState, useCallback, useRef } from 'react'
import { chatWithAI, parseAdjustment, parseDeload } from '../lib/ai'

export function useAI({ getContext, getMemory, getDeloadStatus }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const loadingRef = useRef(false)

  const send = useCallback(async (userText) => {
    const text = userText.trim()
    if (!text || loadingRef.current) return

    loadingRef.current = true
    setLoading(true)
    setError(null)

    // Las aktuella meddelanden via setMessages-callback for att undvika
    // stale closure — useCallback fangar annars gamla messages-referensen.
    let next
    setMessages(prev => {
      next = [...prev, { role: 'user', content: text }]
      return next
    })

    // Vanta en tick sa state har uppdaterats
    await new Promise(r => setTimeout(r, 0))

    try {
      const context = getContext?.()
      const memory = getMemory?.()
      const deloadStatus = getDeloadStatus?.()
      const reply = await chatWithAI({ messages: next, context, memory, deloadStatus })
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
      loadingRef.current = false
      setLoading(false)
    }
  }, [getContext, getMemory, getDeloadStatus])

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
