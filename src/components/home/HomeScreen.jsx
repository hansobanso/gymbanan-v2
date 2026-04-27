import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getWorkouts, getDeloadStatus, endDeloadWeek } from '../../lib/db'
import MuscleMap from '../shared/MuscleMap'
import SessionPreview from './SessionPreview'
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
  const [previewSession, setPreviewSession] = useState(null) // { session, program }
  const [deloadStatus, setDeloadStatus] = useState({ isActive: false, daysLeft: 0 })
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    getWorkouts(session.user.id, 15).then(ws => {
      if (cancelled) return
      setLastWorkout(ws[0] ?? null)
      setRecentWorkouts(ws)
      setWorkoutsLoaded(true)
    }).catch(() => { if (!cancelled) setWorkoutsLoaded(true) })
    getDeloadStatus(session.user.id).then(s => {
      if (!cancelled) setDeloadStatus(s)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [session.user.id])

  // Refetch workouts when returning to the app (e.g. after finishing a workout)
  useEffect(() => {
    function refetch() {
      if (document.visibilityState === 'visible') {
        getWorkouts(session.user.id, 15).then(ws => {
          setLastWorkout(ws[0] ?? null)
          setRecentWorkouts(ws)
        }).catch(() => {})
        getDeloadStatus(session.user.id).then(setDeloadStatus).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', refetch)
    window.addEventListener('focus', refetch)
    return () => {
      document.removeEventListener('visibilitychange', refetch)
      window.removeEventListener('focus', refetch)
    }
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
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          <span className={styles.pageTitleText}>Gymbanan</span>
          <svg className={styles.pageTitleIcon} viewBox="0 0 24 24" fill="none" stroke="#F5D020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 8 5"/>
            <path d="M5.15 17.89c5.52-1.52 8.65-6.89 7-12C11.55 4 11.5 2 13 2c3.22 0 5 5.5 5 8 0 6.5-4.2 12-10.49 12C5.55 22 4 21.3 4 20c0-1.1.5-2.31 1.15-2.11Z"/>
          </svg>
        </h1>
      </header>
      <div className={styles.container}>

        {/* ── Deload-banner ── */}
        {deloadStatus.isActive && (
          <div className={styles.deloadBanner}>
            <div className={styles.deloadBannerContent}>
              <span className={styles.deloadBannerIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <path d="m9 11 3 3L22 4"/>
                </svg>
              </span>
              <div className={styles.deloadBannerText}>
                <span className={styles.deloadBannerTitle}>Deload-vecka aktiv</span>
                <span className={styles.deloadBannerSub}>
                  {deloadStatus.daysLeft} {deloadStatus.daysLeft === 1 ? 'dag' : 'dagar'} kvar · vikter automatiskt sänkta
                </span>
              </div>
            </div>
            <button
              className={styles.deloadBannerEnd}
              onClick={async () => {
                if (window.confirm('Avsluta deload-veckan i förtid?')) {
                  await endDeloadWeek(session.user.id).catch(() => {})
                  setDeloadStatus({ isActive: false, daysLeft: 0 })
                }
              }}
              type="button"
              aria-label="Avsluta deload-vecka"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Alla pass i programmet ── */}
        {activeProgram && (activeProgram.sessions ?? []).length > 0 && (
          <section className={styles.section}>
            <span className={styles.programHeading}>
              <span className={styles.programLabel}>PROGRAM:</span> {activeProgram.name}
            </span>
            <div className={styles.sessionList}>
              {(activeProgram.sessions ?? []).map((s, i) => {
                const isNext = s.name === nextSession?.name
                const isLast = s.name === lastWorkout?.session_name
                return (
                  <div key={s._id ?? s.id ?? i} className={`${styles.sessionRow} ${isNext ? styles.sessionRowNext : ''}`}>
                    <button
                      className={styles.sessionInfo}
                      onClick={() => setPreviewSession({ session: s, program: activeProgram })}
                      type="button"
                    >
                      <span className={styles.sessionName}>{s.name}</span>
                      <div className={styles.sessionMetaRow}>
                        {isNext && <span className={styles.sessionBadgeNext}>NÄSTA</span>}
                        {isLast && !isNext && <span className={styles.sessionBadgeLast}>SENAST</span>}
                        {(s.exercises ?? []).length > 0 && (
                          <span className={styles.sessionMeta}>{s.exercises.length} övningar</span>
                        )}
                      </div>
                    </button>
                    <button
                      className={styles.sessionStartBtn}
                      onClick={() => handleStartSession(s, activeProgram)}
                      type="button"
                      aria-label={`Starta ${s.name}`}
                    >
                      <span className={styles.sessionStartLabel}>Starta</span>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
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

        {/* Fritt pass + veckocount på samma rad */}
        {activeProgram && (
          <div className={styles.freeRow}>
            <span className={styles.weeklyCount}>{weeklyCount} pass denna vecka</span>
            <button className={styles.freeLink} onClick={handleStartFreeWorkout} type="button">
              + Starta fritt pass
            </button>
          </div>
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
                  width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                >
                  <path d="m9 18 6-6-6-6"/>
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
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <MuscleMap workouts={recentWorkouts} size={280} />
            </div>
          </section>
        )}

        {recentWorkouts.length === 0 && programs.length > 0 && (
          <div className={styles.welcomeHint}>
            <p>Starta ditt första pass för att se statistik här</p>
          </div>
        )}

      </div>

      {/* ── Pass-förhandsgranskning ── */}
      <SessionPreview
        open={previewSession !== null}
        session={previewSession?.session}
        userId={session.user.id}
        onStart={() => {
          if (previewSession) {
            const { session: s, program } = previewSession
            setPreviewSession(null)
            handleStartSession(s, program)
          }
        }}
        onClose={() => setPreviewSession(null)}
      />

    </div>
  )
}
