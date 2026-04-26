import { useState, useRef, useCallback, useEffect } from 'react'
import { createWorkout, updateWorkout, getPreviousSetsForExercise, getExerciseByName, getRestOverrides } from '../lib/db'

// Smart per-set progression based on previous session.
// Each set matches its corresponding set from last session (S1→S1, S2→S2).
// Always push forward: +1 rep regardless of RIR.
// Promotion (add weight, reset reps) ONLY happens when ALL work sets from last
// session hit the rep max. Otherwise just add reps to the lagging sets — the
// goal is for the user to max reps on every set before moving up in weight.
function calcProgression(prevW, prevR, repsMin, repsMax, shouldPromote) {
  if (!prevR) return { targetW: prevW || 0, targetR: prevR || 0 }

  const isBodyweight = !prevW || prevW === 0

  // Exercise-level promotion: add weight (or start adding weight for bodyweight)
  if (shouldPromote && repsMin != null) {
    const targetW = isBodyweight ? 2.5 : Math.round((prevW + 2.5) * 2) / 2
    const targetR = repsMin
    return { targetW, targetR, promoted: true }
  }

  // No promotion: push reps forward (cap at repsMax so we stay in the range)
  const targetR = repsMax != null ? Math.min(prevR + 1, repsMax) : prevR + 1
  return { targetW: prevW || 0, targetR }
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function makeSet(type, prevSets = []) {
  // Take weight/reps from the last set of this type that has a value filled in (not just done)
  const last = [...prevSets].reverse().find(s => s.type === type && s.weight)
  return {
    id: uid(),
    type,
    weight: last?.weight ?? '',
    reps: last?.reps ?? '',
    rir: null,  // always start empty — user fills in themselves
    done: false,
  }
}

function sessionExToEx(ex) {
  // Accept both camelCase (from Settings editor) and snake_case (from DB schema)
  const warmupCount = ex.warmupSets ?? ex.warmup_sets ?? 0
  const workCount = ex.workSets ?? ex.work_sets ?? 3
  const backoffCount = ex.backoffSets ?? ex.backoff_sets ?? 0
  return {
    localId: uid(),
    exerciseId: ex.exercise_id ?? null,
    name: ex.name ?? 'Övning',
    muscleGroup: ex.muscleGroup ?? ex.muscle_group ?? null,
    restSeconds: ex.restSeconds ?? ex.rest_seconds ?? null,
    notes: ex.notes ?? '',
    defaultRepsMin: ex.repsMin ?? ex.default_reps_min ?? ex.defaultRepsMin ?? null,
    defaultRepsMax: ex.repsMax ?? ex.default_reps_max ?? ex.defaultRepsMax ?? null,
    aiComment: '',
    progressionHint: null,
    prevSets: null,
    exNotes: null,
    exEquipment: null,
    dataLoaded: false,
    sets: [
      ...Array.from({ length: warmupCount }, () => makeSet('warmup')),
      ...Array.from({ length: workCount }, () => makeSet('work')),
      ...Array.from({ length: backoffCount }, () => ({ id: uid(), type: 'work', subtype: 'backoff', weight: '', reps: '', rir: null, done: false })),
    ],
  }
}

const ACTIVE_WORKOUT_KEY = 'gymbanan_active_workout'

export function useWorkout({ sessionName, sessionExercises = [], programId, userId, resumed, aiMemory = '', defaultRest = 120 }) {
  const [exercises, setExercises] = useState(() =>
    resumed
      ? resumed.exercises
      : sessionExercises.length > 0
        ? sessionExercises.map(sessionExToEx)
        : []
  )
  const [loading, setLoading] = useState(!resumed)

  // Pre-fill weight/reps/rir from last session + preload exercise metadata
  useEffect(() => {
    if (!userId || sessionExercises.length === 0 || resumed) { setLoading(false); return }
    Promise.all([
      Promise.all(
        sessionExercises.map(ex => Promise.all([
          getPreviousSetsForExercise(userId, ex.name ?? 'Övning'),
          getExerciseByName(ex.name ?? 'Övning'),
        ]))
      ),
      getRestOverrides(userId),
    ]).then(([results, restOverrides]) => {
      const prevSetsArray = results.map(([sets]) => sets)
      const exDataArray = results.map(([, exData]) => exData)
      setExercises(prev => prev.map((ex, i) => {
        const prevSets = prevSetsArray[i]
        const exData = exDataArray[i]
        const exNotes = exData?.notes || exData?.instructions || null
        const exEquipment = exData?.equipment || null
        // Apply per-exercise rest override if no program-level restSeconds is set
        const restSeconds = ex.restSeconds ?? (restOverrides[ex.name] ?? null)
        if (!prevSets?.length) return { ...ex, restSeconds, exNotes, exEquipment, dataLoaded: true }
        let warmupIdx = 0
        let workIdx = 0
        // Separate previous work sets (non-backoff) and backoff sets
        const prevWork = prevSets.filter(s => s.type === 'work' && s.subtype !== 'backoff')
        const prevBackoffSets = prevSets.filter(s => s.subtype === 'backoff' && s.done && parseInt(s.reps) > 0)
        // Use highest weight from previous work sets for backoff calculation
        const bestPrevW = prevWork.length > 0 ? Math.max(...prevWork.map(s => parseFloat(s.weight) || 0)) : 0
        const backoffWeight = bestPrevW > 0 ? Math.round(bestPrevW * 0.85 / 2.5) * 2.5 : 0

        // Exercise-level promotion decision: ALL work sets must have hit rep max.
        // This enforces "max reps on every set before adding weight" progression.
        const repsMax = ex.defaultRepsMax ?? null
        const shouldPromote = repsMax != null && prevWork.length > 0 &&
          prevWork.every(s => (parseInt(s.reps) || 0) >= repsMax)

        // Check if any set got promoted (for hint display)
        let anyPromoted = false
        let promotedWeight = 0

        const sets = ex.sets.map(set => {
          if (set.subtype === 'backoff') {
            // Match backoff sets per-index too
            const prevBo = prevBackoffSets[0] // typically only one backoff
            const boReps = prevBo ? parseInt(prevBo.reps) : 0
            return {
              ...set,
              weight: backoffWeight > 0 ? String(backoffWeight) : '',
              reps: boReps > 0 ? String(boReps) : '',
              rir: null,
              prefilled: backoffWeight > 0,
            }
          }
          if (set.type === 'warmup') {
            const prev = prevSets.filter(s => s.type === 'warmup')[warmupIdx++]
            if (!prev) return set
            return { ...set, weight: prev.weight ?? set.weight, reps: prev.reps ?? set.reps }
          }
          // Work set — match per-index against previous session's work sets
          const prevSet = prevWork[workIdx++]
          if (!prevSet) return set
          const prevW = parseFloat(prevSet.weight) || 0
          const prevR = parseInt(prevSet.reps) || 0
          // Skip if there's NO data at all (no weight AND no reps).
          // For bodyweight (prevW = 0 but prevR > 0), we still want progression.
          if (prevW <= 0 && prevR <= 0) return set

          const { targetW, targetR, promoted } = calcProgression(prevW, prevR, ex.defaultRepsMin ?? null, repsMax, shouldPromote)
          if (promoted) { anyPromoted = true; promotedWeight = targetW }

          return {
            ...set,
            weight: targetW > 0 ? String(targetW) : '',
            reps: String(targetR),
            rir: null,
            prefilled: true,
          }
        })

        const progressionHint = anyPromoted ? `Dags att öka → ${promotedWeight}kg` : null

        return { ...ex, restSeconds, sets, progressionHint, prevSets, exNotes, exEquipment, dataLoaded: true }
      }))
      setLoading(false)
    }).catch(() => { setLoading(false) })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const [programChanged, setProgramChanged] = useState(false)
  // True när passet har anpassats av PT (sjukpass, deload, etc) - vid spara
  // ska vi INTE fråga om programmet ska uppdateras, eftersom anpassningen
  // bara gäller det här specifika passet, inte programmet i stort.
  const [isAdjustedSession, setIsAdjustedSession] = useState(false)
  const [workoutId, setWorkoutId] = useState(resumed?.workoutId ?? null)
  const workoutIdRef = useRef(resumed?.workoutId ?? null)
  const ensurePromiseRef = useRef(null)
  const startedAt = useRef(resumed ? new Date(resumed.startedAt) : new Date())

  // Skapa workout-raden i Supabase direkt vid start (inte lazily)
  useEffect(() => {
    if (!resumed) ensureWorkout()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function ensureWorkout() {
    if (workoutIdRef.current) return workoutIdRef.current
    if (ensurePromiseRef.current) return ensurePromiseRef.current

    ensurePromiseRef.current = createWorkout({
      user_id: userId,
      program_id: programId ?? null,
      session_name: sessionName,
    }).then(rec => {
      workoutIdRef.current = rec.id
      setWorkoutId(rec.id)
      ensurePromiseRef.current = null
      return rec.id
    })

    return ensurePromiseRef.current
  }

  const updateSet = useCallback((exId, setId, field, value) => {
    setExercises(prev => prev.map(ex =>
      ex.localId !== exId ? ex : {
        ...ex,
        sets: ex.sets.map(s => s.id !== setId ? s : {
          ...s,
          [field]: value,
          prefilled: (field === 'weight' || field === 'reps') ? false : s.prefilled,
        }),
      }
    ))
  }, [])

  const addBackoffSet = useCallback((exId) => {
    setProgramChanged(true)
    setExercises(prev => prev.map(ex => {
      if (ex.localId !== exId) return ex
      const lastWork = [...ex.sets].reverse().find(s => s.type === 'work' && s.weight)
      let weight = '', reps = ''
      if (lastWork) {
        const raw = parseFloat(lastWork.weight) || 0
        if (raw > 0) weight = String(Math.round(raw * 0.85 / 2.5) * 2.5)
        const r = parseInt(lastWork.reps) || 0
        if (r > 0) reps = String(r + 2)
      }
      return {
        ...ex,
        sets: [...ex.sets, { id: uid(), type: 'work', subtype: 'backoff', weight, reps, rir: null, done: false }],
      }
    }))
  }, [])

  const addSet = useCallback((exId, type) => {
    setProgramChanged(true)
    setExercises(prev => prev.map(ex => {
      if (ex.localId !== exId) return ex
      if (type === 'warmup') {
        // Insert after the last warmup set, before the first work set
        const lastWarmupIdx = ex.sets.reduce((last, s, i) => s.type === 'warmup' ? i : last, -1)
        const newSet = makeSet('warmup', ex.sets)
        const sets = [...ex.sets]
        sets.splice(lastWarmupIdx + 1, 0, newSet)
        return { ...ex, sets }
      }
      return { ...ex, sets: [...ex.sets, makeSet(type, ex.sets)] }
    }))
  }, [])

  const removeSet = useCallback((exId, setId) => {
    setProgramChanged(true)
    setExercises(prev => prev.map(ex =>
      ex.localId !== exId ? ex : { ...ex, sets: ex.sets.filter(s => s.id !== setId) }
    ))
  }, [])

  const duplicateSet = useCallback((exId, setId) => {
    setProgramChanged(true)
    setExercises(prev => prev.map(ex => {
      if (ex.localId !== exId) return ex
      const idx = ex.sets.findIndex(s => s.id === setId)
      if (idx === -1) return ex
      const orig = ex.sets[idx]
      // Clone the set with a new id and reset done/completedAt
      const cloned = {
        ...orig,
        id: uid(),
        done: false,
        completedAt: null,
        prefilled: false,
      }
      const sets = [...ex.sets]
      sets.splice(idx + 1, 0, cloned)
      return { ...ex, sets }
    }))
  }, [])

  const addExercise = useCallback((ex) => {
    setProgramChanged(true)
    setExercises(prev => [...prev, {
      localId: uid(),
      exerciseId: ex.id ?? null,
      name: ex.name,
      muscleGroup: ex.muscle_group ?? null,
      restSeconds: ex.default_rest ?? defaultRest,
      defaultRepsMin: ex.default_reps_min ?? null,
      defaultRepsMax: ex.default_reps_max ?? null,
      aiComment: '',
      prevSets: null,
      exNotes: ex.notes ?? ex.instructions ?? null,
      exEquipment: ex.equipment ?? null,
      dataLoaded: false,  // triggers fetch of previous sets
      sets: [makeSet('work')],
    }])
  }, [defaultRest])

  const removeExercise = useCallback((exId) => {
    setProgramChanged(true)
    setExercises(prev => prev.filter(ex => ex.localId !== exId))
  }, [])

  const replaceExercise = useCallback((exId, newEx) => {
    setProgramChanged(true)
    setExercises(prev => prev.map(ex => {
      if (ex.localId !== exId) return ex
      // Reset everything exercise-specific: sets, prevSets, notes, reps range
      // Keep the same number of warmup/work/backoff sets but clear values
      const warmupCount = ex.sets.filter(s => s.type === 'warmup').length
      const workCount = ex.sets.filter(s => s.type === 'work' && s.subtype !== 'backoff').length
      const backoffCount = ex.sets.filter(s => s.subtype === 'backoff').length
      return {
        ...ex,
        exerciseId: newEx.id ?? null,
        name: newEx.name,
        muscleGroup: newEx.muscle_group ?? null,
        prevSets: null,
        exNotes: null,
        exEquipment: null,
        progressionHint: null,
        dataLoaded: false,  // triggers re-fetch of prev sets for new exercise
        defaultRepsMin: newEx.default_reps_min ?? null,
        defaultRepsMax: newEx.default_reps_max ?? null,
        sets: [
          ...Array.from({ length: warmupCount }, () => makeSet('warmup')),
          ...Array.from({ length: workCount }, () => makeSet('work')),
          ...Array.from({ length: backoffCount }, () => ({ id: uid(), type: 'work', subtype: 'backoff', weight: '', reps: '', rir: null, done: false })),
        ],
      }
    }))
  }, [])

  const [repsUpdatedAt, setRepsUpdatedAt] = useState(null)

  const updateExerciseReps = useCallback((exId, min, max) => {
    setProgramChanged(true)
    setExercises(prev => prev.map(ex => {
      if (ex.localId !== exId) return ex

      // Per-set matching against previous session
      const prevWork = (ex.prevSets ?? []).filter(s => s.type === 'work' && s.subtype !== 'backoff')
      let workIdx = 0

      // Exercise-level promotion decision based on new rep max
      const shouldPromote = max != null && prevWork.length > 0 &&
        prevWork.every(s => (parseInt(s.reps) || 0) >= max)

      const sets = ex.sets.map(s => {
        if (s.type !== 'work' || s.subtype === 'backoff' || s.done) return s
        const prevSet = prevWork[workIdx++]
        if (!prevSet) return s
        const prevW = parseFloat(prevSet.weight) || 0
        const prevR = parseInt(prevSet.reps) || 0
        if (prevW <= 0 && prevR <= 0) return s

        const { targetW, targetR } = calcProgression(prevW, prevR, min, max, shouldPromote)
        return {
          ...s,
          weight: targetW > 0 ? String(targetW) : '',
          reps: String(targetR),
          prefilled: true,
        }
      })

      const anyUpdated = sets.some((s, i) => s !== ex.sets[i])
      if (anyUpdated) setRepsUpdatedAt(Date.now())

      return { ...ex, defaultRepsMin: min, defaultRepsMax: max, sets }
    }))
  }, [])

  const updateExercise = useCallback((exId, field, value) => {
    setExercises(prev => prev.map(ex =>
      ex.localId !== exId ? ex : { ...ex, [field]: value }
    ))
  }, [])

  const completeSet = useCallback(async (exId, setId) => {
    await ensureWorkout()
    setExercises(prev => {
      const next = prev.map(ex => {
        if (ex.localId !== exId) return ex
        const completingSet = ex.sets.find(s => s.id === setId)
        const wasCompleted = completingSet?.done
        // Toggle set
        let sets = ex.sets.map(s => s.id !== setId ? s : { ...s, done: !s.done })
        // Copy weight to next undone work set when completing a work set
        if (!wasCompleted && completingSet?.type === 'work' && completingSet.subtype !== 'backoff' && completingSet.weight) {
          const completedIdx = sets.findIndex(s => s.id === setId)
          const nextWorkIdx = sets.findIndex((s, i) =>
            i > completedIdx && s.type === 'work' && s.subtype !== 'backoff' && !s.done
          )
          if (nextWorkIdx !== -1) {
            const nextSet = sets[nextWorkIdx]
            if (!nextSet.weight || nextSet.weight === '0' || nextSet.prefilled) {
              sets = sets.map((s, i) =>
                i === nextWorkIdx ? { ...s, weight: completingSet.weight, prefilled: false } : s
              )
            }
          }

          // Auto-fill back-off sets when this is the LAST work set being completed
          // Back-off uses ~85% of this work set's weight and +3 reps (more volume at lighter load)
          const remainingWorkSets = sets.filter(s =>
            s.type === 'work' && s.subtype !== 'backoff' && !s.done
          )
          if (remainingWorkSets.length === 0) {
            const workW = parseFloat(completingSet.weight) || 0
            const workR = parseInt(completingSet.reps) || 0
            if (workW > 0 && workR > 0) {
              const backoffW = Math.round(workW * 0.85 / 2.5) * 2.5
              const backoffR = workR + 3
              sets = sets.map(s => {
                if (s.subtype !== 'backoff' || s.done) return s
                // Only auto-fill if empty or prefilled (respect user's manual edits)
                if (s.weight && !s.prefilled) return s
                return {
                  ...s,
                  weight: String(backoffW),
                  reps: String(backoffR),
                  prefilled: true,
                }
              })
            }
          }
        }
        return { ...ex, sets }
      })
      const wId = workoutIdRef.current
      if (wId) {
        try {
          const data = {
            workoutId: wId,
            exercises: next,
            startedAt: startedAt.current.toISOString(),
            sessionName,
          }
          localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(data))
          const saved = localStorage.getItem(ACTIVE_WORKOUT_KEY)
        } catch {}
      }
      return next
    })
  }, [sessionName])

  async function finishWorkout() {
    localStorage.removeItem(ACTIVE_WORKOUT_KEY)
    const id = await ensureWorkout()
    const payload = exercises.map(ex => ({
      exercise_id: ex.exerciseId,
      name: ex.name,
      muscle_group: ex.muscleGroup,
      ai_comment: ex.aiComment,
      sets: ex.sets,
    }))
    await updateWorkout(id, {
      finished_at: new Date().toISOString(),
      exercises: payload,
      adjusted: isAdjustedSession,
    })
    return id
  }

  const applyDeload = useCallback(() => {
    setIsAdjustedSession(true)
    setExercises(prev => prev.map(ex => {
      const hasPrefilled = ex.sets.some(s => s.prefilled && s.weight)
      if (!hasPrefilled) return ex
      // Sänk vikt 10% på alla prefilled sets (warmup + work + backoff)
      const sets = ex.sets.map(s => {
        if (!s.prefilled || !s.weight) return s
        const w = parseFloat(s.weight)
        if (!w) return s
        return { ...s, weight: String(Math.round(w * 0.9 / 2.5) * 2.5) }
      })
      const newW = sets.find(s => s.type === 'work' && s.prefilled)?.weight
      return { ...ex, sets, progressionHint: newW ? `PT: Ta det lugnt idag → ${newW}kg` : ex.progressionHint }
    }))
  }, [])

  /**
   * Tillämpar ett strukturerat justeringsförslag från PT.
   * adjustment = { summary, changes: [{ exerciseName, weightMultiplier?, repsMultiplier?, repsMin?, repsMax?, setMultiplier? }] }
   *
   * - weightMultiplier: gångrar vikter på alla icke-gjorda sets (warmup + work + backoff).
   * - repsMultiplier: gångrar prefilled reps på alla icke-gjorda sets (för kroppsviktsövningar
   *   som inte har vikt - då sänks reps istället).
   * - repsMin/repsMax: skriver om exercise-level rep-mål.
   * - setMultiplier: gångrar antalet WORK-sets (avrundas, minst 1). Warmup oförändrad.
   */
  const applyAdjustment = useCallback((adjustment) => {
    if (!adjustment?.changes?.length) return false
    setIsAdjustedSession(true)
    setExercises(prev => prev.map(ex => {
      const change = adjustment.changes.find(c => c.exerciseName === ex.name)
      if (!change) return ex

      let sets = ex.sets

      // Justera vikter på alla icke-gjorda sets (warmup, work, backoff)
      if (typeof change.weightMultiplier === 'number' && change.weightMultiplier > 0) {
        sets = sets.map(s => {
          if (s.done) return s
          if (!s.weight) return s
          const w = parseFloat(s.weight)
          if (!w) return s
          const newW = Math.round(w * change.weightMultiplier / 2.5) * 2.5
          return { ...s, weight: String(newW), prefilled: true }
        })
      }

      // Justera reps på alla icke-gjorda sets (för kroppsvikt-övningar utan vikt)
      if (typeof change.repsMultiplier === 'number' && change.repsMultiplier > 0) {
        sets = sets.map(s => {
          if (s.done) return s
          if (!s.reps) return s
          const r = parseFloat(s.reps)
          if (!r) return s
          const newR = Math.max(1, Math.round(r * change.repsMultiplier))
          return { ...s, reps: String(newR), prefilled: true }
        })
      }

      // Justera antal work-sets
      if (typeof change.setMultiplier === 'number' && change.setMultiplier > 0 && change.setMultiplier !== 1) {
        const workSets = sets.filter(s => s.type === 'work' && !s.done)
        const targetCount = Math.max(1, Math.round(workSets.length * change.setMultiplier))
        if (targetCount < workSets.length) {
          // Ta bort sets från slutet (work-typen, icke-gjorda)
          const toRemove = workSets.length - targetCount
          // Ta bort de sista N icke-gjorda work-setsen (bevarar gjorda)
          let removed = 0
          sets = sets.slice().reverse().filter(s => {
            if (removed < toRemove && s.type === 'work' && !s.done) {
              removed++
              return false
            }
            return true
          }).reverse()
        }
        // Att lägga till sets är inte säkert (subtype-logik etc.), så vi sänker bara antal.
      }

      const next = { ...ex, sets }
      if (typeof change.repsMin === 'number') next.repsMin = change.repsMin
      if (typeof change.repsMax === 'number') next.repsMax = change.repsMax
      next.progressionHint = `PT: ${adjustment.summary}`
      return next
    }))
    return true
  }, [])

  return {
    workoutId,
    loading,
    startedAt: startedAt.current,
    exercises,
    setExercises,
    updateSet,
    addSet,
    addBackoffSet,
    removeSet,
    duplicateSet,
    addExercise,
    removeExercise,
    replaceExercise,
    updateExercise,
    updateExerciseReps,
    completeSet,
    finishWorkout,
    ensureWorkout,
    applyDeload,
    applyAdjustment,
    programChanged,
    isAdjustedSession,
    repsUpdatedAt,
  }
}
