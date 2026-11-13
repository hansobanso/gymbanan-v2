import { useEffect, useState, useCallback, Suspense } from 'react'
import { lazyWithRetry } from './lib/lazyWithRetry'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { getPrograms, setActiveProgram, getProfile, cacheInvalidate, deleteUnfinishedWorkout } from './lib/db'
import Auth from './screens/Auth'
import Home from './screens/Home'
import BottomNav from './components/shared/BottomNav'
import WhatsNew, { WHATSNEW_VERSION } from './components/shared/WhatsNew'
import { BananaLogo } from './components/shared/Icons'
import './App.css'

// Lazy-ladda allt utom Home + Auth (forsta skarmarna man ser).
// Drar ner main-bundlen rejalt sa appen startar snabbare.
const Workout = lazyWithRetry(() => import('./screens/Workout'))
const History = lazyWithRetry(() => import('./screens/History'))
const Settings = lazyWithRetry(() => import('./screens/Settings'))
const ExerciseLibrary = lazyWithRetry(() => import('./screens/ExerciseLibrary'))
const ExerciseDetail = lazyWithRetry(() => import('./screens/ExerciseDetail'))
const Admin = lazyWithRetry(() => import('./screens/Admin'))
const BodyWeight = lazyWithRetry(() => import('./screens/BodyWeight'))
const Programs = lazyWithRetry(() => import('./screens/Programs'))

const TAB_PATHS = ['/', '/programs', '/history', '/settings']
const ACTIVE_WORKOUT_KEY = 'gymbanan_active_workout'

// Branded laddningsskarm: banan-logga + svepande gul bar (obestamd).
function Splash() {
  return (
    <div className="loading-screen">
      <div className="splash">
        <BananaLogo className="splashBananaLogo" />
        <span className="splashTitle">GYMBANAN</span>
        <div className="splashBar">
          <div className="splashBarFill" />
        </div>
      </div>
    </div>
  )
}

// Loggan ritas upp pa drygt en halv sekund. Lat den hinna klart aven nar
// appen laddar snabbare an sa.
const SPLASH_MIN_MS = 850

function fmtElapsedSince(isoString) {
  const mins = Math.round((Date.now() - new Date(isoString)) / 60000)
  if (mins < 1) return 'nyss'
  if (mins < 60) return `${mins} min sedan`
  const h = Math.floor(mins / 60)
  return `${h}h ${mins % 60}m sedan`
}

