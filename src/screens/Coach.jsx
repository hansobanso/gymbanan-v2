import { useState, useEffect, useCallback } from 'react'
import AiChat from '../components/shared/AiChat'
import { buildCoachContext } from '../lib/ai'
import { getPrograms, getActiveProgram, getWorkouts, getAiMemory, getProfile, getExercises } from '../lib/db'

/**
 * Fristaende PT-chatt (egen flik). Inte knuten till ett pass - PT:n far
 * kontext om aktivt program, kommande pass och senaste traning, och kan
 * svara pa allmanna fragor. (Etapp 1: ren chatt, lasande kontext.)
 */
export default function Coach({ session }) {
  const [context, setContext] = useState('')
  const [memory, setMemory] = useState(null)
  const [exerciseList, setExerciseList] = useState([])

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
        const activeProgram = await getActiveProgram(session.user.id, programs).catch(() => null)
        if (cancelled) return
        setMemory(mem || null)
        setExerciseList(exercises || [])
        setContext(buildCoachContext({
          activeProgram,
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

  return (
    <AiChat
      inline
      getContext={getContext}
      getMemory={getMemory}
      getAvailableExercises={() => exerciseList}
    />
  )
}
