import { useState, useEffect } from 'react'
import { calendarDaysAgo } from '../../lib/dates'
import { useNavigate } from 'react-router-dom'
import { getWorkouts, getDeloadStatus, endDeloadWeek, getProfile, cacheInvalidate, getExercises } from '../../lib/db'
import { supabase } from '../../lib/supabase'
import { detectGapAdjustment } from '../../lib/progression'
import { weekStrip, muscleStatus, sessionSummary, daysLabel, workoutMinutes, pbCount, isoWeek } from '../../lib/homeStats'
import { BananaIcon } from '../shared/Icons'
import AppInfo from '../shared/AppInfo'
import SessionPreview from './SessionPreview'
import styles from './HomeScreen.module.css'
import h from './Home.module.css'

const WEEKDAYS_AGO = ['i söndags', 'i måndags', 'i tisdags', 'i onsdags', 'i torsdags', 'i fredags', 'i lördags']

// "idag", "igår", "i måndags", "för 12 dagar sedan"
function relativeAgo(iso) {
  const days = calendarDaysAgo(iso)
  if (days <= 0) return 'idag'
  if (days === 1) return 'igår'
  if (days < 7) return WEEKDAYS_AGO[new Date(iso).getDay()]
  return `för ${days} dagar sedan`
}

function fmtKg(w) {
  return String(Math.round(w * 100) / 100).replace('.', ',')
}

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
)
const Chevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
)

// Nasta pass = passet efter det senast korda passet SOM HOR TILL PROGRAMMET.
// Ett fritt pass (eller ett pass fran ett annat program) emellan ska inte
// nollstalla rotationen till forsta passet.
function getNextSession(program, recentWorkouts) {
  const sessions = program?.sessions ?? []
  if (!sessions.length) return null
  for (const w of recentWorkouts ?? []) {
    const idx = sessions.findIndex(s => s.name === w.session_name)
    if (idx !== -1) return sessions[(idx + 1) % sessions.length]
  }
  return sessions[0]
}

