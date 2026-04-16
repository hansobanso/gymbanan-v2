import { useState, useRef, useCallback, useEffect } from 'react'
import { createWorkout, updateWorkout, getPreviousSetsForExercise, getExerciseByName, getRestOverrides } from '../lib/db'

// Given best previous work (weight, reps) and a rep range, compute target weight/reps.
function calcProgression(bestW, bestR, repsMin, repsMax) {
  if (!bestW || !bestR) return { targetW: bestW || 0, targetR: bestR || 0 }
  if (repsMin != null && repsMax != null && bestR >= repsMax) {
    const targetW = Math.round((bestW + 2.5) * 2) / 2  // round to 0.5
    const targetR = repsMin
    return { targetW, targetR, promoted: true }
  }
  const targetR = repsMax != null ? Math.min(bestR + 1, repsMax) : bestR + 1
  return { targetW: bestW, targetR }
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
        // Best previous work set
        const prevWork = prevSets.filter(s => s.type === 'work')
        const bestW = prevWork.length > 0 ? Math.max(...prevWork.map(s => parseFloat(s.weight) || 0)) : 0
        const bestR = bestW > 0
          ? Math.max(...prevWork.filter(s => parseFloat(s.weight) === bestW).map(s => parseInt(s.reps) || 0))
          : 0
        const lastRir = bestW > 0 ? (prevWork.find(s => parseFloat(s.weight) === bestW)?.rir ?? null) : null
        const backoffWeight = bestW > 0 ? Math.round(bestW * 0.85 / 2.5) * 2.5 : 0

        // Smart progression
        const { targetW, targetR, promoted } = calcProgression(bestW, bestR, ex.defaultRepsMin ?? null, ex.defaultRepsMax ?? null)
        const progressionHint = promoted ? `Dags att öka → ${targetW}kg` : null

        const sets = ex.sets.map(set => {
          if (set.subtype === 'backoff') {
            return {
              ...set,
              weight: backoffWeight > 0 ? String(backoffWeight) : '',
              reps: bestR > 0 ? String(bestR + 2) : '',
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
      restSeconds: defaultRest,
      aiComment: '',
      sets: [makeSet('work')],
    }])
  }, [defaultRest])

  const removeExercise = useCallback((exId) => {
    setProgramChanged(true)
    setExercises(prev => prev.filter(ex => ex.localId !== exId))
  }, [])

  const replaceExercise = useCallback((exId, newEx) => {
    setProgramChanged(true)
    setExercises(prev => prev.map(ex =>
      ex.localId !== exId ? ex : {
        ...ex,
        exerciseId: newEx.id ?? null,
        name: newEx.name,
        muscleGroup: newEx.muscle_group ?? null,
      }
    ))
  }, [])

  const [repsUpdatedAt, setRepsUpdatedAt] = useState(null)

  const updateExerciseReps = useCallback((exId, min, max) => {
    setProgramChanged(true)
    setExercises(prev => prev.map(ex => {
      if (ex.localId !== exId) return ex

      // Use only previous session's sets as baseline for progression.
      // Progression happens BETWEEN sessions, not within — if we used doneWork from
      // the current session, we'd double-progress (user already increased by hitting
      // more reps this session, and then we'd suggest another +1 on top).
      const prevWork = (ex.prevSets ?? []).filter(s => s.type === 'work')
      const baseWork = prevWork

      const bestW = baseWork.length > 0 ? Math.max(...baseWork.map(s => parseFloat(s.weight) || 0)) : 0
      const bestR = bestW > 0
        ? Math.max(...baseWork.filter(s => parseFloat(s.weight) === bestW).map(s => parseInt(s.reps) || 0))
        : 0

      const { targetW, targetR } = calcProgression(bestW, bestR, min, max)
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
