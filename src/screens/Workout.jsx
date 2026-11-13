import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Reorder, AnimatePresence, motion } from 'framer-motion'
import { useWorkout } from '../hooks/useWorkout'
import { useTimer } from '../hooks/useTimer'
import { buildWorkoutContext, buildMemoryContent, appendUserNote, generateWorkoutIntro } from '../lib/ai'
import { getWorkouts, getAiMemory, upsertAiMemory, getEquipmentMap, updateProgram, saveProgram, setActiveProgram, getDeloadStatus, startDeloadWeek, getExercises } from '../lib/db'
import RestDock from '../components/workout/RestDock'
import TimerExpanded from '../components/workout/TimerExpanded'
import ExerciseBlock from '../components/workout/ExerciseBlock'
import ExercisePicker from '../components/workout/ExercisePicker'
import ExerciseHistory from '../components/workout/ExerciseHistory'
import WorkoutHistorySheet from '../components/workout/WorkoutHistorySheet'
import InstructionsSheet from '../components/workout/InstructionsSheet'
import ExerciseDetailSheet from './ExerciseDetailSheet'
import AiChat from '../components/shared/AiChat'
import MuscleMap from '../components/shared/MuscleMap'
import { colorForIntensityRed } from '../lib/muscleColor'
import PostWorkoutFeedback from '../components/workout/PostWorkoutFeedback'
import styles from './Workout.module.css'

// Val i "Anpassa passet"-arket. Valet markeras forst (gult), applas vid Tillämpa.
const ADJUST_OPTIONS = [
  { key: 'light', label: 'Lätt dag / trött', note: '−10%', apply: { weightMultiplier: 0.9, repsMultiplier: 0.9, summary: 'Lätt dag -10%' } },
  { key: 'sick', label: 'Sjuk', note: '−25%', apply: { weightMultiplier: 0.75, repsMultiplier: 0.75, summary: 'Sjuk -25%' } },
  { key: 'deload', label: 'Deload-vecka', note: '−25% · hela veckan', apply: { weightMultiplier: 0.75, repsMultiplier: 0.75, summary: 'Deload -25%', deloadWeek: true } },
]

