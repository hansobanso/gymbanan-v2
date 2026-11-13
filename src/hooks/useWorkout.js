import { useState, useRef, useCallback, useEffect } from 'react'
import { createWorkout, updateWorkout, deleteUnfinishedWorkout, getTwoPreviousSetsForExercise, getExerciseByName, getRestOverrides, getUserExerciseNote, getWorkouts, getExercises, getAllUserExerciseNotes, cacheInvalidate } from '../lib/db'
import { computeProgression, deriveCategory, epleyAdjustedReps, detectGapAdjustment, suggestNextSetReps, warmupPlan, detectPlateau } from '../lib/progression'
import { sortSupersetsAdjacent } from '../lib/superset.js'
import { namesMatching } from '../lib/exerciseAliases.js'
import { defaultWeightIncrement } from '../lib/weightUtils'

// ── Personbasta (PB) ────────────────────────────────────────────
// Bygger per ovning: tyngsta vikt nagonsin + flest reps per vikt, fran
// historiken. Ett klarat set ar PB om det slar tyngsta vikten (aven 1 rep)
// ELLER tar fler reps an nagonsin pa exakt den vikten.
function buildPbMap(workouts) {
  const map = {}
  for (const w of workouts ?? []) {
    for (const ex of w.exercises ?? []) {
      if (!ex?.name) continue
      let e = map[ex.name]
      if (!e) e = map[ex.name] = { maxWeight: null, reps: {} }
      for (const s of ex.sets ?? []) {
        if (!s.done || s.type !== 'work' || s.subtype === 'backoff') continue
        const r = parseInt(s.reps)
        if (Number.isNaN(r) || r <= 0) continue
        const wf = parseFloat(s.weight)
        const wv = Number.isNaN(wf) ? 0 : wf
        if (e.maxWeight == null || wv > e.maxWeight) e.maxWeight = wv
        if (e.reps[wv] == null || r > e.reps[wv]) e.reps[wv] = r
      }
    }
  }
  return map
}

// Ar detta set ett PB? REN funktion av historiken + de set som redan ar
// klara TIDIGARE i ovningen under passet. Inget muteras, sa att angra och
// bocka av igen ger samma svar (forut tappades PB-markeringen da).
// Forsta gangen en ovning kors (ingen historik) flaggas inget - baslinje.
function isPbSet(histMap, name, weight, reps, earlierDoneSets) {
  const hist = histMap[name]
  if (!hist) return false
  if (Number.isNaN(reps) || reps <= 0) return false
  const wv = Number.isNaN(weight) ? 0 : weight
  let maxWeight = hist.maxWeight
  let bestAtWeight = hist.reps[wv] ?? null
  for (const s of earlierDoneSets ?? []) {
    const r = parseInt(s.reps)
    if (Number.isNaN(r) || r <= 0) continue
    const wf = parseFloat(s.weight)
    const w = Number.isNaN(wf) ? 0 : wf
    if (maxWeight == null || w > maxWeight) maxWeight = w
    if (w === wv && (bestAtWeight == null || r > bestAtWeight)) bestAtWeight = r
  }
  if (maxWeight != null && wv > maxWeight) return true           // ny tyngsta vikt
  if (bestAtWeight != null && reps > bestAtWeight) return true    // fler reps pa vikten
  return false
}

// Kort uppehall (8-14 dagar): fyll i SAMMA vikter och reps som forra passet
// istallet for progressionens okning. Ror inte ovningar dar progressionen
// redan foreslar sankning/upprepning, eller tids-/kardioovningar.
function holdAtLastSession(ex, days) {
  if (ex.isTimeBased || ex.isCardio) return ex
  if (!['increase_weight', 'keep_weight_add_reps'].includes(ex.progressionAction)) return ex
  const prevWork = (ex.prevSets ?? []).filter(s => s.type === 'work' && s.subtype !== 'backoff' && s.done)
  if (prevWork.length === 0) return ex
  const inc = ex.weightIncrement ?? defaultWeightIncrement(ex.exEquipment)
  const bestPrevW = Math.max(...prevWork.map(s => parseFloat(s.weight) || 0))
  let i = 0
  const sets = ex.sets.map(s => {
    if (s.done || s.type !== 'work') return s
    if (s.subtype === 'backoff') {
      // Backoff raknades pa den hojda vikten - rakna om pa forra passets vikt
      if (ex.progressionAction !== 'increase_weight' || !s.prefilled || bestPrevW <= 0) return s
      const bw = Math.round(bestPrevW * 0.85 / inc) * inc
      return { ...s, weight: String(bw), _baseWeight: bw }
    }
    const p = prevWork[Math.min(i, prevWork.length - 1)]
    i++
    const w = parseFloat(p.weight) || 0
    return {
      ...s,
      weight: w > 0 ? String(w) : '',
      reps: parseInt(p.reps) > 0 ? String(parseInt(p.reps)) : s.reps,
      prefilled: true,
      _baseWeight: w > 0 ? w : undefined,
    }
  })
  return {
    ...ex,
    sets,
    progressionHint: `${days} dagar sedan senaste pass. Samma vikter och reps som sist.`,
    progressionAction: 'gap_adjustment',
  }
}

