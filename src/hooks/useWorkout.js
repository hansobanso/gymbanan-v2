import { useState, useRef, useCallback, useEffect } from 'react'
import { createWorkout, updateWorkout, getTwoPreviousSetsForExercise, getExerciseByName, getRestOverrides, getUserExerciseNote, getWorkouts } from '../lib/db'
import { computeProgression, deriveCategory, epleyAdjustedReps } from '../lib/progression'
import { detectGapAdjustment } from '../lib/ai'

// Smart default viktsteg baserat pa equipment. Anvands nar exercises.weight_increment ar null.
function defaultWeightIncrement(equipment) {
  const eq = (equipment ?? '').toLowerCase()
  if (eq === 'hantel') return 2
  if (eq === 'skivstång') return 2.5
  if (eq === 'maskin') return 5
  if (eq === 'kabel') return 2.5
  if (eq === 'kroppsvikt') return 2.5
  return 2.5
}

// uid + makeSet hjalp-funktioner

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
    exInstructions: null,  // globala instruktioner (exercises.instructions)
    exNotes: null,         // personlig anteckning (user_exercise_notes)
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

// Hamtar prev-historik + ovningsmetadata for en ovning och returnerar
// en uppdaterad version av ex med dataLoaded: true. Anvands bade vid
// mount och vid byte av ovning mid-pass.
async function loadExerciseData(ex, userId, restOverrides) {
  const [{ prev: prevSets, prevPrev: prevPrevSets }, exData, userNote] = await Promise.all([
    getTwoPreviousSetsForExercise(userId, ex.name ?? 'Övning'),
    getExerciseByName(ex.name ?? 'Övning'),
    getUserExerciseNote(userId, ex.name ?? 'Övning'),
  ])
  const exInstructions = exData?.instructions || null
  const exNotes = userNote ?? null
  const exEquipment = exData?.equipment || null
  const restSeconds = ex.restSeconds ?? (restOverrides?.[ex.name] ?? null)

  if (!prevSets?.length) {
    return { ...ex, restSeconds, exInstructions, exNotes, exEquipment, prevSets: null, progressionHint: null, progressionAction: null, dataLoaded: true }
  }

  // Harleda ovningskategori fran equipment + movement_pattern
  const equipment = exData?.equipment ?? null
  const movementPattern = exData?.movement_pattern ?? null
  const category = deriveCategory(equipment, movementPattern)

  // Viktsteg: explicit fran DB, annars smart default baserat pa equipment
  const weightIncrement = exData?.weight_increment
    ?? defaultWeightIncrement(equipment)

  const repsMin = ex.defaultRepsMin ?? null
  const repsMax = ex.defaultRepsMax ?? null

  // Antal work sets (ej warmup, ej backoff) i nuvarande program
  const numWorkSets = ex.sets.filter(s => s.type === 'work' && s.subtype !== 'backoff').length

  // Kor nya progressionsmotorn
  const progression = computeProgression({
    prevSets,
    prevPrevSets,
    repsMin,
    repsMax,
    category,
    weightIncrement,
    numWorkSets,
  })

  // Prefyll set baserat pa progressionens forslag
  let warmupIdx = 0
  let workIdx = 0
  const prevWork = prevSets.filter(s => s.type === 'work' && s.subtype !== 'backoff')
  const prevBackoffSets = prevSets.filter(s => s.subtype === 'backoff' && s.done && parseInt(s.reps) > 0)
  const bestPrevW = prevWork.length > 0 ? Math.max(...prevWork.map(s => parseFloat(s.weight) || 0)) : 0
  const backoffWeight = bestPrevW > 0 ? Math.round(bestPrevW * 0.85 / weightIncrement) * weightIncrement : 0

  const sets = ex.sets.map(set => {
    if (set.subtype === 'backoff') {
      const prevBo = prevBackoffSets[0]
      const boReps = prevBo ? parseInt(prevBo.reps) : 0
      // Backoff vikten baseras pa nya work-vikten om den hojts
      const effectiveW = progression.action === 'increase_weight' ? progression.nextWeight : bestPrevW
      const boWeight = effectiveW > 0 ? Math.round(effectiveW * 0.85 / weightIncrement) * weightIncrement : backoffWeight
      return {
        ...set,
        weight: boWeight > 0 ? String(boWeight) : '',
        reps: boReps > 0 ? String(boReps) : '',
        rir: null,
        prefilled: boWeight > 0,
      }
    }
    if (set.type === 'warmup') {
      const prev = prevSets.filter(s => s.type === 'warmup')[warmupIdx++]
      if (!prev) return set
      return { ...set, weight: prev.weight ?? set.weight, reps: prev.reps ?? set.reps }
    }

    // Work set — anvand progressionsmotorns forslag
    const targetReps = progression.nextTargetRepsPerSet[workIdx] ?? (repsMin ?? 0)
    workIdx++

    return {
      ...set,
      weight: progression.nextWeight > 0 ? String(progression.nextWeight) : '',
      reps: targetReps > 0 ? String(targetReps) : '',
      rir: null,
      prefilled: progression.nextWeight > 0,
    }
  })

  // Progressionshint for UI
  const progressionHint = progression.messageToUser

  return {
    ...ex,
    restSeconds,
    sets,
    progressionHint,
    progressionAction: progression.action,
    progressionReason: progression.reason,
    prevSets,
    exInstructions,
    exNotes,
    exEquipment,
    weightIncrement,
    movementPattern,
    dataLoaded: true,
  }
}

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
    let cancelled = false

    async function loadAll() {
      try {
        const [restOverrides, recentWorkouts] = await Promise.all([
          getRestOverrides(userId),
          getWorkouts(userId, 20).catch(() => []),
        ])
        if (cancelled) return

        // Detektera traningsuppehall
        const exNames = exercises.map(e => e.name)
        const gapAdj = detectGapAdjustment(recentWorkouts, exNames)

        // Ladda alla ovningar parallellt
        const results = await Promise.all(
          exercises.map(ex => loadExerciseData(ex, userId, restOverrides).catch(() => null))
        )
        if (cancelled) return

        // Applicera ALLT i en enda setExercises-update:
        // 1) loadExerciseData-resultat (progression, vikter, reps)
        // 2) gap-justering (sank vikter/reps vid uppehall)
        setExercises(prev => prev.map((ex, i) => {
          // Steg 1: merge loadExerciseData-resultat
          let updated = results[i] ? { ...results[i], localId: ex.localId } : ex

          // Steg 2: applicera gap-justering pa RESULTATET fran steg 1
          if (gapAdj) {
            const change = gapAdj.changes.find(c => c.exerciseName === updated.name)
            if (change) {
              let adjustedWeight = false
              let adjustedReps = false
              const inc = updated.weightIncrement ?? defaultWeightIncrement(updated.exEquipment)

              const sets = updated.sets.map(s => {
                if (s.done) return s
                const w = parseFloat(s.weight) || 0
                const r = parseInt(s.reps) || 0

                if (w > 0 && change.weightMultiplier) {
                  const newW = Math.floor(w * change.weightMultiplier / inc) * inc
                  // Om avrundningen gor att vikten inte andras (t.ex. 10*0.9=9→10)
                  // sank reps istallet som fallback
                  if (newW >= w && r > 0 && change.repsMultiplier) {
                    const newR = Math.max(1, Math.round(r * change.repsMultiplier))
                    adjustedReps = true
                    return { ...s, reps: String(newR), prefilled: true }
                  }
                  adjustedWeight = true
                  return { ...s, weight: String(newW), prefilled: true }
                } else if (w <= 0 && r > 0 && change.repsMultiplier) {
                  const newR = Math.max(1, Math.round(r * change.repsMultiplier))
                  adjustedReps = true
                  return { ...s, reps: String(newR), prefilled: true }
                }
                return s
              })

              // Kort per-ovning hint baserat pa vad som faktiskt justerades
              const days = gapAdj.summary.match(/\d+/)?.[0] ?? '?'
              let hint
              if (adjustedWeight) {
                hint = `PT: ${days} dagar sedan senaste pass. Sänkt vikt.`
              } else if (adjustedReps) {
                hint = `PT: ${days} dagar sedan senaste pass. Färre reps.`
              } else {
                hint = `PT: ${days} dagar sedan senaste pass.`
              }

              updated = { ...updated, sets, progressionHint: hint, progressionAction: 'gap_adjustment' }
            }
          }

          return updated
        }))

        if (gapAdj) setIsAdjustedSession(true)
        setLoading(false)
      } catch {
        setLoading(false)
      }
    }

    loadAll()
    return () => { cancelled = true }
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
    setExercises(prev => prev.map(ex => {
      if (ex.localId !== exId) return ex

      const sets = ex.sets.map(s => {
        if (s.id !== setId) return s

        // Spara ursprunglig vikt/reps fran progressionsmotorn vid forsta andring.
        // Dessa andras aldrig — anvands for Epley-omrakning vid alla viktandringar.
        const originWeight = s._originWeight ?? (s.prefilled ? s.weight : null)
        const originReps = s._originReps ?? (s.prefilled ? s.reps : null)

        const updated = {
          ...s,
          [field]: value,
          _originWeight: originWeight,
          _originReps: originReps,
          prefilled: (field === 'weight' || field === 'reps') ? false : s.prefilled,
        }

        // Epley-omrakning vid VARJE viktandring (inte bara forsta).
        // Anvander ursprungsvikt/reps fran progressionsmotorn, inte nuvarande.
        // Hoppa over om anvandaren andrat reps manuellt (field === 'reps').
        if (field === 'weight' && originWeight && originReps) {
          const plannedW = parseFloat(originWeight) || 0
          const plannedR = parseInt(originReps) || 0
          const actualW = parseFloat(value) || 0

          if (plannedW > 0 && plannedR > 0 && actualW > 0) {
            if (actualW === plannedW) {
              // Tillbaka till ursprungsvikt → aterga till ursprungsreps
              updated.reps = String(plannedR)
            } else {
              const adjustedR = epleyAdjustedReps(plannedW, plannedR, actualW)
              updated.reps = String(adjustedR)
            }
            updated.epleyAdjusted = true
          }
        }

        // Om anvandaren andrar reps manuellt, sluta med Epley-omrakning
        if (field === 'reps') {
          updated._originWeight = null
          updated._originReps = null
        }

        return updated
      })

      return { ...ex, sets }
    }))
  }, [])

  const addBackoffSet = useCallback((exId) => {
    // Set-justeringar (extra/borttaget set) ar engangsbeteende for dagens
    // pass och triggar inte programChanged. Bara ovning-relaterade
    // strukturandringar (ny ovning, borttagen ovning, byt ovning, andrad
    // reps-target) prompar 'spara kopia / uppdatera program'.
    setExercises(prev => prev.map(ex => {
      if (ex.localId !== exId) return ex
      const lastWork = [...ex.sets].reverse().find(s => s.type === 'work' && s.weight)
      let weight = '', reps = ''
      if (lastWork) {
        const raw = parseFloat(lastWork.weight) || 0
        const inc = ex.weightIncrement ?? defaultWeightIncrement(ex.exEquipment)
        if (raw > 0) weight = String(Math.round(raw * 0.85 / inc) * inc)
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
    setExercises(prev => prev.map(ex =>
      ex.localId !== exId ? ex : { ...ex, sets: ex.sets.filter(s => s.id !== setId) }
    ))
  }, [])

  const duplicateSet = useCallback((exId, setId) => {
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
      exInstructions: ex.instructions ?? null,
      exNotes: null, // personlig anteckning - laddas via loadExerciseData
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
      // Reset everything exercise-specific: sets, prevSets, notes
      // Keep the same number of warmup/work/backoff sets but clear values
      const warmupCount = ex.sets.filter(s => s.type === 'warmup').length
      const workCount = ex.sets.filter(s => s.type === 'work' && s.subtype !== 'backoff').length
      const backoffCount = ex.sets.filter(s => s.subtype === 'backoff').length
      // Behall passets rep-intervall om det fanns - det reflekterar
      // hur PT:n eller anvandaren satte upp passet, inte den nya
      // ovningens defaults. Bara om passet inte hade satta reps faller
      // vi tillbaka pa den nya ovningens default.
      const keepRepsMin = ex.defaultRepsMin ?? newEx.default_reps_min ?? null
      const keepRepsMax = ex.defaultRepsMax ?? newEx.default_reps_max ?? null
      return {
        ...ex,
        exerciseId: newEx.id ?? null,
        name: newEx.name,
        muscleGroup: newEx.muscle_group ?? null,
        prevSets: null,
        exInstructions: null,
        exNotes: null,
        exEquipment: null,
        progressionHint: null,
        dataLoaded: false,
        defaultRepsMin: keepRepsMin,
        defaultRepsMax: keepRepsMax,
        sets: [
          ...Array.from({ length: warmupCount }, () => makeSet('warmup')),
          ...Array.from({ length: workCount }, () => makeSet('work')),
          ...Array.from({ length: backoffCount }, () => ({ id: uid(), type: 'work', subtype: 'backoff', weight: '', reps: '', rir: null, done: false })),
        ],
      }
    }))
    // Hamta nya ovningens senaste historik och sla ihop in i state.
    // Vi maste lasa ut den uppdaterade ovningen ur state via en fresh
    // setExercises-callback eftersom prev-variabeln ovan har gamla namnet.
    if (userId) {
      getRestOverrides(userId).then(restOverrides => {
        setExercises(curr => {
          const target = curr.find(e => e.localId === exId)
          if (!target) return curr
          loadExerciseData(target, userId, restOverrides).then(updated => {
            setExercises(c => c.map(e => e.localId === exId ? { ...updated, localId: e.localId } : e))
          }).catch(() => {})
          return curr
        })
      }).catch(() => {})
    }
  }, [userId])

  const [repsUpdatedAt, setRepsUpdatedAt] = useState(null)

  const updateExerciseReps = useCallback((exId, min, max) => {
    setProgramChanged(true)
    setExercises(prev => prev.map(ex => {
      if (ex.localId !== exId) return ex

      // Kor progressionsmotorn med nya repintervallet
      const prevWork = (ex.prevSets ?? []).filter(s => s.type === 'work' && s.subtype !== 'backoff')
      const numWorkSets = ex.sets.filter(s => s.type === 'work' && s.subtype !== 'backoff').length

      if (!prevWork.length) {
        return { ...ex, defaultRepsMin: min, defaultRepsMax: max }
      }

      const progression = computeProgression({
        prevSets: ex.prevSets,
        prevPrevSets: null, // inte tillgangligt synkront, OK for rep-andring
        repsMin: min,
        repsMax: max,
        category: deriveCategory(ex.exEquipment, ex.movementPattern),
        weightIncrement: ex.weightIncrement ?? defaultWeightIncrement(ex.exEquipment),
        numWorkSets,
      })

      let workIdx = 0
      const sets = ex.sets.map(s => {
        if (s.type !== 'work' || s.subtype === 'backoff' || s.done) return s
        const targetReps = progression.nextTargetRepsPerSet[workIdx] ?? (min ?? 0)
        workIdx++
        return {
          ...s,
          weight: progression.nextWeight > 0 ? String(progression.nextWeight) : s.weight,
          reps: targetReps > 0 ? String(targetReps) : s.reps,
          prefilled: true,
        }
      })

      const anyUpdated = sets.some((s, i) => s !== ex.sets[i])
      if (anyUpdated) setRepsUpdatedAt(Date.now())

      return {
        ...ex,
        defaultRepsMin: min,
        defaultRepsMax: max,
        sets,
        progressionHint: progression.messageToUser,
        progressionAction: progression.action,
      }
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
            const backoffInc = ex.weightIncrement ?? defaultWeightIncrement(ex.exEquipment)
            const workW = parseFloat(completingSet.weight) || 0
            const workR = parseInt(completingSet.reps) || 0
            if (workW > 0 && workR > 0) {
              const backoffW = Math.round(workW * 0.85 / backoffInc) * backoffInc
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
        const inc = ex.weightIncrement ?? defaultWeightIncrement(ex.exEquipment)
        return { ...s, weight: String(Math.floor(w * 0.9 / inc) * inc) }
      })
      const newW = sets.find(s => s.type === 'work' && s.prefilled)?.weight
      return { ...ex, sets, progressionHint: newW ? `PT: Ta det lugnt idag → ${newW}kg` : ex.progressionHint, progressionAction: 'gap_adjustment' }
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
        const inc = ex.weightIncrement ?? defaultWeightIncrement(ex.exEquipment)
        sets = sets.map(s => {
          if (s.done) return s
          if (!s.weight) return s
          const w = parseFloat(s.weight)
          if (!w) return s
          const newW = Math.floor(w * change.weightMultiplier / inc) * inc
          return { ...s, weight: String(newW), prefilled: true }
        })
      }

      // Justera reps pa icke-gjorda sets UTAN vikt (kroppsviktsovningar).
      // Ovningar som har vikt justeras via weightMultiplier istallet.
      if (typeof change.repsMultiplier === 'number' && change.repsMultiplier > 0) {
        sets = sets.map(s => {
          if (s.done) return s
          if (!s.reps) return s
          // Hoppa over sets som har vikt — de justeras av weightMultiplier
          const hasWeight = s.weight && parseFloat(s.weight) > 0
          if (hasWeight) return s
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
      next.progressionAction = 'gap_adjustment'
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