export default function HomeScreen({ session, programs = [], programsLoaded = false, programsError = false, onRetryPrograms, activeProgramId = null, onSetActive, onReady }) {
  const [recentWorkouts, setRecentWorkouts] = useState([])
  const [workoutsLoaded, setWorkoutsLoaded] = useState(false)
  const [previewSession, setPreviewSession] = useState(null) // { session, program }
  const [deloadStatus, setDeloadStatus] = useState({ isActive: false, daysLeft: 0 })
  const [displayName, setDisplayName] = useState('')
  const [introDismissed, setIntroDismissed] = useState(true) // antar dolt tills vi laddat (undvik flimmer)
  const [exerciseMap, setExerciseMap] = useState({})
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    getWorkouts(session.user.id, 15).then(ws => {
      if (cancelled) return
      setRecentWorkouts(ws)
      setWorkoutsLoaded(true)
    }).catch(() => { if (!cancelled) setWorkoutsLoaded(true) })
    // Ovningsbiblioteket: namn -> muscle_group, sa muskelgubben kan slå upp
    // ratt muskel aven nar passloggen saknar muscle_group.
    getExercises().then(list => {
      if (cancelled) return
      const map = {}
      for (const ex of list ?? []) map[ex.name] = ex
      setExerciseMap(map)
    }).catch(() => {})
    getDeloadStatus(session.user.id).then(s => {
      if (!cancelled) setDeloadStatus(s)
    }).catch(() => {})
    getProfile(session.user.id)
      .then(data => {
        if (cancelled || !data) return
        if (data.display_name) setDisplayName(data.display_name)
        setIntroDismissed(data.intro_dismissed === true)
      }, () => {})
    return () => { cancelled = true }
  }, [session.user.id])

  // Refetch workouts when returning to the app (e.g. after finishing a workout)
  useEffect(() => {
    function refetch() {
      getWorkouts(session.user.id, 15).then(ws => {
        setRecentWorkouts(ws)
      }).catch(() => {})
      getDeloadStatus(session.user.id).then(setDeloadStatus).catch(() => {})
    }
    function onVisible() {
      if (document.visibilityState === 'visible') refetch()
    }
    // workoutsChanged triggas nar ett pass avslutas (navigering inom appen,
    // dar visibilitychange INTE sker) - sa muskelfiguren uppdateras direkt.
    window.addEventListener('workoutsChanged', refetch)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.removeEventListener('workoutsChanged', refetch)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [session.user.id])

  const loading = !workoutsLoaded || !programsLoaded

  // Signalera uppat nar allt ar laddat sa App kan ta bort splash-skarmen.
  useEffect(() => {
    if (workoutsLoaded && programsLoaded) onReady?.()
  }, [workoutsLoaded, programsLoaded, onReady])

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

  // Stang introt: persistera till profiles sa det inte dyker upp igen.
  // Det finns kvar under Installningar -> "Sa funkar appen".
  function dismissIntro() {
    setIntroDismissed(true)
    supabase.from('profiles')
      .update({ intro_dismissed: true, updated_at: new Date().toISOString() })
      .eq('id', session.user.id)
      .then(() => { cacheInvalidate(`profile:${session.user.id}`) }, () => {})
  }

  // Globala (mall-)program att erbjuda nya anvandare.
  const globalPrograms = programs.filter(p => p.is_global)

  // Aktivt program: BARA om anvandaren uttryckligen valt ett (activeProgramId).
  // Vi auto-valjer aldrig nagot program - varken globalt eller eget. En anvandare
  // maste sjalv valja en mall eller skapa eget forsta gangen.
  const activeProgram =
    programs.find(p => p.id === activeProgramId) ?? null

  // Ny anvandare / inget val gjort: inget aktivt program valt.
  // Men INTE om program-laddningen misslyckades (da visar vi felvyn istallet).
  const hasLoadError = programsError && programs.length === 0
  const isNewUser = !activeProgram && !hasLoadError

  if (loading) {
    return (
      <div className={styles.screen}>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>
            <span className={styles.pageTitleText}>Gymbanan</span>
            <BananaIcon className={styles.pageTitleIcon} />
          </h1>
        </header>
        <div className={styles.container}>
          {/* Program-label */}
          <div style={{ padding: '0 16px', marginBottom: 8 }}>
            <div className={styles.skeletonLine} style={{ width: '45%', height: 13 }} />
          </div>
          {/* Pass-kort x3 */}
          {[0, 1, 2].map(i => (
            <div key={i} className={styles.skeletonSessionCard}>
              <div>
                <div className={styles.skeletonLine} style={{ width: '40%', height: 16 }} />
                <div className={styles.skeletonLine} style={{ width: '30%', height: 11, marginTop: 6 }} />
              </div>
              <div className={styles.skeletonLine} style={{ width: 60, height: 14 }} />
            </div>
          ))}
          {/* Senaste passet */}
          <div style={{ padding: '16px 16px 0' }}>
            <div className={styles.skeletonLine} style={{ width: '35%', height: 11, marginBottom: 8 }} />
          </div>
          <div className={styles.skeletonCard} style={{ margin: '0 16px' }}>
            <div className={styles.skeletonLine} style={{ width: '30%', height: 16 }} />
            <div className={styles.skeletonLine} style={{ width: '55%', height: 12, marginTop: 8 }} />
          </div>
        </div>
      </div>
    )
  }

  const nextSession = getNextSession(activeProgram, recentWorkouts)
  const sessions = activeProgram?.sessions ?? []
  const otherSessions = sessions.filter(s => s !== nextSession)
  const strip = weekStrip(recentWorkouts)
  const today = strip.days.find(d => d.isToday)
  const trainedToday = !!today?.trained
  const next = nextSession ? sessionSummary(nextSession, recentWorkouts, exerciseMap) : null
  const nextCount = (nextSession?.exercises ?? []).length
  const previewRows = next ? next.preview.slice(0, nextCount <= 3 ? 3 : 2) : []
  const muscles = muscleStatus(recentWorkouts, exerciseMap)

  // PT-besked pa kortet: sag i forvag om uppehallet paverkar dagens vikter.
  let ptNote = null
  if (nextSession && !deloadStatus.isActive) {
    const gap = detectGapAdjustment(recentWorkouts, (nextSession.exercises ?? []).map(e => e.name))
    if (gap?.hold) ptNote = `${gap.days} dagar sedan sist. Du får samma vikter och reps som förra gången.`
    else if (gap) ptNote = `${gap.days} dagar sedan sist. Vikterna sänks ${gap.days > 28 ? 20 : 10} % idag.`
  }

  const dayName = today ? today.name.charAt(0).toUpperCase() + today.name.slice(1) : ''
  const headline = trainedToday ? 'Bra jobbat idag'
    : nextSession ? `${dayName}, dags för ${nextSession.name}`
    : 'Gymbanan'

  return (
    <div className={styles.screen}>
      <header className={styles.pageHeader}>
        <div className={h.head}>
          <div className={h.headText}>
            <span className={h.eyebrow}>GYMBANAN</span>
            <h1 className={h.headline}>{headline}</h1>
          </div>
          <BananaIcon className={h.headIcon} />
        </div>
      </header>
      <div className={styles.container}>

        {/* ── Laddningsfel  return (
    <div className={styles.screen}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          <span className={styles.pageTitleText}>Gymbanan</span>
          <BananaIcon className={styles.pageTitleIcon} />
        </h1>
      </header>
      <div className={styles.container}>

        {/* ── Laddningsfel: kunde inte hamta program (skiljs fran ny anvandare) ── */}
        {programsError && programs.length === 0 && (
          <div className={styles.errorCard}>
            <p className={styles.errorTitle}>Kunde inte ladda dina program</p>
            <p className={styles.errorSub}>Kontrollera din anslutning och försök igen.</p>
            <button className={styles.errorRetryBtn} onClick={() => onRetryPrograms?.()} type="button">
              Försök igen
            </button>
          </div>
        )}

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

        {/* ── Veckan: bara vad som ar gjort, inget mal ── */}
        {(activeProgram || recentWorkouts.length > 0) && (
          <section className={h.block}>
            <div className={h.labelRow}>
              <span className={h.label}>Vecka {isoWeek()}</span>
              <span className={h.labelRight}><b>{strip.count}</b> pass hittills</span>
            </div>
            <div
              className={h.week}
              role="img"
              aria-label={`Tränat ${strip.days.filter(d => d.trained).map(d => d.name).join(', ') || 'inga dagar'} den här veckan`}
            >
              {strip.days.map((d, i) => (
                <div key={i} className={h.day}>
                  <span className={d.isToday ? h.dayLetterToday : h.dayLetter}>{d.letter}</span>
                  <span className={[
                    h.dot,
                    d.trained ? h.dotDone : '',
                    d.isToday ? h.dotToday : '',
                    d.isFuture ? h.dotFuture : '',
                  ].join(' ')}>
                    {d.trained ? <CheckIcon /> : d.isToday ? <span className={h.dotCore} /> : null}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Nasta pass: sidans huvudsak ── */}
        {nextSession && (
          <section className={h.hero}>
            <div className={h.heroTop}>
              <div className={h.heroTitleCol}>
                <span className={h.eyebrow}>NÄSTA PASS</span>
                <span className={h.heroName}>{nextSession.name}</span>
                {next.muscles.length > 0 && (
                  <span className={h.sub}>{next.muscles.slice(0, 3).join(' · ')}</span>
                )}
              </div>
              <div className={h.heroStats}>
                {nextCount > 0 && (
                  <div className={h.stat}>
                    <span className={h.statNum}>{nextCount}</span>
                    <span className={h.statLabel}>övningar</span>
                  </div>
                )}
                {next.estMin && (
                  <div className={h.stat}>
                    <span className={h.statNum}>~{next.estMin}</span>
                    <span className={h.statLabel}>min</span>
                  </div>
                )}
              </div>
            </div>

            {nextCount > 0 && (
              <div className={h.preview}>
                {previewRows.map((ex, i) => (
                  <div key={i} className={h.previewRow}>
                    <span className={h.previewName}>{ex.name}</span>
                    <span className={h.previewMeta}>
                      {ex.weight > 0 ? `${ex.sets} × ${fmtKg(ex.weight)} kg`
                        : ex.repsMin && ex.repsMax ? `${ex.sets} × ${ex.repsMin}–${ex.repsMax}`
                        : `${ex.sets} set`}
                    </span>
                  </div>
                ))}
                <button
                  className={h.previewMore}
                  onClick={() => setPreviewSession({ session: nextSession, program: activeProgram })}
                  type="button"
                >
                  Visa alla {nextCount} övningar
                </button>
              </div>
            )}

            {ptNote && <span className={h.hint}>{ptNote}</span>}

            <button
              className={h.startBtn}
              onClick={() => handleStartSession(nextSession, activeProgram)}
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"/></svg>
              Starta {nextSession.name}
            </button>
          </section>
        )}

        {/* ── Ovriga pass i programmet + fritt pass ── */}
        {activeProgram && (
          <section className={h.block}>
            <div className={h.labelRow}>
              <span className={h.label}>{activeProgram.name}</span>
              <button className={h.linkBtn} onClick={handleStartFreeWorkout} type="button">
                Fritt pass
              </button>
            </div>
            <div className={h.rows}>
              {otherSessions.map((s, i) => {
                const sum = sessionSummary(s, recentWorkouts, exerciseMap)
                const mins = workoutMinutes(sum.last)
                const pbs = pbCount(sum.last)
                const count = (s.exercises ?? []).length
                const meta = sum.last
                  ? [`Senast ${relativeAgo(sum.last.finished_at)}`, mins ? `${mins} min` : null, pbs ? `${pbs} PB` : null]
                  : [count ? `${count} övningar` : null, 'inte kört än']
                return (
                  <button
                    key={s._id ?? s.id ?? i}
                    className={h.row}
                    onClick={() => setPreviewSession({ session: s, program: activeProgram })}
                    type="button"
                  >
                    <span className={h.rowText}>
                      <span className={h.rowName}>{s.name}</span>
                      <span className={h.rowMeta}>{meta.filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={h.rowChevron}><Chevron /></span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Valkomst for ny anvandare: valj mallprogram eller skapa eget ── */}
        {isNewUser && (
          <section className={styles.section}>
            <div className={styles.welcomeCard}>
              <h2 className={styles.welcomeTitle}>
                {displayName ? `Välkommen, ${displayName}!` : 'Välkommen till Gymbanan!'}
              </h2>
              <p className={styles.welcomeBody}>
                Kom igång genom att välja ett färdigt program nedan, eller skapa ett eget.
              </p>
              {!introDismissed && (
                <>
                  <AppInfo />
                  <button
                    className={styles.introDismissBtn}
                    onClick={dismissIntro}
                    type="button"
                  >
                    Förstått – dölj introt
                  </button>
                  <p className={styles.introDismissHint}>
                    Du hittar det igen under Inställningar → Så funkar appen
                  </p>
                </>
              )}
            </div>

            {globalPrograms.length > 0 && (
              <>
                <span className={styles.welcomeLabel}>FÄRDIGA PROGRAM</span>
                <div className={styles.sessionList}>
                  {globalPrograms.map(p => (
                    <button
                      key={p.id}
                      className={styles.welcomeProgramRow}
                      onClick={() => onSetActive?.(p.id)}
                      type="button"
                    >
                      <div className={styles.welcomeProgramInfo}>
                        <span className={styles.welcomeProgramName}>{p.name}</span>
                        <span className={styles.welcomeProgramMeta}>
                          {(p.sessions ?? []).length} pass/vecka
                        </span>
                      </div>
                      <span className={styles.welcomeProgramAction}>Välj</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <button
              className={styles.welcomeCreateBtn}
              onClick={() => navigate('/programs')}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              Skapa eget program
            </button>

            <button className={styles.welcomeFreeLink} onClick={handleStartFreeWorkout} type="button">
              eller starta ett fritt pass direkt
            </button>
          </section>
        )}

        {/* ── Inget aktivt program men har egna ── */}
        {!isNewUser && !activeProgram && !hasLoadError && (
          <div className={styles.emptyCard}>
            <p className={styles.emptyText}>Inget aktivt program</p>
            <p className={styles.emptySubtext}>Välj ett program under Program-fliken</p>
            <button className={styles.freeWorkoutBtn} onClick={handleStartFreeWorkout} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              Starta fritt pass
            </button>
          </div>
        )}

        {/* ── Muskellage: nar ar varje grupp farsk igen? ── */}
        {recentWorkouts.length > 0 && (
          <section className={h.block}>
            <div className={h.labelRow}>
              <span className={h.label}>Muskelläge</span>
              <span className={h.labelRight}>senast tränad</span>
            </div>
            <div className={h.muscleGrid}>
              {muscles.map(m => (
                <div key={m.group} className={h.muscle}>
                  <div className={h.muscleTop}>
                    <span className={h.muscleName}>{m.group}</span>
                    <span className={h.muscleDays}>{daysLabel(m.days)}</span>
                  </div>
                  {m.state === 'ready' && <span className={h.stateReady}>Redo</span>}
                  {m.state === 'resting' && <span className={h.stateResting}>Vilar, {m.readyLabel}</span>}
                  {m.state === 'neglected' && (
                    <span className={h.stateNeglected}>{m.days == null ? 'Inte tränad' : 'Inte tränad på länge'}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
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