// Markerar varje set med progressionens ursprungliga forslag (_planWeight/
// _planReps) sa "Ingen anpassning" kan aterstalla passet efter en automatisk
// eller manuell sankning (uppehall, deload, sjuk, latt dag).
function withPlan(sets) {
  return sets.map(s => ({ ...s, _planWeight: s.weight, _planReps: s.reps }))
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
    supersetId: ex.supersetId ?? null,
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

// Sa manga pass i rad pa samma niva kravs for platavarningen
const PLATEAU_SESSIONS = 4

// Extraherar prev/prevPrev-set for en ovning fran redan hamtade workouts.
// Undviker att traffa databasen en gang per ovning (stor prestandavinst).
function extractPrevSets(recentWorkouts, exerciseName) {
  // Samma matchningsregler som getTwoPreviousSetsForExercise i db.js:
  // alias-medveten (omdopta ovningar) och returnerar datum for spårbarhet.
  const aliasNames = namesMatching(exerciseName)
  const found = []
  for (const workout of recentWorkouts ?? []) {
    if (workout.adjusted) continue
    if (!workout.finished_at) continue
    const ex = (workout.exercises ?? []).find(e => aliasNames.has(e.name))
    if (!ex) continue
    const allSets = (ex.sets ?? []).filter(s => s.done && s.weight !== undefined && s.weight !== null)
    if (allSets.length > 0) {
      found.push({ sets: allSets, date: workout.finished_at ?? null })
      if (found.length >= PLATEAU_SESSIONS) break
    }
  }
  return {
    prev: found[0]?.sets ?? null,
    prevPrev: found[1]?.sets ?? null,
    prevDate: found[0]?.date ?? null,
    history: found,
  }
}

// Platavarning: fyra pass i rad pa samma niva. Valjer man nagot (eller
// "Inte nu") tiger varningen for den ovningen i tre veckor.
const PLATEAU_SNOOZE_KEY = 'gymbanan_plateau_snooze'
const PLATEAU_SNOOZE_MS = 21 * 24 * 60 * 60 * 1000

function plateauSnoozed(name) {
  try {
    const at = JSON.parse(localStorage.getItem(PLATEAU_SNOOZE_KEY) || '{}')[name]
    return !!at && Date.now() - new Date(at).getTime() < PLATEAU_SNOOZE_MS
  } catch { return false }
}

function snoozePlateau(name) {
  try {
    const all = JSON.parse(localStorage.getItem(PLATEAU_SNOOZE_KEY) || '{}')
    all[name] = new Date().toISOString()
    localStorage.setItem(PLATEAU_SNOOZE_KEY, JSON.stringify(all))
  } catch { /* privat lage: varningen kommer tillbaka nasta pass */ }
}

// Hamtar prev-historik + ovningsmetadata for en ovning och returnerar
// en uppdaterad version av ex med dataLoaded: true. Anvands bade vid
// mount och vid byte av ovning mid-pass.
// caches: { recentWorkouts, exerciseMap, notesMap } - forhamtad delad data
// sa vi slipper en query per ovning. Saknas de gors queries (mid-pass byte).
async function loadExerciseData(ex, userId, restOverrides, caches = {}) {
  const { recentWorkouts = null, exerciseMap = null, notesMap = null } = caches
  const name = ex.name ?? 'Övning'

  // Prev-sets: anvand forhamtade workouts om de finns, annars query.
  const prevPromise = recentWorkouts
    ? Promise.resolve(extractPrevSets(recentWorkouts, name))
    : getTwoPreviousSetsForExercise(userId, name)
  // Ovningsmetadata: slas upp i forhamtad map om den finns, annars query.
  const exDataPromise = exerciseMap
    ? Promise.resolve(exerciseMap[name] ?? null)
    : getExerciseByName(name)
  // Anteckning: forhamtad map om den finns, annars query.
  const notePromise = notesMap
    ? Promise.resolve(notesMap[name] ?? null)
    : getUserExerciseNote(userId, name)

  const [{ prev: prevSets, prevPrev: prevPrevSets, prevDate, history = null }, exData, userNote] = await Promise.all([
    prevPromise, exDataPromise, notePromise,
  ])
  const exInstructions = exData?.instructions || null
  const exNotes = userNote ?? null
  const exEquipment = exData?.equipment || null
  const isTimeBased = exData?.is_time_based === true
  const isCardio = exData?.is_cardio === true
  const restSeconds = ex.restSeconds ?? (restOverrides?.[ex.name] ?? null)
  // Berika med muskelgrupp fran biblioteket - programmets pass lagrar den
  // inte, sa utan detta loggas passet med muscle_group: null.
  const muscleGroup = ex.muscleGroup ?? exData?.muscle_group ?? null
  // Viktsteg: explicit fran DB, annars default utifran redskap. Satts alltid
  // (aven utan historik) sa +/- i passet stegar ratt fran forsta gangen.
  const weightIncrement = Number(exData?.weight_increment) || defaultWeightIncrement(exData?.equipment ?? null)

  if (!prevSets?.length) {
    return { ...ex, muscleGroup, weightIncrement, restSeconds, exInstructions, exNotes, exEquipment, isTimeBased, isCardio, prevSets: null, prevDate: null, progressionHint: null, progressionAction: null, dataLoaded: true }
  }

  // Tidsbaserade ovningar (planka etc): ingen vikt/tid-progression.
  // Prefyll bara forra passets varden (sekunder lagras i reps-faltet).
  if (isTimeBased || isCardio) {
    const lastWork = prevSets.filter(s => s.type !== 'warmup')
    const lastSet = lastWork[lastWork.length - 1] ?? prevSets[prevSets.length - 1]
    const prefSets = ex.sets.map(s => {
      if (s.type === 'warmup') return s
      return {
        ...s,
        weight: lastSet?.weight ? String(lastSet.weight) : '',
        reps: lastSet?.reps ? String(lastSet.reps) : '',
        rir: null,
        prefilled: !!(lastSet?.reps),
      }
    })
    return { ...ex, muscleGroup, weightIncrement, sets: withPlan(prefSets), restSeconds, exInstructions, exNotes, exEquipment, isTimeBased, isCardio, prevSets, prevDate, progressionHint: null, progressionAction: null, _planHint: null, _planAction: null, dataLoaded: true }
  }

  // Harleda ovningskategori fran equipment + movement_pattern
  const equipment = exData?.equipment ?? null
  const movementPattern = exData?.movement_pattern ?? null
  const category = deriveCategory(equipment, movementPattern)

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

  const prevWarmupSets = prevSets.filter(s => s.type === 'warmup')
  const warmups = warmupPlan({
    workWeight: progression.nextWeight,
    count: ex.sets.filter(s => s.type === 'warmup').length,
    increment: weightIncrement,
    prevWarmups: prevWarmupSets,
    prevWorkWeight: bestPrevW,
  })

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
        _baseWeight: boWeight > 0 ? boWeight : undefined,
      }
    }
    if (set.type === 'warmup') {
      const i = warmupIdx++
      const plan = warmups[i]
      // Forslag utifran dagens arbetsvikt. _baseWeight gor att "Anpassa
      // passet" och uppehallssankning raknar pa ratt grundvikt.
      if (plan) return { ...set, weight: String(plan.weight), reps: String(plan.reps), prefilled: true, _baseWeight: plan.weight }
      // Kroppsvikt eller okand arbetsvikt: samma som forra passet
      const prev = prevWarmupSets[i]
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
      _baseWeight: progression.nextWeight > 0 ? progression.nextWeight : undefined,
    }
  })

  // Progressionshint for UI
  const progressionHint = progression.messageToUser

  return {
    ...ex,
    muscleGroup,
    restSeconds,
    sets: withPlan(sets),
    prevDate,
    isCardio,
    progressionHint,
    progressionAction: progression.action,
    // Ursprungligt tips - aterstalls av "Ingen anpassning"
    _planHint: progressionHint,
    _planAction: progression.action,
    progressionReason: progression.reason,
    plateau: history && !plateauSnoozed(name) ? detectPlateau(history, PLATEAU_SESSIONS) : null,
    prevSets,
    exInstructions,
    exNotes,
    exEquipment,
    isTimeBased,
    weightIncrement,
    movementPattern,
    dataLoaded: true,
  }
}

