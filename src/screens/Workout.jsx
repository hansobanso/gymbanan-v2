import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Reorder, AnimatePresence, motion } from 'framer-motion'
import { useWorkout } from '../hooks/useWorkout'
import { useTimer } from '../hooks/useTimer'
import { buildWorkoutContext, buildMemoryContent, appendUserNote, chatWithAI, generateWorkoutIntro } from '../lib/ai'
import { updateWorkout, getWorkouts, getAiMemory, upsertAiMemory, getPreviousSetsForExercise, getEquipmentMap, updateProgram, saveProgram, getDeloadStatus, startDeloadWeek } from '../lib/db'
import TimerBar from '../components/workout/TimerBar'
import TimerExpanded from '../components/workout/TimerExpanded'
import ExerciseBlock from '../components/workout/ExerciseBlock'
import ExercisePicker from '../components/workout/ExercisePicker'
import ExerciseHistory from '../components/workout/ExerciseHistory'
import WorkoutHistorySheet from '../components/workout/WorkoutHistorySheet'
import InstructionsSheet from '../components/workout/InstructionsSheet'
import ExerciseDetailSheet from './ExerciseDetailSheet'
import AiChat from '../components/shared/AiChat'
import PostWorkoutFeedback from '../components/workout/PostWorkoutFeedback'
import styles from './Workout.module.css'

