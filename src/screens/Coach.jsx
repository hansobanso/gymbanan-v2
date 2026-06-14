import { useState, useEffect, useCallback } from 'react'
import AiChat from '../components/shared/AiChat'
import { buildCoachContext, applyProgramChange } from '../lib/ai'
import { getPrograms, getActiveProgram, getWorkouts, getAiMemory, getProfile, getExercises, updateProgram, saveProgram } from '../lib/db'

/**
 * Fristaende PT-chatt (egen flik). PT:n far kontext om aktivt program,
 * ovriga program, kommande pass och senaste traning.
 * Etapp 2: foresla andringar i aktiva programmet (bekraftas med "tillampa").
 * Etapp 3: foresla byte av aktivt program (bekraftas med "tillampa").
 */
export default function Coach({ session, onProgramUpdated, onSwitchProgram, onProgramCreated }) {
  const [context, setContext] = useState('')
  const [memory, setMemory] = useState(null)
  const [exerciseList, setExerciseList] = useState([])
  const [activeProgram, setActiveProgram] = useState(null)
  const [allPrograms, setAllPrograms] = useState([])

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
        // Ge PT:n ALLA program anvandaren har tillgang till - bade egna
        // och globala mallar (t.ex. "Jeff") - sa den kan ge rad om dem.
        setAllPrograms(programs || [])
        setContext(buildCoachContext({
          activeProgram: active,
          allPrograms: programs || [],
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

  // Bygg kontexten FARSKT vid varje meddelande, sa PT:n alltid ser den
  // senaste versionen av programmen - aven om anvandaren andrat i ett
  // program mitt under en pagaende chatt. Faller tillbaka pa det cachade
  // contextet om hamtningen skulle misslyckas.
  const getContext = useCallback(async () => {
    try {
      const [programs, recent, profile] = await Promise.all([
        getPrograms(session.user.id),
        getWorkouts(session.user.id, 5),
        getProfile(session.user.id).catch(() => null),
      ])
      const active = await getActiveProgram(session.user.id, programs).catch(() => null)
      // Hall delat state i synk sa knappar/validering anvander farsk data
      setActiveProgram(active || null)
      setAllPrograms(programs || [])
      return buildCoachContext({
        activeProgram: active,
        allPrograms: programs || [],
        recentWorkouts: recent || [],
        displayName: profile?.display_name || null,
      })
    } catch {
      return context
    }
  }, [session.user.id, context])
  const getMemory = useCallback(() => memory, [memory])
  const getProgramsList = useCallback(
    () => allPrograms.map(p => ({ id: p.id, name: p.name })),
    [allPrograms]
  )

  const rebuildContext = useCallback((active, programs) => {
    setContext(buildCoachContext({
      activeProgram: active,
      allPrograms: programs,
      recentWorkouts: [],
      displayName: null,
    }))
  }, [])

  // Etapp 2: tillampa andring i aktiva programmet och spara.
  const onApplyProgramChange = useCallback(async (programChange) => {
    if (!activeProgram?.id) return false
    try {
      const newSessions = applyProgramChange(activeProgram.sessions || [], programChange)
      await updateProgram(activeProgram.id, { sessions: newSessions })
      const updated = { ...activeProgram, sessions: newSessions }
      setActiveProgram(updated)
      setAllPrograms(prev => prev.map(p => p.id === updated.id ? updated : p))
      onProgramUpdated?.(updated)
      rebuildContext(updated, allPrograms.map(p => p.id === updated.id ? updated : p))
      return true
    } catch {
      return false
    }
  }, [activeProgram, allPrograms, onProgramUpdated, rebuildContext])

  // Etapp 3: byt aktivt program.
  const onApplyProgramSwitch = useCallback(async (programSwitch) => {
    const target = allPrograms.find(p => p.id === programSwitch.programId)
    if (!target) return false
    try {
      await onSwitchProgram?.(target.id)
      setActiveProgram(target)
      rebuildContext(target, allPrograms)
      return true
    } catch {
      return false
    }
  }, [allPrograms, onSwitchProgram, rebuildContext])

  // Etapp 4: skapa ett helt nytt program (sparas, blir EJ aktivt).
  const onApplyNewProgram = useCallback(async (np) => {
    try {
      const saved = await saveProgram({
        name: np.name,
        sessions: np.sessions,
        is_global: false,
        user_id: session.user.id,
        created_by: session.user.id,
      })
      setAllPrograms(prev => [...prev, saved])
      onProgramCreated?.(saved)
      return true
    } catch {
      return false
    }
  }, [session.user.id, onProgramCreated])

  return (
    <AiChat
      inline
      getContext={getContext}
      getMemory={getMemory}
      getAvailableExercises={() => exerciseList}
      getProgramsList={getProgramsList}
      onApplyProgramChange={activeProgram ? onApplyProgramChange : undefined}
      onApplyProgramSwitch={allPrograms.length > 1 ? onApplyProgramSwitch : undefined}
      onApplyNewProgram={onApplyNewProgram}
    />
  )
}