function fmtElapsed(startedAt) {
  const s = Math.floor((Date.now() - startedAt) / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h} h ${m % 60} min`
  return `${m} min`
}

export default function Workout({ session }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { sessionName = 'Pass', sessionExercises = [], programId = null, resumed = null, program = null } = location.state ?? {}

  const [aiMemory, setAiMemory] = useState('')

  const defaultRest = (() => {
    const v = localStorage.getItem('gymbanan_default_rest')
    return v ? Number(v) : 120
  })()
  const workout = useWorkout({
    sessionName,
    sessionExercises,
    programId,
    userId: session.user.id,
    resumed,
    defaultRest,
  })
  const timer = useTimer()

  const [elapsed, setElapsed] = useState('0m')
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [timerExpandedOpen, setTimerExpandedOpen] = useState(false)
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustChoice, setAdjustChoice] = useState(null)
  const [workoutNotes, setWorkoutNotes] = useState('')
  const [isReordering, setIsReordering] = useState(false)
  const [reorderSnapshot, setReorderSnapshot] = useState(null)
  const [undoToast, setUndoToast] = useState(null)
  const [showFinish, setShowFinish] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState(false)
  const finishCooldownRef = useRef(false)
  const [pickerTarget, setPickerTarget] = useState(null) // exercise to replace
  const [historyTarget, setHistoryTarget] = useState(null) // exercise for history
  const [workoutHistoryOpen, setWorkoutHistoryOpen] = useState(false)
  const [instructionsTarget, setInstructionsTarget] = useState(null) // exercise for instructions sheet
  const [detailExerciseId, setDetailExerciseId] = useState(null)
  // postWorkout: null | { status: 'done', workoutId: string }
  const [postWorkout, setPostWorkout] = useState(null)
  const [sessionPrs, setSessionPrs] = useState([])
  const [postDurationMin, setPostDurationMin] = useState(null)
  // Superset: fokus-override som flyttar "aktiv ovning" till partnern
  // mitt i ett par. null = harledd aktiv (forsta ej fardiga ovningen).
  const [focusExId, setFocusExId] = useState(null)
  const [supersetPickFor, setSupersetPickFor] = useState(null) // ovning som ska paras

  function handleSupersetJump(localId) {
    setFocusExId(localId)
    setTimeout(() => {
      document.querySelector(`[data-exid="${localId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }
  const [postEquipmentMap, setPostEquipmentMap] = useState({})
  const [introMessage, setIntroMessage] = useState(null)
  const [introLoading, setIntroLoading] = useState(false)
  const [exerciseList, setExerciseList] = useState([])

  useEffect(() => {
    getExercises().then(setExerciseList).catch(() => {})
  }, [])
  const [deloadStatus, setDeloadStatus] = useState({ isActive: false, daysLeft: 0 })
  const [showRepsToast, setShowRepsToast] = useState(false)
  const repsToastTimerRef = useRef(null)
  const [showSyncDialog, setShowSyncDialog] = useState(false)
  const [syncingSave, setSyncingSave] = useState(false)
  const pendingFinishRef = useRef(null)

  const undoTimerRef = useRef(null)

  // Show "Set uppdaterade" toast when rep range changes trigger a recalc
  useEffect(() => {
    if (!workout.repsUpdatedAt) return
    setShowRepsToast(true)
    clearTimeout(repsToastTimerRef.current)
    repsToastTimerRef.current = setTimeout(() => setShowRepsToast(false), 1500)
  }, [workout.repsUpdatedAt])

  // Elapsed-klocka – uppdateras var 15:e sekund
  useEffect(() => {
    setElapsed(fmtElapsed(workout.startedAt))
    const id = setInterval(() => setElapsed(fmtElapsed(workout.startedAt)), 15_000)
    return () => clearInterval(id)
  }, [workout.startedAt])

  // Hämta deload-status vid mount
  useEffect(() => {
    if (!session?.user?.id) return
    getDeloadStatus(session.user.id).then(status => {
      setDeloadStatus(status)
    }).catch(() => {})
  }, [session?.user?.id])

  // Aktiv deload-vecka: sank passet automatiskt (-25 %, samma som snabbvalet)
  // och flagga det som tillfalligt. Det har foll bort vid en tidigare
  // omskrivning - hemskarmen lovade "vikter automatiskt sankta" men bara
  // passet dar veckan startades sanktes. Kors en gang, nar ovningarna laddat
  // klart (sa progressionens vikter finns att sanka). Inte vid resume (redan
  // sankt) och inte for fria pass (inga forifyllda vikter).
  const deloadAppliedRef = useRef(false)
  useEffect(() => {
    if (deloadAppliedRef.current) return
    if (workout.loading || resumed) return
    if (!deloadStatus.isActive || sessionExercises.length === 0) return
    deloadAppliedRef.current = true
    const d = deloadStatus.daysLeft
    workout.applyAdjustment({
      summary: `Deload-vecka (${d} ${d === 1 ? 'dag' : 'dagar'} kvar) −25%`,
      changes: workout.exercises.map(ex => ({ exerciseName: ex.name, weightMultiplier: 0.75, repsMultiplier: 0.75 })),
      temporary: true,
    })
  }, [workout.loading, deloadStatus.isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ladda AI-minne + generera pass-intro. Allt har kor i BAKGRUNDEN och
  // blockerar aldrig att passet visas - introMessage fylls nar det ar klart.
  useEffect(() => {
    let cancelled = false
    if (sessionExercises.length === 0) return
    setIntroLoading(true)

    ;(async () => {
      const [mem, recentWorkouts] = await Promise.all([
        getAiMemory(session.user.id).catch(() => null),
        getWorkouts(session.user.id, 20).catch(() => []),
      ])
      if (cancelled) return
      const memory = mem?.content || ''
      if (memory) setAiMemory(memory)

      // Bygg prev-sets-kontext in-memory fran de redan hamtade passen,
      // istallet for en query per ovning (var en dold flaskhals).
      const lines = [`Pass: ${sessionName}`, '']
      sessionExercises.forEach(ex => {
        let prev = null
        for (const w of recentWorkouts) {
          if (w.adjusted || !w.finished_at) continue
          const found = (w.exercises ?? []).find(e => e.name === ex.name)
          if (!found) continue
          const sets = (found.sets ?? []).filter(s => s.done && s.weight != null)
          if (sets.length) { prev = sets; break }
        }
        lines.push(`${ex.name}${ex.muscle_group ? ` (${ex.muscle_group})` : ''}:`)
        lines.push(prev?.length
          ? `  Förra passet: ${prev.map(s => `${s.weight}kg×${s.reps}`).join(', ')}`
          : '  Ingen tidigare data')
      })

      generateWorkoutIntro({
        context: lines.join('\n'),
        memory: memory || null,
        recentWorkouts,
        currentExercises: sessionExercises,
        currentProgram: programId ? { id: programId, name: program?.name ?? null } : null,
      })
        .then(intro => { if (!cancelled && intro) setIntroMessage(intro) })
        .catch(() => {})
        .finally(() => { if (!cancelled) setIntroLoading(false) })
    })()

    return () => { cancelled = true }
  }, [session.user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stäng header-meny vid klick utanför
  useEffect(() => {
    if (!headerMenuOpen) return
    const close = () => setHeaderMenuOpen(false)
    const t = setTimeout(() => document.addEventListener('pointerdown', close), 10)
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', close) }
  }, [headerMenuOpen])

  // Bygg kontext för AI – alltid färsk snapshot av pågående pass
  const getContext = useCallback(() => buildWorkoutContext(sessionName, workout.exercises, workoutNotes), [sessionName, workout.exercises, workoutNotes])
  const getMemory = useCallback(() => aiMemory || null, [aiMemory])

  // ── Reorder ────────────────────────────────────────────────
  function handleLongPressStart() {
    setReorderSnapshot([...workout.exercises])
    setIsReordering(true)
  }

  function handleReorderDone() {
    setIsReordering(false)
    clearTimeout(undoTimerRef.current)
    const snap = reorderSnapshot
    const id = setTimeout(() => setUndoToast(null), 3500)
    undoTimerRef.current = id
    setUndoToast({
      message: 'Övning omflyttad',
      onUndo: () => {
        workout.setExercises(snap)
        clearTimeout(id)
        setUndoToast(null)
      },
    })
  }

  // ── Helpers ─────────────────────────────────────────────────
  // Basta estimerade 1RM (Epley, ra vikt utan hantel-dubbling - dubbling
  // appliceras vid visning) bland gjorda arbetsset.
  function best1RM(sets) {
    let best = 0
    for (const st of sets ?? []) {
      if (st.type !== 'work' || !st.done) continue
      const w = parseFloat(st.weight) || 0
      const r = parseInt(st.reps) || 0
      if (w <= 0 || r <= 0) continue
      const e = r === 1 ? w : w * (1 + r / 30)
      if (e > best) best = e
    }
    return best
  }

  function buildUpdatedSession(originalSession, exercises) {
    return {
      ...originalSession,
      exercises: exercises.map(ex => ({
        name: ex.name,
        supersetId: ex.supersetId ?? null,
        warmupSets: ex.sets.filter(s => s.type === 'warmup').length,
        workSets: ex.sets.filter(s => s.type === 'work' && s.subtype !== 'backoff').length,
        backoffSets: ex.sets.filter(s => s.subtype === 'backoff').length,
        repsMin: ex.defaultRepsMin ?? null,
        repsMax: ex.defaultRepsMax ?? null,
        restSeconds: ex.restSeconds ?? null,
        notes: ex.notes ?? '',
      })),
    }
  }

  function proceedToPostWorkout(workoutId, snapshot) {
    const exNames = snapshot.map(ex => ex.name)
    getEquipmentMap(exNames).then(setPostEquipmentMap).catch(() => {})
    // Ingen AI-feedback langre - slutskarmen visar statistik + muskelgubbe.
    setPostWorkout({ status: 'done', workoutId })
  }

  // ── Avsluta pass ───────────────────────────────────────────
  async function handleFinish() {
    setFinishing(true)
    setFinishError(false)
    let workoutId = null

    try {
      workoutId = await workout.finishWorkout()
    } catch (err) {
      // Passet ligger kvar lokalt - visa felet sa man kan forsoka igen.
      console.error('finishWorkout error:', err)
      setFinishing(false)
      setFinishError(true)
      return
    }

    window.dispatchEvent(new CustomEvent('workoutsChanged'))

    // Passtid till klart-skarmen
    setPostDurationMin(Math.max(1, Math.round((Date.now() - workout.startedAt.getTime()) / 60000)))

    const snapshotForPrs = [...workout.exercises]
    getWorkouts(session.user.id, 50).then(recent => {
      // PR-detektion: jamfor dagens basta 1RM per ovning mot historiken
      // (exkl. det nyss avslutade passet). Fira bara akta PR - dvs nar
      // ovningen har korts tidigare och dagens varde ar hogre.
      try {
        const prs = []
        for (const ex of snapshotForPrs) {
          const today = best1RM(ex.sets)
          if (today <= 0) continue
          let hist = 0
          let seen = false
          for (const w of recent) {
            if (w.id === workoutId) continue
            const match = (w.exercises ?? []).find(e => e.name === ex.name)
            if (!match) continue
            seen = true
            const b = best1RM(match.sets)
            if (b > hist) hist = b
          }
          if (seen && today > hist) prs.push({ name: ex.name, value: today })
        }
        setSessionPrs(prs)
      } catch { /* PR-detektion far aldrig stoppa flodet */ }

      const newMemory = buildMemoryContent(recent, aiMemory)
      setAiMemory(newMemory)
      return upsertAiMemory(session.user.id, newMemory)
    }).catch(() => {})

    setShowFinish(false)
    setFinishing(false)

    const snapshot = [...workout.exercises]

    if (workout.programChanged && !workout.isAdjustedSession && program) {
      pendingFinishRef.current = { workoutId, snapshot }
      setShowSyncDialog(true)
    } else {
      proceedToPostWorkout(workoutId, snapshot)
    }
  }

  async function handleSyncChoice(choice) {
    const { workoutId, snapshot } = pendingFinishRef.current
    setSyncingSave(true)

    try {
      if (choice === 'update' && program?.id) {
        const updatedSessions = (program.sessions ?? []).map(s =>
          s.name === sessionName ? buildUpdatedSession(s, snapshot) : s
        )
        await updateProgram(program.id, { sessions: updatedSessions })
        // Uppdatera appens state sa andringarna syns direkt nasta pass utan
        // omladdning (makeActive: false - andrar inte vilket program som ar aktivt).
        window.dispatchEvent(new CustomEvent('activeProgramChanged', {
          detail: { program: { ...program, sessions: updatedSessions }, makeActive: false },
        }))
      } else if (choice === 'copy' && program) {
        const saved = await saveProgram({
          name: program.name,
          sessions: (program.sessions ?? []).map(s =>
            s.name === sessionName ? buildUpdatedSession(s, snapshot) : s
          ),
          is_global: false,
          user_id: session.user.id,
          created_by: session.user.id,
        })
        // Kopian ska bli anvandarens aktiva program - spara i DB (dar
        // aktivt program faktiskt bor) och meddela App sa state synkas.
        await setActiveProgram(session.user.id, saved.id)
        window.dispatchEvent(new CustomEvent('activeProgramChanged', { detail: { program: saved } }))
      }
    } catch (err) {
      console.error('sync program error:', err)
    }

    setSyncingSave(false)
    setShowSyncDialog(false)
    proceedToPostWorkout(workoutId, snapshot)
  }

  // ── Post-workout: navigera hem ──────────────────────────────
  function handlePostWorkoutDone() {
    navigate('/', { replace: true })
  }

  // Sanker vikter/reps pa ALLA ovningar. temporary: true gor att passet
  // flaggas som anpassat sa de sankta vikterna inte blir ny baslinje.
  // Snabbval (lätt dag/sjuk/deload) vid sidan av PT-chatten.
  function applyManualAdjustment({ weightMultiplier, repsMultiplier, summary, deloadWeek }) {
    const changes = workout.exercises.map(ex => ({
      exerciseName: ex.name,
      weightMultiplier,
      repsMultiplier,
    }))
    if (changes.length > 0) {
      workout.applyAdjustment({ summary, changes, temporary: true })
    }
    if (deloadWeek) {
      deloadAppliedRef.current = true
      startDeloadWeek(session.user.id, 7)
        .then(result => setDeloadStatus({ isActive: true, daysLeft: result.daysLeft, deloadUntil: result.deloadUntil }))
        .catch(() => {})
    }
    closeAdjust()
  }

  // Ar passet anpassat just nu (automatiskt eller manuellt)? Da erbjuds
  // "Ingen anpassning" i arket.
  const sessionIsAdjusted = workout.isAdjustedSession
    || workout.exercises.some(ex => ex.progressionAction === 'gap_adjustment')

  // Stanger Anpassa-arket och nollstaller valet.
  function closeAdjust() {
    setAdjustOpen(false)
    setAdjustChoice(null)
  }

  // Muskelgubbe langst ner i passet: visar vilka muskelgrupper som jobbat
  // hittills (bara klarade set) sa man ser luckor innan man avslutar.
  const muscleExMap = useMemo(() => {
    const m = {}
    for (const e of exerciseList ?? []) m[e.name] = e
    return m
  }, [exerciseList])
  const muscleSessionWorkout = useMemo(() => [{
    finished_at: new Date().toISOString(),
    exercises: (workout.exercises ?? []).map(e => ({
      ...e,
      muscle_group: e.muscle_group ?? e.muscleGroup ?? null,
      is_cardio: e.is_cardio ?? e.isCardio ?? false,
    })),
  }], [workout.exercises])

  // ── Render ──────────────────────────────────────────────────

  // Aktiv ovning = forsta som inte ar helt klar, om inte anvandaren (eller
  // ett superset) pekat ut en annan ovning som har set kvar.
  const isExDone = ex => {
    const ws = ex.sets.filter(st => st.type === 'work')
    return ws.length > 0 && ws.every(st => st.done)
  }
  const focusEx = focusExId ? workout.exercises.find(e => e.localId === focusExId) : null
  const focusValid = !!focusEx && focusEx.sets.some(st => st.type === 'work' && !st.done)
  const activeExId = focusValid
    ? focusExId
    : (workout.exercises.find(ex => !isExDone(ex))?.localId ?? null)
  const anySetDone = workout.exercises.some(ex => ex.sets.some(st => st.done))
  const progress = (() => {
    const doneIds = new Set(workout.exercises.filter(isExDone).map(ex => ex.localId))
    const activeIdx = workout.exercises.findIndex(ex => ex.localId === activeExId)
    const total = workout.exercises.length
    const label = activeIdx >= 0 ? `övning ${activeIdx + 1} av ${total}` : `${doneIds.size} av ${total} klara`
    return { doneIds, done: doneIds.size, label }
  })()

  // Visa laddningsspinner tills all övningsdata är förinläst
  if (workout.loading) {
    return (
      <div className={styles.screen} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  // Post-workout feedback skärm – visas som overlay ovanpå allt
  if (postWorkout) {
    return (
      <PostWorkoutFeedback
        sessionName={sessionName}
        exercises={workout.exercises}
        onDone={handlePostWorkoutDone}
        equipmentMap={postEquipmentMap}
        durationMin={postDurationMin}
        prs={sessionPrs}
      />
    )
  }

  return (
    <div className={styles.screen}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.sessionBtn}>{sessionName}</span>
          <span className={styles.elapsed}>{elapsed}</span>
        </div>
        <div className={styles.headerRight}>
          {/* Anpassa passet (lätt dag / sjuk / deload) - snabbval utan chatt */}
          <button
            className={`${styles.headIconBtn} ${adjustOpen ? styles.headIconBtnActive : ''}`}
            onClick={() => { setAdjustChoice(null); setAdjustOpen(true) }}
            type="button"
            aria-label="Anpassa passet"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>
            </svg>
          </button>
          {/* PT-knapp */}
          <button
            className={`${styles.headIconBtn} ${aiChatOpen ? styles.headIconBtnActive : ''}`}
            onClick={() => setAiChatOpen(true)}
            type="button"
            aria-label="Öppna PT-chat"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
            </svg>
          </button>
          {/* ··· meny */}
          <button
            className={`${styles.headIconBtn} ${headerMenuOpen ? styles.headIconBtnActive : ''}`}
            onClick={e => { e.stopPropagation(); setHeaderMenuOpen(v => !v) }}
            type="button"
            aria-label="Passalternativ"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Framsteg: ett segment per ovning (gron = klar, gul = pagar) */}
      {workout.exercises.length > 0 && (
        <div
          className={styles.progress}
          style={{ gridTemplateColumns: `repeat(${workout.exercises.length}, minmax(0, 1fr))` }}
          role="img"
          aria-label={`${progress.done} av ${workout.exercises.length} övningar klara`}
        >
          {workout.exercises.map(ex => (
            <span
              key={ex.localId}
              className={`${styles.progressSeg} ${
                progress.doneIds.has(ex.localId) ? styles.progressSegDone
                  : ex.localId === activeExId ? styles.progressSegActive : ''
              }`}
            />
          ))}
        </div>
      )}

      {/* Header-dropdown */}
      <AnimatePresence>
        {headerMenuOpen && (
          <motion.div
            className={styles.headerMenu}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            onPointerDown={e => e.stopPropagation()}
          >
            <button className={styles.hMenuItem} onClick={() => { setHeaderMenuOpen(false); navigate('/') }}>
              Till startsidan (passet fortsätter)
            </button>
            <button className={styles.hMenuItem} onClick={() => { if (!timer.active) timer.start('Vila', 60); setTimerExpandedOpen(true); setHeaderMenuOpen(false) }}>
              Vilotimer
            </button>
            <button className={styles.hMenuItem} onClick={() => { setWorkoutHistoryOpen(true); setHeaderMenuOpen(false) }}>
              Historik
            </button>
            <div className={styles.hMenuDivider} />
            <button
              className={`${styles.hMenuItem} ${styles.hMenuItemDanger}`}
              onClick={() => { if (!finishCooldownRef.current) { setShowFinish(true); setHeaderMenuOpen(false) } }}
            >
              Avsluta pass
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scroll-area ── */}
      <div className={`${styles.scroll} ${timer.active ? styles.scrollWithDock : ''}`}>

        {isReordering && (
          <div className={styles.reorderBanner}>
            <span>Håll och dra för att flytta övningar</span>
            <button className={styles.reorderDone} onClick={handleReorderDone} type="button">
              Klar
            </button>
          </div>
        )}

        {isReordering ? (
          <Reorder.Group
            axis="y"
            values={workout.exercises}
            onReorder={workout.setExercises}
            className={styles.reorderList}
            as="div"
          >
            {workout.exercises.map(ex => (
              <Reorder.Item
                key={ex.localId}
                value={ex}
                className={styles.reorderItem}
                as="div"
                whileDrag={{ scale: 1.02, boxShadow: '0 8px 24px rgba(0,0,0,0.75)', zIndex: 10 }}
              >
                <span className={styles.reorderHandle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </span>
                <span className={styles.reorderName}>{ex.name}</span>
                <span className={styles.reorderMeta}>
                  {ex.sets.filter(s => s.type === 'work').length} set
                </span>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        ) : (
          <>
            {workout.exercises.length === 0 && (
              <div className={styles.emptyChoice}>
                <p className={styles.emptyChoiceTitle}>Fritt pass</p>
                <p className={styles.emptyChoiceText}>
                  Lägg till övningar själv, eller låt PT sätta ihop ett pass åt dig.
                </p>
                <button
                  className={styles.emptyPtBtn}
                  onClick={() => setAiChatOpen(true)}
                  type="button"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/>
                  </svg>
                  Be PT skapa ett pass
                </button>
                <button
                  className={styles.emptyAddBtn}
                  onClick={() => setPickerTarget({ _add: true })}
                  type="button"
                >
                  + Lägg till övning själv
                </button>
              </div>
            )}
            {workout.exercises.map((ex, idx) => {
              const isActive = ex.localId === activeExId
              // Superset-partner: annan ovning med samma supersetId
              const supersetPartner = ex.supersetId
                ? workout.exercises.find(o => o.supersetId === ex.supersetId && o.localId !== ex.localId) ?? null
                : null
              const supersetFirstId = supersetPartner
                ? (workout.exercises.findIndex(o => o.localId === ex.localId) <
                   workout.exercises.findIndex(o => o.localId === supersetPartner.localId)
                    ? ex.localId : supersetPartner.localId)
                : null
              return (
              <ExerciseBlock
                key={ex.localId}
                exercise={ex}
                isActive={isActive}
                isLastExercise={idx === workout.exercises.length - 1}
                defaultRestSeconds={defaultRest}
                onUpdateSet={workout.updateSet}
                onAddSet={workout.addSet}
                onAddBackoffSet={workout.addBackoffSet}
                onRemoveSet={workout.removeSet}
                onDuplicateSet={workout.duplicateSet}
                onCompleteSet={workout.completeSet}
                onUpdateExerciseReps={workout.updateExerciseReps}
                onRemoveExercise={workout.removeExercise}
                onReplaceExercise={ex => setPickerTarget(ex)}
                onShowHistory={ex => setHistoryTarget(ex)}
                onShowInstructions={ex => setInstructionsTarget(ex)}
                userId={session.user.id}
                onLongPressStart={handleLongPressStart}
                onTimerStart={(name, secs) => timer.start(name, secs)}
                supersetPartner={supersetPartner}
                supersetFirstId={supersetFirstId}
                onSupersetJump={handleSupersetJump}
                onActivate={handleSupersetJump}
                autoCenter={anySetDone}
                onSupersetLinkStart={ex => setSupersetPickFor(ex)}
                onSupersetUnlink={ex => workout.clearSuperset(ex.localId)}
                onShowDetail={id => setDetailExerciseId(id)}
              />
              )
            })}

            {/* Lägg till övning + Avsluta pass - doljs nar passet ar tomt
                (da visas empty-choice-knapparna istallet) */}
            {workout.exercises.length > 0 && (
            <>
            {/* ── Tränade muskelgrupper (muskelgubbe langst ner) ── */}
            <div className={styles.muscleSummary}>
              <span className={styles.muscleSummaryTitle}>Tränade muskelgrupper</span>
              <div className={styles.muscleSummaryFigure}>
                <MuscleMap workouts={muscleSessionWorkout} exerciseMap={muscleExMap} colorFn={colorForIntensityRed} sensitivity={6} size={130} />
              </div>
            </div>
            <div className={styles.finishWrap}>
              <button
                className={styles.addExerciseBtn}
                onClick={() => setPickerTarget({ _add: true })}
                type="button"
              >
                + Lägg till övning
              </button>
              <button
                className={styles.finishBtn}
                onClick={() => { if (!finishCooldownRef.current) setShowFinish(true) }}
                type="button"
              >
                AVSLUTA
              </button>
            </div>
            </>
            )}
          </>
        )}
      </div>

      {/* ── Vilodocka: flyter langst ner medan vilan gar ── */}
      <AnimatePresence>
        {timer.active && !timerExpandedOpen && (
          <RestDock timer={timer} onOpen={() => setTimerExpandedOpen(true)} />
        )}
      </AnimatePresence>

      {/* ── Reps-updated toast ── */}
      <AnimatePresence>
        {showRepsToast && (
          <motion.div
            className={styles.toast}
            style={{ bottom: 'calc(var(--safe-bottom, 0px) + 160px)' }}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
          >
            <span className={styles.toastMsg}>Set uppdaterade</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Undo-toast ── */}
      <AnimatePresence>
        {undoToast && (
          <motion.div
            className={`${styles.toast} ${timer.active ? styles.toastAboveDock : ''}`}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
          >
            <span className={styles.toastMsg}>{undoToast.message}</span>
            <button className={styles.toastUndo} onClick={undoToast.onUndo} type="button">
              Ångra
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Avsluta pass – bekräftelse ── */}
      <AnimatePresence>
        {showFinish && (
          <>
            <motion.div
              className={styles.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!finishing) { finishCooldownRef.current = true; setTimeout(() => { finishCooldownRef.current = false }, 1000); setShowFinish(false) } }}
            />
            <motion.div
              className={styles.confirmSheet}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              onClick={e => e.stopPropagation()}
            >
              <div className={styles.sheetHandle} />
              <h3 className={styles.confirmTitle}>Avsluta pass?</h3>
              {finishError && (
                <p className={styles.confirmError} role="alert">
                  Kunde inte spara passet. Kolla uppkopplingen och försök igen –
                  passet ligger kvar på telefonen så inget går förlorat.
                </p>
              )}
              <button
                className={styles.confirmPrimary}
                onClick={handleFinish}
                disabled={finishing}
                type="button"
              >
                {finishing ? 'Sparar…' : finishError ? 'Försök igen' : 'Spara pass'}
              </button>
              <button
                className={styles.confirmSecondary}
                onClick={() => { workout.discardWorkout(); setShowFinish(false); navigate('/', { replace: true }) }}
                disabled={finishing}
                type="button"
              >
                Avsluta utan att spara
              </button>
              <button
                className={styles.confirmLink}
                onClick={() => {
                  finishCooldownRef.current = true
                  setTimeout(() => { finishCooldownRef.current = false }, 1000)
                  setShowFinish(false)
                }}
                disabled={finishing}
                type="button"
              >
                Fortsätt träna
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Synka till program ── */}
      <AnimatePresence>
        {showSyncDialog && program && (
          <>
            <motion.div
              className={styles.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className={styles.confirmSheet}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              onClick={e => e.stopPropagation()}
            >
              <div className={styles.sheetHandle} />
              <h3 className={styles.confirmTitle}>
                Du gjorde ändringar under passet.
              </h3>
              {program.user_id === null ? (
                <>
                  <p className={styles.confirmText}>
                    Vill du spara en egen kopia av programmet med dina ändringar? Kopian blir ditt aktiva program.
                  </p>
                  <button
                    className={styles.confirmPrimary}
                    onClick={() => handleSyncChoice('copy')}
                    disabled={syncingSave}
                    type="button"
                  >
                    {syncingSave ? 'Sparar…' : 'Spara kopia'}
                  </button>
                </>
              ) : (
                <>
                  <p className={styles.confirmText}>
                    Vill du uppdatera programmet med dessa ändringar?
                  </p>
                  <button
                    className={styles.confirmPrimary}
                    onClick={() => handleSyncChoice('update')}
                    disabled={syncingSave}
                    type="button"
                  >
                    {syncingSave ? 'Sparar…' : 'Uppdatera programmet'}
                  </button>
                </>
              )}
              <button
                className={styles.confirmLink}
                onClick={() => handleSyncChoice('skip')}
                disabled={syncingSave}
                type="button"
              >
                Nej tack
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── TimerExpanded sheet ── */}
      <TimerExpanded
        open={timerExpandedOpen}
        timer={timer}
        onClose={() => setTimerExpandedOpen(false)}
      />

      {/* ── AI PT-chat ── */}
      {/* ── Valj superset-partner ── */}
      {supersetPickFor && (
        <>
          <div className={styles.ssPickBackdrop} onClick={() => setSupersetPickFor(null)} />
          <div className={styles.ssPickSheet}>
            <p className={styles.ssPickTitle}>Superset: {supersetPickFor.name} +</p>
            <div className={styles.ssPickList}>
              {workout.exercises
                .filter(e => e.localId !== supersetPickFor.localId)
                .map(e => (
                  <button
                    key={e.localId}
                    className={styles.ssPickItem}
                    type="button"
                    onClick={() => {
                      workout.setSupersetPair(supersetPickFor.localId, e.localId)
                      setSupersetPickFor(null)
                    }}
                  >
                    <span>{e.name}</span>
                    {e.supersetId && <span className={styles.ssPickNote}>i superset – byts</span>}
                  </button>
                ))}
            </div>
            <button className={styles.ssPickCancel} onClick={() => setSupersetPickFor(null)} type="button">
              Avbryt
            </button>
          </div>
        </>
      )}

      {/* ── Anpassa passet (lätt dag / sjuk / deload) ── */}
      {adjustOpen && (
        <>
          <div className={styles.ssPickBackdrop} onClick={() => closeAdjust()} />
          <div className={styles.ssPickSheet}>
            <p className={styles.ssPickTitle}>Anpassa passet</p>
            <p className={styles.adjustHint}>
              {sessionIsAdjusted
                ? 'Passet är anpassat just nu. Välj "Ingen anpassning" för att få tillbaka de vanliga förslagen, eller byt nivå.'
                : 'Sänker vikten på alla övningar i passet (reps på kroppsviktsövningar). Räknas som tillfälligt, så det påverkar inte din vanliga progression nästa gång.'}
            </p>
            <div className={styles.ssPickList}>
              {sessionIsAdjusted && (
                <button
                  className={`${styles.ssPickItem} ${adjustChoice === 'none' ? styles.ssPickItemActive : ''}`}
                  type="button"
                  aria-pressed={adjustChoice === 'none'}
                  onClick={() => setAdjustChoice('none')}
                >
                  <span>Ingen anpassning</span>
                  <span className={styles.ssPickNote}>vanliga vikter</span>
                </button>
              )}
              {ADJUST_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  className={`${styles.ssPickItem} ${adjustChoice === opt.key ? styles.ssPickItemActive : ''}`}
                  type="button"
                  aria-pressed={adjustChoice === opt.key}
                  onClick={() => setAdjustChoice(opt.key)}
                >
                  <span>{opt.label}</span>
                  <span className={styles.ssPickNote}>{opt.note}</span>
                </button>
              ))}
            </div>
            <button
              className={styles.ssPickApply}
              type="button"
              disabled={!adjustChoice}
              onClick={() => {
                if (adjustChoice === 'none') {
                  // Aterstall till progressionens vanliga forslag
                  deloadAppliedRef.current = true
                  workout.resetAdjustments()
                  closeAdjust()
                  return
                }
                const opt = ADJUST_OPTIONS.find(o => o.key === adjustChoice)
                if (opt) applyManualAdjustment(opt.apply)
              }}
            >
              Tillämpa
            </button>
            <button className={styles.ssPickCancel} onClick={() => closeAdjust()} type="button">
              Avbryt
            </button>
          </div>
        </>
      )}

      <AiChat
        open={aiChatOpen}
        onClose={() => setAiChatOpen(false)}
        getContext={getContext}
        getMemory={getMemory}
        getDeloadStatus={() => deloadStatus}
        introMessage={introMessage}
        introLoading={introLoading}
        freeWorkoutMode={!programId && workout.exercises.length === 0}
        getAvailableExercises={() => exerciseList}
        onApplyWorkoutPlan={(plan) => {
          workout.addGeneratedWorkout(plan.exercises, exerciseList)
          return true
        }}
        workoutNotes={workoutNotes}
        onUpdateNotes={setWorkoutNotes}
        onUpdateMemory={async (note) => {
          const updated = appendUserNote(aiMemory, note)
          setAiMemory(updated)
          await upsertAiMemory(session.user.id, updated)
        }}
        onApplyAdjustment={(adjustment) => workout.applyAdjustment(adjustment)}
        onApplyDeload={async (deload) => {
          try {
            deloadAppliedRef.current = true
            const result = await startDeloadWeek(session.user.id, deload.days || 7)
            setDeloadStatus({ isActive: true, daysLeft: result.daysLeft, deloadUntil: result.deloadUntil })
            // Också applicera på aktuella passet direkt
            const changes = workout.exercises.map(ex => ({
              exerciseName: ex.name,
              weightMultiplier: deload.weightMultiplier ?? 0.85,
              setMultiplier: deload.setReduction ? 1 - (deload.setReduction / 4) : 0.8,
            }))
            if (changes.length > 0) {
              // temporary: deloadpasset ska inte bli ny baslinje for progressionen
              workout.applyAdjustment({
                summary: deload.summary,
                changes,
                temporary: true,
              })
            }
            return true
          } catch (err) {
            console.error('startDeloadWeek error:', err)
            return false
          }
        }}
      />

      {/* ── Byt övning ── */}
      <ExercisePicker
        open={pickerTarget !== null}
        replacingExercise={pickerTarget && !pickerTarget._add ? pickerTarget : null}
        onSelect={ex => {
          if (pickerTarget?._add) workout.addExercise(ex)
          else if (pickerTarget) workout.replaceExercise(pickerTarget.localId, ex)
        }}
        onClose={() => setPickerTarget(null)}
      />

      {/* ── Övningshistorik ── */}
      <ExerciseHistory
        open={historyTarget !== null}
        exerciseName={historyTarget?.name}
        userId={session.user.id}
        onClose={() => setHistoryTarget(null)}
      />

      {/* ── Övningsinstruktioner ── */}
      <InstructionsSheet
        open={instructionsTarget !== null}
        exerciseName={instructionsTarget?.name}
        userId={session.user.id}
        onClose={() => setInstructionsTarget(null)}
      />

      {/* ── Övningsdetaljer (modal overlay) ── */}
      <ExerciseDetailSheet
        id={detailExerciseId}
        context="workout"
        onClose={() => setDetailExerciseId(null)}
        onNotesSaved={(name, notes) => {
          workout.setExercises(prev => prev.map(ex =>
            ex.name === name ? { ...ex, exNotes: notes } : ex
          ))
        }}
      />

      {/* ── Passhistorik ── */}
      <WorkoutHistorySheet
        open={workoutHistoryOpen}
        userId={session.user.id}
        onClose={() => setWorkoutHistoryOpen(false)}
      />

    </div>
  )
}
