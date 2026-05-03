import { useState, useEffect, useRef, useCallback } from 'react'

export function useTimer() {
  const [active, setActive]           = useState(false)
  const [paused, setPaused]           = useState(false)
  const [exerciseName, setExerciseName] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [totalSeconds, setTotalSeconds] = useState(0)

  const endTimeRef    = useRef(null) // Date.now() + totalMs
  const pausedLeftRef = useRef(0)    // seconds remaining when paused
  const tickRef       = useRef(null)

  function clearTick() {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
  }

  const start = useCallback((name, seconds) => {
    clearTick()
    endTimeRef.current = Date.now() + seconds * 1000
    setExerciseName(name)
    setSecondsLeft(seconds)
    setTotalSeconds(seconds)
    setActive(true)
    setPaused(false)
    tickRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left <= 0) {
        clearInterval(tickRef.current); tickRef.current = null
        setActive(false)
        try { navigator.vibrate?.([200, 100, 200]) } catch { /* ignored */ }
      }
    }, 500)
  }, [])

  const stop = useCallback(() => {
    clearTick()
    endTimeRef.current = null
    setActive(false)
    setPaused(false)
  }, [])

  const pause = useCallback(() => {
    if (!endTimeRef.current) return
    pausedLeftRef.current = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
    clearTick()
    setPaused(true)
  }, [])

  const resume = useCallback(() => {
    endTimeRef.current = Date.now() + pausedLeftRef.current * 1000
    setPaused(false)
    tickRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left <= 0) {
        clearInterval(tickRef.current); tickRef.current = null
        setActive(false)
        try { navigator.vibrate?.([200, 100, 200]) } catch { /* ignored */ }
      }
    }, 500)
  }, [])

  const addSeconds = useCallback((delta) => {
    if (!endTimeRef.current) return
    endTimeRef.current = endTimeRef.current + delta * 1000
    const left = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
    setSecondsLeft(left)
    if (delta > 0) setTotalSeconds(prev => Math.max(prev, left))
  }, [])

  useEffect(() => () => clearTick(), [])

  return { active, paused, exerciseName, secondsLeft, totalSeconds, start, stop, pause, resume, addSeconds }
}