export function useWorkout({ sessionName, sessionExercises = [], programId, userId, resumed, defaultRest = 120 }) {
  const [exercises, setExercises] = useState(() =>
    sortSupersetsAdjacent(
      resumed
        ? resumed.exercises
        : sessionExercises.length > 0
          ? sessionExercises.map(sessionExToEx)
          : []
    )
  )
  const [loading, setLoading] = useState(!resumed)

  // PB-data: tyngsta vikt + flest reps per vikt, per ovning. Byggs fran
  // historiken (avslutade pass) vid passets start, aven vid resume, sa PB
  // kan flaggas direkt nar ett set bockas av. Kartan andras aldrig under passet.
  const pbMapRef = useRef({})
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getWorkouts(userId, 100).then(ws => {
      if (cancelled) return
      pbMapRef.current = buildPbMap(ws)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [userId])

  // Pre-fill weight/reps/rir from last session + preload exercise metadata
  useEffect(() => {
    if (!userId || sessionExercises.length === 0 || resumed) { setLoading(false); return }
    let cancelled = false

    async function loadAll() {
      try {
        // Hamta ALL delad data EN gang istallet for per-ovning-queries:
        // - restOverrides: vilotider (1 query)
        // - recentWorkouts: 20 senaste passen (1 query, anvands for prev-sets + gap)
        // - allExercises: hela ovningslistan (cachad - ofta 0 nya queries)
        // - notesMap: alla ovningsanteckningar (1 query)
        const [restOverrides, recentWorkouts, allExercises, notesMap] = await Promise.all([
          getRestOverrides(userId),
          getWorkouts(userId, 20).catch(() => []),
          getExercises().catch(() => []),
          getAllUserExerciseNotes(userId).catch(() => ({})),
        ])
        if (cancelled) return

        // Bygg namn->ovning-map for snabb uppslagning (ersatter getExerciseByName per ovning)
        const exerciseMap = {}
        for (const e of allExercises) {
          if (!exerciseMap[e.name]) exerciseMap[e.name] = e
        }
        const caches = { recentWorkouts, exerciseMap, notesMap }

        // Detektera traningsuppehall
        const exNames = exercises.map(e => e.name)
        const gapAdj = detectGapAdjustment(recentWorkouts, exNames)

        // Ladda alla ovningar parallellt - nu helt utan queries per ovning
        // (all data finns redan i caches).
        const results = await Promise.all(
          exercises.map(ex => loadExerciseData(ex, userId, restOverrides, caches).catch(() => null))
        )
        if (cancelled) return

        // Applicera ALLT i en enda setExercises-update:
        // 1) loadExerciseData-resultat (progression, vikter, reps)
        // 2) gap-justering (sank vikter/reps vid uppehall)
        setExercises(prev => prev.map((ex, i) => {
          // Steg 1: merge loadExerciseData-resultat
          let updated = results[i] ? { ...results[i], localId: ex.localId } : ex

          // Steg 2: applicera gap-justering pa RESULTATET fran steg 1
          if (gapAdj?.hold) {
            updated = holdAtLastSession(updated, gapAdj.days)
          } else if (gapAdj) {
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
                  // Narmaste viktsteg (inte golv) - golvet gjorde -10 % till -13 %
                  const newW = Math.round(w * change.weightMultiplier / inc) * inc
                  // Om avrundningen gor att vikten inte andras (t.ex. 10*0.9=9→10)
                  // sank reps istallet som fallback
                  if (newW >= w && r > 0 && change.repsMultiplier) {
                    const newR = Math.max(1, Math.round(r * change.repsMultiplier))
                    adjustedReps = true
                    return { ...s, reps: String(newR), prefilled: true }
                  }
                  adjustedWeight = true
                  // Spara originalvikten sa senare PT-justeringar utgar fran den
                  return { ...s, weight: String(newW), _baseWeight: w, prefilled: true }
                } else if (w <= 0 && r > 0 && change.repsMultiplier) {
                  const newR = Math.max(1, Math.round(r * change.repsMultiplier))
                  adjustedReps = true
                  return { ...s, reps: String(newR), prefilled: true }
                }
                return s
              })

              // Kort per-ovning hint baserat pa vad som faktiskt justerades
              const days = gapAdj.days ?? '?'
              let hint
              if (adjustedWeight) {
                hint = `${days} dagar sedan senaste pass. Sänkt vikt.`
              } else if (adjustedReps) {
                hint = `${days} dagar sedan senaste pass. Färre reps.`
              } else {
                hint = `${days} dagar sedan senaste pass.`
              }

              updated = { ...updated, sets, progressionHint: hint, progressionAction: 'gap_adjustment' }
            }
          }

          return updated
        }))

        // OBS: gap-justeringen satter INTE isAdjustedSession. Den flaggan ar
        // for sjuk/deload-pass (tillfalliga anpassningar pa anvandarens
        // begaran). Ett comeback-pass ar normal traning med lattare vikter:
        // 1) spara-i-program-dialogen ska fortfarande visas vid strukturella
        //    andringar (dialogen sparar aldrig vikter, sa inget lacker), och
        // 2) passet ska raknas som "normalt" av franvaro-detektionen, annars
        //    sanks vikterna igen nasta pass (dubbel reduktion).
        setLoading(false)
      } catch {
        setLoading(false)
      }
    }

    loadAll()
    return () => { cancelled = true }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const [programChanged, setProgramChanged] = useState(!!resumed?.programChanged)
  // True när passet har anpassats av PT (sjukpass, deload, etc) - vid spara
  // ska vi INTE fråga om programmet ska uppdateras, eftersom anpassningen
  // bara gäller det här specifika passet, inte programmet i stort.
  // Aterstalls vid resume - annars raknades ett aterupptaget sjuk-/deloadpass
  // som ett vanligt pass (sankta vikter blev ny baslinje).
  const [isAdjustedSession, setIsAdjustedSession] = useState(!!resumed?.adjusted)
  const [workoutId, setWorkoutId] = useState(resumed?.workoutId ?? null)
  const workoutIdRef = useRef(resumed?.workoutId ?? null)
  const ensurePromiseRef = useRef(null)
  const startedAt = useRef(resumed ? new Date(resumed.startedAt) : new Date())

  // Sparar hela passets tillstand till localStorage vid VARJE andring (vikt,
  // reps, avbockning, ovningar, superset ...) sa inget arbete tappas om
  // appen/telefonen dor mitt i passet. Fungerar aven UTAN workout-id (t.ex.
  // nar passet startats utan uppkoppling) - raden skapas da vid avslut.
  // MASTE definieras FORE effekten nedan som anvander den i sin dep-array,
  // annars TDZ-krash ("Cannot access 'S' before initialization") vid mount.
  const flagsRef = useRef({ adjusted: !!resumed?.adjusted, programChanged: !!resumed?.programChanged })
  const closedRef = useRef(false) // passet ar sparat/kasserat - skriv inte tillbaka nagot
  const persistWorkout = useCallback((exercisesToSave) => {
    if (closedRef.current) return
    try {
      localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify({
        workoutId: workoutIdRef.current ?? null,
        exercises: exercisesToSave,
        startedAt: startedAt.current.toISOString(),
        sessionName,
        programId: programId ?? null,
        adjusted: flagsRef.current.adjusted,
        programChanged: flagsRef.current.programChanged,
      }))
    } catch { /* localStorage full/nekad - ignorera */ }
  }, [sessionName, programId])

  useEffect(() => {
    flagsRef.current = { adjusted: isAdjustedSession, programChanged }
    // Inget att ateruppta an: ingen rad skapad och inget set avbockat.
    if (!workoutId && !exercises.some(ex => ex.sets.some(s => s.done))) return
    persistWorkout(exercises)
  }, [exercises, workoutId, persistWorkout, isAdjustedSession, programChanged])

  // Spegel av senaste exercises for asynkron kod (hydrateExercises).
  const exercisesRef = useRef(exercises)
  useEffect(() => { exercisesRef.current = exercises }, [exercises])

  // Skapa workout-raden i Supabase direkt vid start (inte lazily). Misslyckas
  // det (offline) fortsatter passet lokalt och raden skapas vid avslut.
  useEffect(() => {
    if (!resumed) ensureWorkout().catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function ensureWorkout() {
    if (workoutIdRef.current) return Promise.resolve(workoutIdRef.current)
    if (ensurePromiseRef.current) return ensurePromiseRef.current

    const p = createWorkout({
      user_id: userId,
      program_id: programId ?? null,
      session_name: sessionName,
      started_at: startedAt.current.toISOString(),
    }).then(rec => {
      workoutIdRef.current = rec.id
      setWorkoutId(rec.id)
      return rec.id
    }).finally(() => {
      // Nollstall alltid - annars aterkom ett misslyckat forsok for evigt.
      ensurePromiseRef.current = null
    })
    ensurePromiseRef.current = p
    return p
  }

  // Hamtar historik + metadata for ovningar som lagts till/bytts mitt i
  // passet och fyller i progressionens forslag (vikt/reps), precis som for
  // programmets ovningar vid start. Forut fick tillagda ovningar ingen
  // forifyllning alls.
  const hydrateExercises = useCallback((localIds) => {
    if (!userId || !localIds?.length) return
    Promise.all([
      getRestOverrides(userId).catch(() => ({})),
      getExercises().catch(() => []),
      new Promise(r => setTimeout(r, 0)), // lat state + exercisesRef hinna uppdateras
    ]).then(([restOverrides, allExercises]) => {
      const exerciseMap = {}
      for (const e of allExercises) if (!exerciseMap[e.name]) exerciseMap[e.name] = e
      for (const id of localIds) {
        const target = exercisesRef.current.find(e => e.localId === id)
        if (!target) continue
        loadExerciseData(target, userId, restOverrides, { exerciseMap }).then(updated => {
          setExercises(c => c.map(e => {
            if (e.localId !== id || e.name !== updated.name) return e
            // Hann anvandaren fylla i/bocka av nagot under laddningen:
            // behall deras set och fyll bara pa metadata.
            const touched = e.sets.length !== target.sets.length
              || e.sets.some(st => st.done || st.weight || st.reps)
            return touched
              ? { ...updated, sets: e.sets, localId: e.localId }
              : { ...updated, localId: e.localId }
          }))
        }).catch(() => {})
      }
    })
  }, [userId])

  const updateSet = useCallback((exId, setId, field, value) => {
    setExercises(prev => {
      const next = prev.map(ex => {
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
          // Kom ihag appens repmal fore forsta manuella andringen, sa vi vid
          // avbockning vet om setet gick enligt plan eller inte.
          _autoReps: s._autoReps ?? (field === 'reps' && s.prefilled ? s.reps : undefined),
          // Nollstall _baseWeight vid manuell viktandring sa nasta PT-justering
          // utgar fran det nya manuella vardet, inte den gamla originalvikten.
          _baseWeight: field === 'weight' ? undefined : s._baseWeight,
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
    })
      // Spara efter varje vikt/reps-andring sa inget tappas vid krasch
      persistWorkout(next)
      return next
    })
  }, [persistWorkout])

  const addBackoffSet = useCallback((exId) => {
    // Set-andringar (lagt till/tagit bort set) raknas numera som en
    // programandring sa 'spara kopia / uppdatera program' dyker upp vid
    // avslut och antalet set foljer med till nasta gang.
    setProgramChanged(true)
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
    // Andrat antal arbetsset ska kunna sparas till programmet. Uppvarmnings-
    // set ar for transienta for att rakna som en programandring.
    if (type !== 'warmup') setProgramChanged(true)
    setExercises(prev => prev.map(ex => {
      if (ex.localId !== exId) return ex
      if (type === 'warmup') {
        // Insert after the last warmup set, before the first work set
        const lastWarmupIdx = ex.sets.reduce((last, s, i) => s.type === 'warmup' ? i : last, -1)
        // Nytt uppvarmningsset far ett forslag utifran arbetsvikten, som ovriga
        const count = lastWarmupIdx + 2
        const workW = ex.sets.find(s => s.type === 'work' && s.subtype !== 'backoff' && parseFloat(s.weight) > 0)?.weight
        const plan = (ex.isTimeBased || ex.isCardio) ? null : warmupPlan({
          workWeight: workW,
          count,
          increment: ex.weightIncrement ?? defaultWeightIncrement(ex.exEquipment),
        })[count - 1]
        const newSet = plan
          ? { ...makeSet('warmup'), weight: String(plan.weight), reps: String(plan.reps), prefilled: true, _baseWeight: plan.weight }
          : makeSet('warmup', ex.sets)
        const sets = [...ex.sets]
        sets.splice(lastWarmupIdx + 1, 0, newSet)
        return { ...ex, sets }
      }
      return { ...ex, sets: [...ex.sets, makeSet(type, ex.sets)] }
    }))
  }, [])

  const removeSet = useCallback((exId, setId) => {
    setExercises(prev => prev.map(ex => {
      if (ex.localId !== exId) return ex
      const removed = ex.sets.find(s => s.id === setId)
      // Borttaget arbets-/backoffset raknas som programandring (ej uppvarmning).
      if (removed && removed.type !== 'warmup') setProgramChanged(true)
      return { ...ex, sets: ex.sets.filter(s => s.id !== setId) }
    }))
  }, [])

  const duplicateSet = useCallback((exId, setId) => {
    setExercises(prev => prev.map(ex => {
      if (ex.localId !== exId) return ex
      const idx = ex.sets.findIndex(s => s.id === setId)
      if (idx === -1) return ex
      if (ex.sets[idx]?.type !== 'warmup') setProgramChanged(true)
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
    const localId = uid()
    setProgramChanged(true)
    setExercises(prev => [...prev, {
      localId,
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
      isTimeBased: ex.is_time_based === true,
      isCardio: ex.is_cardio === true,
      dataLoaded: false,
      sets: [makeSet('work')],
    }])
    hydrateExercises([localId])
  }, [defaultRest, hydrateExercises])

  // Lagger till flera ovningar fran ett PT-genererat pass pa en gang.
  // plan: [{ name, sets, repsMin, repsMax }]. Slar upp varje namn i
  // exerciseList for att fa riktig ovningsdata (sa progression/muskelkarta funkar).
  const addGeneratedWorkout = useCallback((plan, exerciseList) => {
    if (!Array.isArray(plan) || plan.length === 0) return
    setProgramChanged(true)
    {
      const additions = plan.map(item => {
        // Hitta riktig ovning i databasen (case-insensitivt)
        const match = (exerciseList ?? []).find(
          e => e.name.toLowerCase() === String(item.name ?? '').toLowerCase()
        )
        if (!match) return null
        const numSets = Math.max(1, Math.min(8, parseInt(item.sets) || 3))
        const workSets = Array.from({ length: numSets }, () => makeSet('work'))
        return {
          localId: uid(),
          exerciseId: match.id ?? null,
          name: match.name,
          muscleGroup: match.muscle_group ?? null,
          restSeconds: match.default_rest ?? defaultRest,
          defaultRepsMin: item.repsMin ?? match.default_reps_min ?? null,
          defaultRepsMax: item.repsMax ?? match.default_reps_max ?? null,
          aiComment: '',
          prevSets: null,
          exInstructions: match.instructions ?? null,
          exNotes: null,
          exEquipment: match.equipment ?? null,
          isTimeBased: match.is_time_based === true,
          isCardio: match.is_cardio === true,
          dataLoaded: false, // triggar laddning av prev-sets + progression
          sets: workSets,
        }
      }).filter(Boolean)
      setExercises(prev => [...prev, ...additions])
      hydrateExercises(additions.map(a => a.localId))
    }
  }, [defaultRest, hydrateExercises])

  // Superset mitt i passet: lanka tva ovningar (ev. gamla par bryts),
  // eller bryt ett befintligt par. Raknas som programandring sa
  // spara-dialogen kan erbjuda att uppdatera programmet efterat.
  function setSupersetPair(idA, idB) {
    setExercises(prev => {
      const a = prev.find(e => e.localId === idA)
      const b = prev.find(e => e.localId === idB)
      if (!a || !b || idA === idB) return prev
      const oldIds = new Set([a.supersetId, b.supersetId].filter(Boolean))
      const ssId = 'ss_' + Math.random().toString(36).slice(2, 8)
      return sortSupersetsAdjacent(prev.map(e => {
        if (e.localId === idA || e.localId === idB) return { ...e, supersetId: ssId }
        if (e.supersetId && oldIds.has(e.supersetId)) return { ...e, supersetId: null }
        return e
      }))
    })
    setProgramChanged(true)
  }

  function clearSuperset(localId) {
    setExercises(prev => {
      const t = prev.find(e => e.localId === localId)
      if (!t?.supersetId) return prev
      const ssId = t.supersetId
      return prev.map(e => e.supersetId === ssId ? { ...e, supersetId: null } : e)
    })
    setProgramChanged(true)
  }

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
    // Hamta nya ovningens historik + progression och sla ihop in i state.
    hydrateExercises([exId])
  }, [hydrateExercises])

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
    // Vanta INTE pa natverket: forut hangde avbockningen pa att workout-raden
    // skapats, sa med dalig tackning hande inget nar man tryckte. Raden
    // skapas i bakgrunden (eller vid avslut) och setet loggas lokalt direkt.
    ensureWorkout().catch(() => {})
    setExercises(prev => {
      const next = prev.map(ex => {
        if (ex.localId !== exId) return ex
        const completingSet = ex.sets.find(s => s.id === setId)
        const wasCompleted = completingSet?.done
        // PB-koll nar setet bockas av (ej vid angra). Work-set, ej backoff.
        const willBeDone = !wasCompleted
        let isPB = false
        if (willBeDone && completingSet?.type === 'work' && completingSet.subtype !== 'backoff') {
          const idx = ex.sets.findIndex(s => s.id === setId)
          const earlierDone = ex.sets.slice(0, idx).filter(s =>
            s.done && s.type === 'work' && s.subtype !== 'backoff'
          )
          isPB = isPbSet(pbMapRef.current, ex.name, parseFloat(completingSet.weight), parseInt(completingSet.reps), earlierDone)
        }
        // Toggle set (nollstall PB-flaggan vid angra)
        let sets = ex.sets.map(s => s.id !== setId ? s : { ...s, done: willBeDone, isPB: willBeDone ? isPB : false })
        // Nar ett arbetsset bockas av: fyll i NASTA ej klara arbetsset.
        //  - Vikten foljer med (om nasta set ar tomt eller appens eget forslag).
        //  - Repmalet anpassas efter hur setet gick: 0 RIR -> ett rep mindre,
        //    1 RIR -> inte fler an nyss, missad plan -> forvanta inte mer,
        //    annars behalls planens mal (t.ex. +1 pa sista setet).
        // Set som anvandaren sjalv fyllt i rors inte.
        if (!wasCompleted && completingSet?.type === 'work' && completingSet.subtype !== 'backoff') {
          const completedIdx = sets.findIndex(s => s.id === setId)
          const nextWorkIdx = sets.findIndex((s, i) =>
            i > completedIdx && s.type === 'work' && s.subtype !== 'backoff' && !s.done
          )
          if (nextWorkIdx !== -1) {
            const nextSet = sets[nextWorkIdx]
            const patch = {}
            if (completingSet.weight && (!nextSet.weight || nextSet.weight === '0' || nextSet.prefilled)
              && String(nextSet.weight) !== String(completingSet.weight)) {
              patch.weight = completingSet.weight
              patch._baseWeight = parseFloat(completingSet.weight) || undefined
            }
            const doneReps = parseInt(completingSet.reps)
            if (doneReps > 0 && (!nextSet.reps || nextSet.prefilled)) {
              // Nasta sets mal galler bara om det ar appens forslag pa SAMMA vikt
              const nextPlanReps = nextSet.prefilled && !patch.weight ? parseInt(nextSet.reps) : null
              const donePlanReps = parseInt(completingSet._autoReps ?? (completingSet.prefilled ? completingSet.reps : NaN))
              const sug = suggestNextSetReps({
                doneReps,
                doneRir: completingSet.rir ?? null,
                donePlanReps: donePlanReps > 0 ? donePlanReps : null,
                nextPlanReps: nextPlanReps > 0 ? nextPlanReps : null,
              })
              if (sug && String(sug) !== String(nextSet.reps)) patch.reps = String(sug)
            }
            if (Object.keys(patch).length > 0) {
              sets = sets.map((s, i) => i !== nextWorkIdx ? s : {
                ...s,
                ...patch,
                prefilled: true,
                _originWeight: undefined,
                _originReps: undefined,
              })
            }
          }
        }
        if (!wasCompleted && completingSet?.type === 'work' && completingSet.subtype !== 'backoff' && completingSet.weight) {

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
      persistWorkout(next)
      return next
    })
  }, [persistWorkout]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sparar passet. KASTAR om det inte gick (offline, utgangen session) -
  // den lokala kopian tas bort forst NAR databasen bekraftat, sa man kan
  // forsoka igen utan att tappa passet.
  async function finishWorkout() {
    const payload = exercises.map(ex => ({
      exercise_id: ex.exerciseId,
      name: ex.name,
      muscle_group: ex.muscleGroup,
      ai_comment: ex.aiComment,
      sets: ex.sets,
    }))
    const fields = {
      finished_at: new Date().toISOString(),
      exercises: payload,
      adjusted: isAdjustedSession,
    }
    let id = await ensureWorkout()
    try {
      await updateWorkout(id, fields)
    } catch (err) {
      // Bara om raden bevisligen SAKNAS (PGRST116 = 0 rader, t.ex. borttagen
      // fran en annan enhet) skrivs passet som en ny rad. Vid natverksfel
      // kastar vi vidare - uppdateringen kan ha gatt fram trots uteblivet
      // svar, och en ny rad skulle da ge ett dubblettpass.
      if (err?.code !== 'PGRST116') throw err
      const rec = await createWorkout({
        user_id: userId,
        program_id: programId ?? null,
        session_name: sessionName,
        started_at: startedAt.current.toISOString(),
        ...fields,
      })
      id = rec.id
      workoutIdRef.current = id
      cacheInvalidate('workouts:')
    }
    closedRef.current = true
    localStorage.removeItem(ACTIVE_WORKOUT_KEY)
    return id
  }

  // Avsluta utan att spara: ta bort lokal kopia OCH den tomma raden i
  // databasen (annars blir det en skrap-rad kvar for varje kasserat pass).
  function discardWorkout() {
    closedRef.current = true
    localStorage.removeItem(ACTIVE_WORKOUT_KEY)
    const id = workoutIdRef.current
    if (id) deleteUnfinishedWorkout(id).catch(() => {})
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
      return { ...ex, sets, progressionHint: newW ? `Ta det lugnt idag → ${newW}kg` : ex.progressionHint, progressionAction: 'gap_adjustment' }
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
    // Flagga passet som "anpassat" BARA om vikter sanktes AV TILLFALLIG
    // orsak (sjuk/trott/ont - PT satter temporary: true). En nivakorrigering
    // ("for tungt foreslaget, jag jobbar mig tillbaka") ar anvandarens
    // riktiga niva och SKA raknas i vikthistorik och progression.
    const lowersWeights = adjustment.changes.some(c => c.weightMultiplier != null && c.weightMultiplier < 1)
    if (lowersWeights && adjustment.temporary === true) setIsAdjustedSession(true)
    setExercises(prev => prev.map(ex => {
      const change = adjustment.changes.find(c => c.exerciseName === ex.name)
      if (!change) return ex

      let sets = ex.sets

      // Justera vikter på alla icke-gjorda sets (warmup, work, backoff).
      // VIKTIGT: applicera alltid multiplikatorn pa ORIGINALVIKTEN (_baseWeight),
      // inte pa nuvarande vikt. Annars staplas justeringar pa varann - t.ex.
      // 0.75 sen 0.70 skulle ge 0.75*0.70 istallet for bara 0.70.
      if (typeof change.weightMultiplier === 'number' && change.weightMultiplier > 0) {
        const inc = ex.weightIncrement ?? defaultWeightIncrement(ex.exEquipment)
        sets = sets.map(s => {
          if (s.done) return s
          if (!s.weight) return s
          const base = s._baseWeight ?? parseFloat(s.weight)
          if (!base) return s
          const newW = Math.floor(base * change.weightMultiplier / inc) * inc
          return { ...s, weight: String(newW), _baseWeight: base, prefilled: true }
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
      // Ratt faltnamn - forut skrevs repsMin/repsMax som ingen laser, sa
      // PT:ns andrade rep-mal fick aldrig effekt.
      if (typeof change.repsMin === 'number') next.defaultRepsMin = change.repsMin
      if (typeof change.repsMax === 'number') next.defaultRepsMax = change.repsMax
      next.progressionHint = `${adjustment.summary}`
      next.progressionAction = 'gap_adjustment'
      return next
    }))
    return true
  }, [])

  // Platavarningen: anvandaren valde nagot (eller "Inte nu"). Varningen
  // tas bort och tiger i tre veckor. lower = sank ej klara set 10 % och
  // bygg upp igen. Det ar en riktig nivaandring, inget "anpassat pass".
  const resolvePlateau = useCallback((exId, lower = false) => {
    setExercises(prev => prev.map(ex => {
      if (ex.localId !== exId) return ex
      snoozePlateau(ex.name)
      if (!lower) return { ...ex, plateau: null }
      const inc = ex.weightIncrement ?? defaultWeightIncrement(ex.exEquipment)
      const sets = ex.sets.map(s => {
        const w = parseFloat(s.weight) || 0
        if (s.done || w <= 0) return s
        const newW = Math.max(inc, Math.floor(w * 0.9 / inc) * inc)
        return { ...s, weight: String(newW), _baseWeight: newW, _planWeight: String(newW), prefilled: true }
      })
      return {
        ...ex,
        sets,
        plateau: null,
        progressionHint: 'Sänkt 10 % för att bygga upp igen. Fyll på reps som vanligt.',
        progressionAction: 'plateau_reset',
        _planHint: 'Sänkt 10 % för att bygga upp igen. Fyll på reps som vanligt.',
        _planAction: 'plateau_reset',
      }
    }))
  }, [])

  // "Ingen anpassning": aterstall alla ej klara set till progressionens
  // vanliga forslag och rakna passet som ett normalt pass igen. Angrar bade
  // automatiska andringar (uppehall, deload-vecka) och manuella snabbval.
  const resetAdjustments = useCallback(() => {
    setIsAdjustedSession(false)
    setExercises(prev => prev.map(ex => {
      let changed = false
      const sets = ex.sets.map(s => {
        if (s.done || s._planWeight === undefined) return s
        changed = true
        const w = parseFloat(s._planWeight) || 0
        return {
          ...s,
          weight: s._planWeight,
          reps: s._planReps ?? s.reps,
          prefilled: w > 0 || !!s._planReps,
          _baseWeight: w > 0 ? w : undefined,
          _originWeight: undefined,
          _originReps: undefined,
          epleyAdjusted: false,
        }
      })
      if (!changed && ex.progressionAction !== 'gap_adjustment') return ex
      return {
        ...ex,
        sets,
        progressionHint: ex._planHint !== undefined ? ex._planHint : null,
        progressionAction: ex._planAction !== undefined ? ex._planAction : null,
      }
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
    duplicateSet,
    addExercise,
    addGeneratedWorkout,
    removeExercise,
    setSupersetPair,
    clearSuperset,
    replaceExercise,
    updateExercise,
    updateExerciseReps,
    completeSet,
    finishWorkout,
    discardWorkout,
    ensureWorkout,
    applyDeload,
    applyAdjustment,
    resolvePlateau,
    resetAdjustments,
    programChanged,
    isAdjustedSession,
    repsUpdatedAt,
  }
}
