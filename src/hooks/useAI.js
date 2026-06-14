import { useState, useCallback, useRef } from 'react'
import { chatWithAI, parseAdjustment, parseDeload, parseWorkoutPlan, parseProgramChange, parseProgramSwitch, parseNewProgram } from '../lib/ai'

export function useAI({ getContext, getMemory, getDeloadStatus, getAvailableExercises, getProgramsList, coachMode = false }) {
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
      const context = await getContext?.()
      const memory = getMemory?.()
      const deloadStatus = getDeloadStatus?.()
      const availableExercises = getAvailableExercises?.()
      const reply = await chatWithAI({ messages: next, context, memory, deloadStatus, availableExercises, coachMode })
      const adj = parseAdjustment(reply)
      const dl = parseDeload(adj.displayText)
      const wp = parseWorkoutPlan(dl.displayText)
      const pc = parseProgramChange(wp.displayText, availableExercises?.map(e => e.name) || [])
      const ps = parseProgramSwitch(pc.displayText, getProgramsList?.() || [])
      const np = parseNewProgram(ps.displayText, availableExercises?.map(e => e.name) || [])
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,
        displayContent: np.displayText || ps.displayText || pc.displayText || wp.displayText || dl.displayText || adj.displayText || reply,
        adjustment: adj.adjustment,
        deload: dl.deload,
        workoutPlan: wp.workoutPlan,
        programChange: pc.programChange,
        programSwitch: ps.programSwitch,
        newProgram: np.newProgram,
      }])
    } catch (err) {
      const status = err?.status
      let msg
      if (status === 429) {
        msg = 'PT:n är upptagen just nu – vänta en liten stund och försök igen.'
      } else if (status === 529 || status === 503) {
        msg = 'PT-tjänsten är tillfälligt överbelastad – försök igen om en stund.'
      } else if (status >= 500) {
        msg = 'Något gick fel hos PT-tjänsten – försök igen om en stund.'
      } else {
        msg = 'Kunde inte nå PT – försök igen.'
      }
      setError(msg)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [getContext, getMemory, getDeloadStatus, getAvailableExercises, getProgramsList, coachMode])

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

  const markWorkoutApplied = useCallback((messageIndex) => {
    setMessages(prev => prev.map((m, i) =>
      i === messageIndex ? { ...m, workoutApplied: true } : m
    ))
  }, [])

  const markProgramChangeApplied = useCallback((messageIndex) => {
    setMessages(prev => prev.map((m, i) =>
      i === messageIndex ? { ...m, programChangeApplied: true } : m
    ))
  }, [])

  const markProgramSwitchApplied = useCallback((messageIndex) => {
    setMessages(prev => prev.map((m, i) =>
      i === messageIndex ? { ...m, programSwitchApplied: true } : m
    ))
  }, [])

  const markNewProgramApplied = useCallback((messageIndex) => {
    setMessages(prev => prev.map((m, i) =>
      i === messageIndex ? { ...m, newProgramApplied: true } : m
    ))
  }, [])

  return { messages, loading, error, send, reset, markAdjustmentApplied, markDeloadApplied, markWorkoutApplied, markProgramChangeApplied, markProgramSwitchApplied, markNewProgramApplied }
}
