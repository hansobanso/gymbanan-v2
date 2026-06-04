import { useState, useEffect, useCallback } from 'react'
import AiChat from '../components/shared/AiChat'
import { buildCoachContext, applyProgramChange } from '../lib/ai'
import { getPrograms, getActiveProgram, getWorkouts, getAiMemory, getProfile, getExercises, updateProgram } from '../lib/db'

/**
 * Fristaende PT-chatt (egen flik). Inte knuten till ett pass - PT:n far
 * kontext om aktivt program, kommande pass och senaste traning.
 * Etapp 2: PT:n kan foresla andringar i det aktiva programmet, som
 * anvandaren maste bekrafta ("tillampa") innan de sparas.
 */
export default function Coach({ session, onProgramUpdated }) {
  const [context, setContext] = useState('')
  const [memory, setMemory] = useState(null)
  const [exerciseList, setExerciseList] = useState([])
  const [activeProgram, setActiveProgram] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [programs, recent, mem, profile, exercises] = await Promise.all([
          getPrograms(session.user.id),
          getWorkouts(session.user.id, 5),
          getAiMemory(session.user.id).catch(() => null),
          getProfile(session.user.id).catch(() => null),
          getExercises().catch(() => []),
        ])
        const active = await getActiveProgram(session.user.id, programs).catch(() => null)
        if (cancelled) return
        setMemory(mem || null)
        setExerciseList(exercises || [])
        setActiveProgram(active || null)
        setContext(buildCoachContext({
          activeProgram: active,
          recentWorkouts: recent || [],
          displayName: profile?.display_name || null,
        }))
      } catch {
        if (!cancelled) setContext('')
      }
    }
    load()
    return () => { cancelled = true }
  }, [session.user.id])

  const getContext = useCallback(() => context, [context])
  const getMemory = useCallback(() => memory, [memory])

  // Tillampar en programandring pa det aktiva programmet och sparar.
  // Returnerar false om det misslyckas (da markeras den inte som tillampad).
  const onApplyProgramChange = useCallback(async (programChange) => {
    if (!activeProgram?.id) return false
    try {
      const newSessions = applyProgramChange(activeProgram.sessions || [], programChange)
      await updateProgram(activeProgram.id, { sessions: newSessions })
      const updated = { ...activeProgram, sessions: newSessions }
      setActiveProgram(updated)
      onProgramUpdated?.(updated)
      setContext(buildCoachContext({
        activeProgram: updated,
        recentWorkouts: [],
        displayName: null,
      }))
      return true
    } catch {
      return false
    }
  }, [activeProgram, onProgramUpdated])

  return (
    <AiChat
      inline
      getContext={getContext}
      getMemory={getMemory}
      getAvailableExercises={() => exerciseList}
      onApplyProgramChange={activeProgram ? onApplyProgramChange : undefined}
    />
  )
}
