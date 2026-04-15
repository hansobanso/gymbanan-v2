import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getWorkouts } from '../../lib/db'
import MuscleMap from '../MuscleMap'
import styles from './HomeScreen.module.css'

function getMonday() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const mon = new Date(now)
  mon.setDate(now.getDate() - diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function relativeDate(iso) {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d) / 86_400_000)
  if (diffDays === 0) return 'Idag'
  if (diffDays === 1) return 'Igår'
  if (diffDays < 7) return `${diffDays} dagar sedan`
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function fmtDuration(workout) {
  if (!workout.finished_at || !workout.created_at) return null
  const mins = Math.round((new Date(workout.finished_at) - new Date(workout.created_at)) / 60000)
  if (mins < 1) return null
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60), m = mins % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

function workSetCount(workout) {
  return (workout.exercises ?? []).reduce(
    (sum, ex) => sum + (ex.sets ?? []).filter(s => s.type === 'work' && s.done).length, 0
  )
}

function fmtExSummary(ex) {
  const ws = (ex.sets ?? []).filter(s => s.type === 'work' && s.done)
  const best = Math.max(...ws.map(s => parseFloat(s.weight) || 0))
  if (best > 0) return `${ws.length}×${best}kg`
  if (ws.length > 0) return `${ws.length} set`
  return null
}

function getNextSession(program, lastWorkout) {
  const sessions = program?.sessions ?? []
  if (!sessions.length) return null
  if (!lastWorkout?.session_name) return sessions[0]
  const idx = sessions.findIndex(s => s.name === lastWorkout.session_name)
  if (idx === -1) return sessions[0]
  return sessions[(idx + 1) % sessions.length]
}

