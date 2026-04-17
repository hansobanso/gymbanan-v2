import { useState, useRef, useCallback, useEffect } from 'react'
import { createWorkout, updateWorkout, getPreviousSetsForExercise, getExerciseByName, getRestOverrides } from '../lib/db'

// Smart progression based on last session's LAST work set + RIR.
// Philosophy: progression happens between sessions. We look at the last set
// (not the best) because it shows true fatigue state. RIR tells us if there
// was room for more reps.
//
// Rules:
//   RIR 0  → same reps (you were maxed out, adding a rep is the progression)
//   RIR 1  → +1 rep
//   RIR 2+ → +1 rep  
//   reps >= repsMax → increase weight, reset to repsMin ("promote")
//   no RIR → +1 rep (default, conservative)
function calcProgression(lastW, lastR, lastRir, repsMin, repsMax) {
  if (!lastW || !lastR) return { targetW: lastW || 0, targetR: lastR || 0 }

  // If already at or above rep max → promote: increase weight, reset reps
  if (repsMin != null && repsMax != null && lastR >= repsMax) {
    const targetW = Math.round((lastW + 2.5) * 2) / 2  // round to 0.5
    const targetR = repsMin
    return { targetW, targetR, promoted: true }
  }

  // Calculate rep target based on RIR
  let addReps = 1  // default: try one more rep
  if (lastRir === 0) {
    // Was completely maxed — just match last reps (the progression IS doing it again)
    addReps = 0
  }

  const targetR = repsMax != null ? Math.min(lastR + addReps, repsMax) : lastR + addReps
  return { targetW: lastW, targetR }
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
        // Use LAST work set from previous session (not best) — it reflects true fatigue
        const prevWork = prevSets.filter(s => s.type === 'work' && s.subtype !== 'backoff')
        const lastWorkSet = prevWork.length > 0 ? prevWork[prevWork.length - 1] : null
        const lastW = lastWorkSet ? (parseFloat(lastWorkSet.weight) || 0) : 0
        const lastR = lastWorkSet ? (parseInt(lastWorkSet.reps) || 0) : 0
        const lastRir = lastWorkSet?.rir ?? null
        const backoffWeight = lastW > 0 ? Math.round(lastW * 0.85 / 2.5) * 2.5 : 0
        // For backoff reps, use previous backoff if available, otherwise lastR + 2
        const prevBackoff = prevSets.filter(s => s.subtype === 'backoff' && s.done && parseInt(s.reps) > 0)
        const backoffReps = prevBackoff.length > 0 ? parseInt(prevBackoff[prevBackoff.length - 1].reps) : (lastR > 0 ? lastR + 2 : 0)

        // Smart progression
        const { targetW, targetR, promoted } = calcProgression(lastW, lastR, lastRir, ex.defaultRepsMin ?? null, ex.defaultRepsMax ?? null)
        const progressionHint = promoted ? `Dags att öka → ${targetW}kg` : null

        const sets = ex.sets.map(set => {
          if (set.subtype === 'backoff') {
            return {
              ...set,
              weight: backoffWeight > 0 ? String(backoffWeight) : '',
              reps: backoffReps > 0 ? String(backoffReps) : '',
              rir: null,  // user fills in themselves
              prefilled: backoffWeight > 0,
            }
          }
          if (set.type === 'warmup') {
            const prev = prevSets.filter(s => s.type === 'warmup')[warmupIdx++]
            if (!prev) return set
            return { ...set, weight: prev.weight ?? set.weight, reps: prev.reps ?? set.reps }
          }
          // Work set - apply smart progression
          if (targetW > 0) {
            return {
              ...set,
              weight: String(targetW),
              reps: String(targetR),
              rir: null,  // always empty — user fills in after set
              prefilled: true,
            }
          }
          return set
        })
        return { ...ex, restSeconds, sets, progressionHint, prevSets, exNotes, exEquipment, dataLoaded: true }
      }))
      setLoading(false)
    }).catch(() => { setLoading(false) })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const [programChanged, setProgramChanged] = useState(false)
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

      // Use last work set from previous session as baseline (consistent with prefill)
      const prevWork = (ex.prevSets ?? []).filter(s => s.type === 'work' && s.subtype !== 'backoff')
      const lastWorkSet = prevWork.length > 0 ? prevWork[prevWork.length - 1] : null
      const lastW = lastWorkSet ? (parseFloat(lastWorkSet.weight) || 0) : 0
      const lastR = lastWorkSet ? (parseInt(lastWorkSet.reps) || 0) : 0
      const lastRir = lastWorkSet?.rir ?? null

      const { targetW, targetR } = calcProgression(lastW, lastR, lastRir, min, max)
      const shouldUpdate = targetW > 0

      const sets = ex.sets.map(s => {
        if (s.type !== 'work' || s.subtype === 'backoff' || s.done) return s
        if (!shouldUpdate) return s
        return { ...s, weight: String(targetW), reps: String(targetR), prefilled: true }
      })

      const anyUpdated = shouldUpdate && sets.some((s, i) => s !== ex.sets[i])
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
        if (!wasCompleted && completingSet?.type === 'work' && completingSet.weight) {
          const completedIdx = sets.findIndex(s => s.id === setId)
          const nextWorkIdx = sets.findIndex((s, i) =>
            i > completedIdx && s.type === 'work' && !s.done
          )
          if (nextWorkIdx !== -1) {
            const nextSet = sets[nextWorkIdx]
            if (!nextSet.weight || nextSet.weight === '0' || nextSet.prefilled) {
              sets = sets.map((s, i) =>
                i === nextWorkIdx ? { ...s, weight: completingSet.weight, prefilled: false } : s
              )
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
    })
    return id
  }

  const applyDeload = useCallback(() => {
    setExercises(prev => prev.map(ex => {
      const hasPrefilled = ex.sets.some(s => s.type === 'work' && s.prefilled && s.weight)
      if (!hasPrefilled) return ex
      const sets = ex.sets.map(s => {
        if (s.type !== 'work' || !s.prefilled || !s.weight) return s
        const w = parseFloat(s.weight)
        if (!w) return s
        return { ...s, weight: String(Math.round(w * 0.9 / 2.5) * 2.5) }
      })
      const newW = sets.find(s => s.type === 'work' && s.prefilled)?.weight
      return { ...ex, sets, progressionHint: newW ? `PT: Ta det lugnt idag → ${newW}kg` : ex.progressionHint }
    }))
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
    addExercise,
    removeExercise,
    replaceExercise,
    updateExercise,
    updateExerciseReps,
    completeSet,
    finishWorkout,
    ensureWorkout,
    applyDeload,
    programChanged,
    repsUpdatedAt,
  }
}