function AppRoutes({ session }) {
  const location = useLocation()
  const navigate = useNavigate()
  const p = location.pathname
  const isTab = TAB_PATHS.includes(p)

  // Shared programs state – fetched once, mutated optimistically by Programs screen
  const [programs, setPrograms] = useState([])
  const [programsLoaded, setProgramsLoaded] = useState(false)
  const [programsError, setProgramsError] = useState(false)
  const [activeProgramId, setActiveProgramId] = useState(null)
  const [homeReady, setHomeReady] = useState(false)
  const [showWhatsNew, setShowWhatsNew] = useState(false)
  const [splashGone, setSplashGone] = useState(false)
  const [splashLeaving, setSplashLeaving] = useState(false)
  const [splashShownAt] = useState(() => Date.now())

  // Nar ett pass sparats som kopia (och blivit aktivt) meddelar Workout
  // via event - synka programlistan och aktivt program utan omladdning.
  useEffect(() => {
    function onActiveChanged(e) {
      const prog = e.detail?.program
      if (!prog?.id) return
      // Ersatt ett befintligt program (uppdatering) eller lagg till nytt (kopia),
      // sa listan alltid speglar senaste sessions.
      setPrograms(prev => prev.some(p => p.id === prog.id)
        ? prev.map(p => p.id === prog.id ? prog : p)
        : [...prev, prog])
      // makeActive: false vid ren uppdatering - andra inte vilket som ar aktivt.
      if (e.detail?.makeActive !== false) setActiveProgramId(prog.id)
    }
    window.addEventListener('activeProgramChanged', onActiveChanged)
    // "Vad ar nytt?" i Installningar oppnar nyhetsrutan manuellt
    function onShowWhatsNew() { setShowWhatsNew(true) }
    window.addEventListener('showWhatsNew', onShowWhatsNew)
    return () => {
      window.removeEventListener('activeProgramChanged', onActiveChanged)
      window.removeEventListener('showWhatsNew', onShowWhatsNew)
    }
  }, [])

  // Nar allt laddat: las baren till 100%, vanta en kort stund sa den hinner
  // synas fylld, ta sen bort splash-overlayn.
  useEffect(() => {
    if (!homeReady) return
    // Forst tonas startskarmen ut (260 ms), sedan tas den bort.
    const hold = Math.max(0, SPLASH_MIN_MS - (Date.now() - splashShownAt))
    const t1 = setTimeout(() => setSplashLeaving(true), hold)
    const t2 = setTimeout(() => setSplashGone(true), hold + 260)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [homeReady])

  const loadPrograms = useCallback(() => {
    let cancelled = false
    setProgramsError(false)
    Promise.all([
      getPrograms(session.user.id),
      getProfile(session.user.id),
    ]).then(([progs, profile]) => {
      if (cancelled) return
      setPrograms(progs)
      setProgramsError(false)
      const activeId = profile?.active_program_id
      if (activeId && progs.some(p => p.id === activeId)) {
        setActiveProgramId(activeId)
      }
      if (profile && profile.whatsnew_seen !== WHATSNEW_VERSION) {
        setShowWhatsNew(true)
      }
      setProgramsLoaded(true)
    }).catch(() => {
      if (cancelled) return
      // Skilj pa "inga program finns" och "kunde inte hamta program".
      // Vid fel: flagga sa HomeScreen kan visa laddningsfel istallet for
      // att felaktigt visa ny-anvandar-vyn.
      setProgramsError(true)
      setProgramsLoaded(true)
    })
    return () => { cancelled = true }
  }, [session.user.id])

  useEffect(() => {
    return loadPrograms()
  }, [loadPrograms])

  // Sakerstall att profiles.display_name finns. Om namnet angavs vid signup
  // men profilen inte hann skrivas (t.ex. p.g.a. e-postbekraftelse), kopiera
  // det fran auth-metadata vid forsta inloggning.
  useEffect(() => {
    const metaName = session.user.user_metadata?.display_name
    if (!metaName) return
    supabase.from('profiles').select('display_name').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => {
        if (!data?.display_name) {
          supabase.from('profiles')
            .upsert({ id: session.user.id, display_name: metaName, updated_at: new Date().toISOString() })
            .then(() => {}, () => {})
        }
      }, () => {})
  }, [session.user.id])

  const [resumedWorkout, setResumedWorkout] = useState(() => {
    const raw = localStorage.getItem(ACTIVE_WORKOUT_KEY)
    if (!raw) return null
    try {
      const data = JSON.parse(raw)
      return data
    } catch {
      localStorage.removeItem(ACTIVE_WORKOUT_KEY)
      return null
    }
  })

  // Hamnar man pa en flik medan ett pass ligger sparat lokalt (t.ex. efter
  // ett bakat-svep ut ur passet) ska fragan komma direkt - annars lag passet
  // osynligt kvar och skrevs over nasta gang man startade ett pass.
  //
  // Passet "minimeras" da: flikarna gar att anvanda som vanligt och en rad
  // ovanfor menyn tar en tillbaka. (Vid kallstart av appen visas i stallet
  // fragan "Pagaende pass", se resumedWorkout ovan.)
  const [minimized, setMinimized] = useState(null)
  useEffect(() => {
    if (!isTab || resumedWorkout) return
    const raw = localStorage.getItem(ACTIVE_WORKOUT_KEY)
    if (!raw) { setMinimized(null); return }
    try { setMinimized(JSON.parse(raw)) } catch { localStorage.removeItem(ACTIVE_WORKOUT_KEY); setMinimized(null) }
  }, [p]) // eslint-disable-line react-hooks/exhaustive-deps

  function resumeWorkout(w) {
    setResumedWorkout(null)
    setMinimized(null)
    // Skicka med programmet sa "spara andringar i programmet"-fragan
    // fungerar aven for ett aterupptaget pass.
    const prog = w.programId ? programs.find(pr => pr.id === w.programId) ?? null : null
    navigate('/workout', {
      replace: p === '/workout',
      state: { sessionName: w.sessionName ?? 'Pass', sessionExercises: [], programId: w.programId ?? null, program: prog, resumed: w },
    })
  }

  // Startar man ett NYTT pass medan ett annat ligger minimerat far det nya
  // inte monteras (det skulle skriva over det sparade). Fraga forst.
  const startConflict = !!minimized && p === '/workout' && !location.state?.resumed
  const askWorkout = resumedWorkout ?? (startConflict ? minimized : null)

  const tabStyle = (path) => ({
    display: p === path ? 'flex' : 'none',
    flexDirection: 'column',
    flex: '1',
    overflow: 'hidden',
    minHeight: 0,
  })

  return (
    <div className="app">
      {/* Splash ligger som overlay tills hemskarmen har laddat all sin data,
          sa anvandaren ser en clean loader istallet for skelett som blinkar.
          sa anvandaren ser en clean loader istallet for skelett som blinkar. */}
      {!splashGone && (
        <div className={`splash-overlay ${splashLeaving ? 'splash-overlay-out' : ''}`}>
          <Splash />
        </div>
      )}
      {/* Resume active workout modal */}
      {askWorkout && (
        <div className="ask-backdrop">
          <div className="ask-card" role="dialog" aria-label="Pågående pass">
            <div>
              <p className="ask-eyebrow">PÅGÅENDE PASS</p>
              <p className="ask-title">{askWorkout.sessionName ?? 'Pass'}</p>
              <p className="ask-text">Startade {fmtElapsedSince(askWorkout.startedAt)}. Vill du fortsätta där du var?</p>
            </div>
            <button className="ask-primary" onClick={() => resumeWorkout(askWorkout)} type="button">
              Fortsätt passet
            </button>
            <button className="ask-secondary" onClick={() => {
                localStorage.removeItem(ACTIVE_WORKOUT_KEY)
                // Stada bort den tomma pass-raden i databasen ocksa
                if (askWorkout.workoutId) deleteUnfinishedWorkout(askWorkout.workoutId).catch(() => {})
                setResumedWorkout(null)
                setMinimized(null)
                if (p === '/workout') navigate('/', { replace: true })
              }} type="button">
              Avsluta utan att spara
            </button>
          </div>
        </div>
      )}

      {/* Always-mounted tab screens — shown/hidden via CSS */}
      <Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',flex:1}}><div className="spinner"/></div>}>
        <div className="tab-screen" style={tabStyle('/')}><Home session={session} programs={programs} programsLoaded={programsLoaded} programsError={programsError} onRetryPrograms={loadPrograms} activeProgramId={activeProgramId} onSetActive={id => { setActiveProgramId(id); setActiveProgram(session.user.id, id).catch(() => {}) }} onReady={() => setHomeReady(true)} activeWorkout={minimized} onResumeWorkout={() => minimized && resumeWorkout(minimized)} /></div>
        <div className="tab-screen" style={tabStyle('/programs')}><Programs session={session} programs={programs} setPrograms={setPrograms} activeProgramId={activeProgramId} onSetActive={id => { setActiveProgramId(id); setActiveProgram(session.user.id, id).catch(() => {}) }} /></div>
        <div className="tab-screen" style={tabStyle('/history')}><History session={session} /></div>
        <div className="tab-screen" style={tabStyle('/settings')}><Settings session={session} /></div>

        {/* Deep screens — normal route mounting */}
        {/* Sa lange "Pagaende pass"-fragan ar obesvarad renderas inga
            djupskarmar. Annars kunde en omladdning mitt i passet (t.ex. efter
            en ny deploy) montera ett NYTT tomt pass under dialogen som skrev
            over det sparade passet. key={location.key} gor att Workout
            monteras om nar man valjer "Fortsatt passet" fran /workout. */}
        {!isTab && !askWorkout && (
          <Routes>
            <Route path="/workout" element={<Workout key={location.key} session={session} />} />
            <Route path="/exercises" element={<ExerciseLibrary />} />
            <Route path="/exercises/:id" element={<ExerciseDetail />} />
            <Route path="/body-weight" element={<BodyWeight session={session} />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </Suspense>

      {/* Minimerat pass: en rad ovanfor menyn som tar en tillbaka */}
      {isTab && minimized && !askWorkout && (
        <button className="active-workout-bar" onClick={() => resumeWorkout(minimized)} type="button">
          <span className="active-workout-dot" aria-hidden="true" />
          <span className="active-workout-text">
            <span className="active-workout-title">Pågående pass · {minimized.sessionName ?? 'Pass'}</span>
            <span className="active-workout-sub">Startade {fmtElapsedSince(minimized.startedAt)}</span>
          </span>
          <span className="active-workout-cta">Fortsätt</span>
        </button>
      )}
      {isTab && <BottomNav />}
      <WhatsNew
        open={showWhatsNew}
        onClose={() => {
          setShowWhatsNew(false)
          supabase.from('profiles')
            .update({ whatsnew_seen: WHATSNEW_VERSION })
            .eq('id', session.user.id)
            .then(() => { cacheInvalidate(`profile:${session.user.id}`) }, () => {})
        }}
      />
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)

  // Admin ar en helt fristaende sida - rendera den direkt, forbi
  // appens session-gate och vanliga inloggning.
  const isAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')

  // Fix iOS Safari safe-area rendering bug on initial load
  useEffect(() => {
    // Force Safari to recalculate env() values after initial render
    if (typeof window !== 'undefined' && /iPhone|iPad/.test(navigator.userAgent)) {
      const forceReflow = () => {
        document.documentElement.style.setProperty('--force-reflow', '1')
        requestAnimationFrame(() => {
          document.documentElement.style.removeProperty('--force-reflow')
        })
      }
      // Run after a brief delay to ensure viewport-fit has taken effect
      setTimeout(forceReflow, 100)
    }
  }, [])

  useEffect(() => {
    localStorage.removeItem('gymbanan_active_program_id')
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isAdminPath) {
    return <AdminStandalone />
  }

  if (session === undefined) {
    return <Splash />
  }

  if (!session) {
    return <Auth />
  }

  return (
    <BrowserRouter>
      <AppRoutes session={session} />
    </BrowserRouter>
  )
}

// Admin renderas helt fristaende - utanfor appens session-gate och
// vanliga inloggning. Admin-sidan har egen losenords-gate och egen
// Supabase-inloggning, sa man slipper ga via vanliga appen forst.
// Detta gor ocksa att iOS kan spara admin som en separat PWA.
function AdminStandalone() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