export default function HomeScreen({ session, programs = [], programsLoaded = false, activeProgramId = null }) {
  const [lastWorkout, setLastWorkout] = useState(null)
  const [recentWorkouts, setRecentWorkouts] = useState([])
  const [workoutsLoaded, setWorkoutsLoaded] = useState(false)
  const [lastExpanded, setLastExpanded] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    getWorkouts(session.user.id, 15).then(ws => {
      if (cancelled) return
      setLastWorkout(ws[0] ?? null)
      setRecentWorkouts(ws)
      setWorkoutsLoaded(true)
    }).catch(() => { if (!cancelled) setWorkoutsLoaded(true) })
    return () => { cancelled = true }
  }, [session.user.id])

  const loading = !workoutsLoaded || !programsLoaded

  function handleStartSession(sessionData, program) {
    navigate('/workout', {
      state: {
        sessionName: sessionData.name,
        sessionExercises: sessionData.exercises ?? [],
        programId: program?.id ?? null,
        program: program ?? null,
      },
    })
  }

  function handleStartFreeWorkout() {
    navigate('/workout', { state: { sessionName: 'Fritt pass', sessionExercises: [], programId: null } })
  }

  const activeProgram = programs.find(p => p.id === activeProgramId) ?? programs[0] ?? null

  const monday = getMonday()
  const weeklyCount = recentWorkouts.filter(w => new Date(w.finished_at) >= monday).length

  const programSubtitle = activeProgram
    ? `${activeProgram.name} · ${(activeProgram.sessions ?? []).length} pass/vecka`
    : null

  if (loading) {
    return (
      <div className={styles.screen}>
        <div className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <span className={styles.appTitle}>Gymbanan 🍌</span>
          </div>
        </div>
        <div className={styles.container}>
          <div className={styles.skeletonCard} style={{ height: 88, margin: '0 16px' }} />
          <div className={styles.skeletonCard} style={{ height: 160, margin: '12px 16px 0' }} />
        </div>
      </div>
    )
  }

  const nextSession = getNextSession(activeProgram, lastWorkout)
  const lastSetCount = lastWorkout ? workSetCount(lastWorkout) : 0
  const duration = lastWorkout ? fmtDuration(lastWorkout) : null
  const lastExercises = lastWorkout?.exercises ?? []

  return (
    <div className={styles.screen}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <span className={styles.appTitle}>Gymbanan 🍌</span>
        </div>
      </div>

      <div className={styles.container}>

        {/* ── Alla pass i programmet ── */}
        {activeProgram && (activeProgram.sessions ?? []).length > 0 && (
          <section className={styles.section}>
            <span className={styles.programHeading}>{activeProgram.name}</span>
            <div className={styles.sessionList}>
              {(activeProgram.sessions ?? []).map((s, i) => {
                const isNext = s.name === nextSession?.name
                const isLast = s.name === lastWorkout?.session_name
                return (
                  <div key={s._id ?? s.id ?? i} className={`${styles.sessionRow} ${isNext ? styles.sessionRowNext : ''}`}>
                    <div className={styles.sessionInfo}>
                      <div className={styles.sessionNameRow}>
                        <span className={styles.sessionName}>{s.name}</span>
                        {isNext && <span className={styles.sessionBadgeNext}>Nästa</span>}
                        {isLast && !isNext && <span className={styles.sessionBadgeLast}>Senast</span>}
                      </div>
                      {(s.exercises ?? []).length > 0 && (
                        <span className={styles.sessionMeta}>{s.exercises.length} övningar</span>
                      )}
                    </div>
                    <button
                      className={isNext ? styles.startPill : styles.startBtnSmall}
                      onClick={() => handleStartSession(s, activeProgram)}
                      type="button"
                    >
                      Starta
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Inget program ── */}
        {!activeProgram && (
          <div className={styles.emptyCard}>
            <p className={styles.emptyText}>Inga program ännu</p>
            <p className={styles.emptySubtext}>Skapa ett program under Inställningar</p>
            <button className={styles.freeWorkoutBtn} onClick={handleStartFreeWorkout} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              Starta fritt pass
            </button>
          </div>
        )}

        {/* Fritt pass-knapp */}
        {activeProgram && (
          <>
            <button className={styles.freeWorkoutBtn} style={{ marginTop: 8, marginLeft: 16, marginRight: 16, width: 'calc(100% - 32px)' }} onClick={handleStartFreeWorkout} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              Starta fritt pass
            </button>
            <p className={styles.weeklyCountRow}>{weeklyCount} pass denna vecka</p>
          </>
        )}

        {/* ── Senaste passet (kollapsbart) ── */}
        {lastWorkout && (
          <section className={styles.section}>
            <span className={styles.sectionTitle}>Senaste passet</span>
            <div className={styles.lastCard}>
              <button
                className={styles.lastCardHeader}
                onClick={() => setLastExpanded(v => !v)}
                type="button"
              >
                <div className={styles.lastHeaderLeft}>
                  <span className={styles.lastName}>{lastWorkout.session_name || 'Pass'}</span>
                  <div className={styles.lastMeta}>
                    <span className={styles.lastDate}>{relativeDate(lastWorkout.finished_at)}</span>
                    {duration && <span className={styles.chip}>{duration}</span>}
                    <span className={styles.chip}>{(lastWorkout.exercises ?? []).length} övningar</span>
                    <span className={styles.chip}>{lastSetCount} set</span>
                  </div>
                </div>
                <svg
                  className={`${styles.lastChevron} ${lastExpanded ? styles.lastChevronOpen : ''}`}
                  width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {lastExpanded && lastExercises.length > 0 && (
                <div className={styles.lastExList}>
                  {lastExercises.map((ex, i) => {
                    const summary = fmtExSummary(ex)
                    return (
                      <div key={i} className={styles.lastExRow}>
                        <span className={styles.lastExName}>{ex.name}</span>
                        {summary && <span className={styles.lastExSummary}>{summary}</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Muskelkarta */}
        {recentWorkouts.length > 0 && (
          <section className={styles.section}>
            <span className={styles.sectionTitle}>Muskelåterhämtning</span>
            <MuscleMap workouts={recentWorkouts} />
          </section>
        )}

        {recentWorkouts.length === 0 && programs.length > 0 && (
          <div className={styles.welcomeHint}>
            <p>Starta ditt första pass för att se statistik här</p>
          </div>
        )}

      </div>

    </div>
  )
}