function fmtElapsed(startedAt) {
  const s = Math.floor((Date.now() - startedAt) / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m`
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
    aiMemory,
    defaultRest,
  })
  const timer = useTimer()

  const [elapsed, setElapsed] = useState('0m')
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [timerExpandedOpen, setTimerExpandedOpen] = useState(false)
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const [workoutNotes, setWorkoutNotes] = useState('')
  const [isReordering, setIsReordering] = useState(false)
  const [reorderSnapshot, setReorderSnapshot] = useState(null)
  const [undoToast, setUndoToast] = useState(null)
  const [showFinish, setShowFinish] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const finishCooldownRef = useRef(false)
  const [pickerTarget, setPickerTarget] = useState(null) // exercise to replace
  const [historyTarget, setHistoryTarget] = useState(null) // exercise for history
  const [workoutHistoryOpen, setWorkoutHistoryOpen] = useState(false)
  const [instructionsTarget, setInstructionsTarget] = useState(null) // exercise for instructions sheet
  const [detailExerciseId, setDetailExerciseId] = useState(null)
  // postWorkout: null | { status: 'loading'|'done'|'error', feedbackText: string|null, workoutId: string }
  const [postWorkout, setPostWorkout] = useState(null)
  const [postEquipmentMap, setPostEquipmentMap] = useState({})
  const [introMessage, setIntroMessage] = useState(null)
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

  // Ladda AI-minne + generera pass-intro
  useEffect(() => {
    getAiMemory(session.user.id).then(async mem => {
      const memory = mem?.content || ''
      if (memory) setAiMemory(memory)

      if (sessionExercises.length === 0) return

      const recentWorkouts = await getWorkouts(session.user.id, 50).catch(() => [])

      const prevSetsArray = await Promise.all(
        sessionExercises.map(ex => getPreviousSetsForExercise(session.user.id, ex.name))
      )
      const lines = [`Pass: ${sessionName}`, '']
      sessionExercises.forEach((ex, i) => {
        const prev = prevSetsArray[i]
        lines.push(`${ex.name}${ex.muscle_group ? ` (${ex.muscle_group})` : ''}:`)
        if (prev?.length) {
          lines.push(`  Förra passet: ${prev.map(s => `${s.weight}kg×${s.reps}`).join(', ')}`)
        } else {
          lines.push('  Ingen tidigare data')
        }
      })
      const preContext = lines.join('\n')

      generateWorkoutIntro({
        context: preContext,
        memory: memory || null,
        recentWorkouts,
        currentExercises: sessionExercises,
      })
        .then(intro => {
          if (intro) setIntroMessage(intro)
        })
        .catch(() => {})
    }).catch(() => {})
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
  function buildUpdatedSession(originalSession, exercises) {
    return {
      ...originalSession,
      exercises: exercises.map(ex => ({
        name: ex.name,
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
    setPostWorkout({ status: 'loading', feedbackText: null, workoutId });
    (async () => {
      try {
        const context = buildWorkoutContext(sessionName, snapshot, workoutNotes)
        const feedback = await chatWithAI({
          messages: [{ role: 'user', content: 'Ge mig kort, konkret feedback på detta pass. Max 3-4 meningar. Skriv på svenska.' }],
          context,
        })
        if (workoutId) {
          await updateWorkout(workoutId, { ai_feedback: feedback }).catch(() => {})
        }
        setPostWorkout(prev => prev ? { ...prev, status: 'done', feedbackText: feedback } : prev)
      } catch {
        setPostWorkout(prev => prev ? { ...prev, status: 'error', feedbackText: null } : prev)
      }
    })()
  }

  // ── Avsluta pass ───────────────────────────────────────────
  async function handleFinish() {
    setFinishing(true)
    let workoutId = null

    try {
      workoutId = await workout.finishWorkout()
    } catch (err) {
      console.error('finishWorkout error:', err)
      setFinishing(false)
      return
    }

    window.dispatchEvent(new CustomEvent('workoutsChanged'))
    getWorkouts(session.user.id, 50).then(recent => {
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
        localStorage.setItem('gymbanan_active_program_id', saved.id)
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

  // ── Render ──────────────────────────────────────────────────

  // Debug: verifiera restSeconds från programbyggaren

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
        feedbackStatus={postWorkout.status}
        feedbackText={postWorkout.feedbackText}
        onDone={handlePostWorkoutDone}
        equipmentMap={postEquipmentMap}
      />
    )
  }

  return (
    <div className={styles.screen}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.sessionBtn}>{sessionName}</span>
          <div className={styles.headerSubRow}>
            <span className={styles.elapsed}>{elapsed}</span>
            {workout.exercises.length > 0 && (
              <div className={styles.exerciseDots}>
                {workout.exercises.map(ex => {
                  const workSets = ex.sets.filter(s => s.type === 'work')
                  const done = workSets.length > 0 && workSets.every(s => s.done)
                  return (
                    <span
                      key={ex.localId}
                      className={`${styles.exerciseDot} ${done ? styles.exerciseDotDone : ''}`}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>
        <div className={styles.headerRight}>
          {/* Timer-pill – visas bara när timern är aktiv */}
          {timer.active && (() => {
            const ratio = timer.totalSeconds > 0 ? timer.secondsLeft / timer.totalSeconds : 0
            const color = ratio > 0.6 ? 'var(--timer-safe)' : ratio > 0.3 ? 'var(--timer-warn)' : 'var(--timer-danger)'
            return (
              <button
                className={styles.timerPill}
                onClick={() => setTimerExpandedOpen(true)}
                type="button"
                aria-label="Öppna timer"
                style={{ color }}
              >
                {`${Math.floor(timer.secondsLeft / 60)}:${String(timer.secondsLeft % 60).padStart(2, '0')}`}
              </button>
            )
          })()}
          {/* Vila-timer – öppnar expanded, startar 60s om ingen timer aktiv */}
          <button
            className={styles.timerIconBtn}
            onClick={() => { if (!timer.active) timer.start('Vila', 60); setTimerExpandedOpen(true) }}
            type="button"
            aria-label="Öppna timer"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="2" />
              <path d="M12 6.5V12L15.5 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          {/* PT-knapp */}
          <button
            className={`${styles.chatIconBtn} ${aiChatOpen ? styles.chatIconBtnActive : ''}`}
            onClick={() => setAiChatOpen(true)}
            type="button"
            aria-label="Öppna PT-chat"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>
              <path d="M12 11h.01"/>
              <path d="M16 11h.01"/>
              <path d="M8 11h.01"/>
            </svg>
          </button>
          {/* ··· meny */}
          <button
            className={`${styles.dotsIconBtn} ${headerMenuOpen ? styles.dotsBtnActive : ''}`}
            onClick={e => { e.stopPropagation(); setHeaderMenuOpen(v => !v) }}
            type="button"
            aria-label="Passalternativ"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <path d="M17 12h.01"/>
              <path d="M12 12h.01"/>
              <path d="M7 12h.01"/>
            </svg>
          </button>
        </div>
      </div>

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

      {/* ── TimerBar DIREKT under header ── */}
      <TimerBar timer={timer} />

      {/* ── Scroll-area ── */}
      <div className={styles.scroll}>

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
              <div className={styles.empty}>
                <p>Inga övningar ännu</p>
              </div>
            )}
            {workout.exercises.map((ex, idx) => {
              // Active = first exercise that isn't fully done
              const workSets = ex.sets.filter(s => s.type === 'work')
              const allDone = workSets.length > 0 && workSets.every(s => s.done)
              const isActive = !allDone && workout.exercises.slice(0, idx).every(prev => {
                const ws = prev.sets.filter(s => s.type === 'work')
                return ws.length > 0 && ws.every(s => s.done)
              })
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
                onUpdateExercise={workout.updateExercise}
                onUpdateExerciseReps={workout.updateExerciseReps}
                onRemoveExercise={workout.removeExercise}
                onReplaceExercise={ex => setPickerTarget(ex)}
                onShowHistory={ex => setHistoryTarget(ex)}
                onShowInstructions={ex => setInstructionsTarget(ex)}
                userId={session.user.id}
                onLongPressStart={handleLongPressStart}
                onTimerStart={(name, secs) => timer.start(name, secs)}
                onShowDetail={id => setDetailExerciseId(id)}
              />
              )
            })}

            {/* Lägg till övning + Avsluta pass */}
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
      </div>

      {/* ── Reps-updated toast ── */}
      <AnimatePresence>
        {showRepsToast && (
          <motion.div
            className={styles.toast}
            style={{ bottom: 'calc(var(--safe-bottom, 0px) + 90px)' }}
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
            className={styles.toast}
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
              <button
                className={styles.confirmPrimary}
                onClick={handleFinish}
                disabled={finishing}
                type="button"
              >
                {finishing ? 'Sparar…' : 'Spara pass'}
              </button>
              <button
                className={styles.confirmSecondary}
                onClick={() => { localStorage.removeItem('gymbanan_active_workout'); setShowFinish(false); navigate('/', { replace: true }) }}
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
                  <p style={{ fontSize: 14, color: '#888', textAlign: 'center', margin: '0 0 16px', lineHeight: 1.5 }}>
                    Vill du spara en egen kopia av programmet med dina ändringar?
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
                  <p style={{ fontSize: 14, color: '#888', textAlign: 'center', margin: '0 0 16px', lineHeight: 1.5 }}>
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
      <AiChat
        open={aiChatOpen}
        onClose={() => setAiChatOpen(false)}
        getContext={getContext}
        getMemory={getMemory}
        getDeloadStatus={() => deloadStatus}
        introMessage={introMessage}
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
            const result = await startDeloadWeek(session.user.id, deload.days || 7)
            setDeloadStatus({ isActive: true, daysLeft: result.daysLeft, deloadUntil: result.deloadUntil })
            // Också applicera på aktuella passet direkt
            const changes = sessionExercises.map(ex => ({
              exerciseName: ex.name,
              weightMultiplier: deload.weightMultiplier ?? 0.85,
              setMultiplier: deload.setReduction ? 1 - (deload.setReduction / 4) : 0.8,
            }))
            if (changes.length > 0) {
              workout.applyAdjustment({
                summary: deload.summary,
                changes,
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
