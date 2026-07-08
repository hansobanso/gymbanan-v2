import { useEffect, useState, useCallback, Suspense } from 'react'
import { lazyWithRetry } from './lib/lazyWithRetry'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { getPrograms, setActiveProgram, getProfile, cacheInvalidate } from './lib/db'
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
const Coach = lazyWithRetry(() => import('./screens/Coach'))

const TAB_PATHS = ['/', '/programs', '/coach', '/history', '/settings']
const ACTIVE_WORKOUT_KEY = 'gymbanan_active_workout'

// Branded laddningsskarm: banan-logga + svepande gul bar (obestamd).
function Splash() {
  return (
    <div className="loading-screen">
      <div className="splash">
        <BananaLogo className="splashBananaLogo" />
        <span className="splashTitle">Gymbanan</span>
        <div className="splashBar">
          <div className="splashBarFill" />
        </div>
      </div>
    </div>
  )
}

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

  // Nar ett pass sparats som kopia (och blivit aktivt) meddelar Workout
  // via event - synka programlistan och aktivt program utan omladdning.
  useEffect(() => {
    function onActiveChanged(e) {
      const prog = e.detail?.program
      if (!prog?.id) return
      setPrograms(prev => prev.some(p => p.id === prog.id) ? prev : [...prev, prog])
      setActiveProgramId(prog.id)
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
  const [homeReady, setHomeReady] = useState(false)
  const [showWhatsNew, setShowWhatsNew] = useState(false)
  const [splashGone, setSplashGone] = useState(false)

  // Nar allt laddat: las baren till 100%, vanta en kort stund sa den hinner
  // synas fylld, ta sen bort splash-overlayn.
  useEffect(() => {
    if (!homeReady) return
    const t = setTimeout(() => setSplashGone(true), 280)
    return () => clearTimeout(t)
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
        <div className="splash-overlay">
          <Splash />
        </div>
      )}
      {/* Resume active workout modal */}
      {resumedWorkout && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 24, maxWidth: 320, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <p style={{ color: '#f0f0f0', fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>Pågående pass</p>
              <p style={{ color: '#888', fontSize: 14, margin: 0 }}>
                Du har ett pågående pass ({resumedWorkout.sessionName ?? 'Pass'}) från {fmtElapsedSince(resumedWorkout.startedAt)}. Vill du fortsätta?
              </p>
            </div>
            <button
              style={{ background: '#F5D020', border: 'none', borderRadius: 12, color: '#000', fontSize: 15, fontWeight: 700, padding: '14px', cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => {
                const w = resumedWorkout
                setResumedWorkout(null)
                navigate('/workout', { state: { sessionName: w.sessionName ?? 'Pass', sessionExercises: [], programId: null, resumed: w } })
              }}
              type="button"
            >
              Fortsätt passet
            </button>
            <button
              style={{ background: 'none', border: 'none', color: '#888', fontSize: 14, padding: '8px', cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => { localStorage.removeItem(ACTIVE_WORKOUT_KEY); setResumedWorkout(null) }}
              type="button"
            >
              Avsluta utan att spara
            </button>
          </div>
        </div>
      )}

      {/* Always-mounted tab screens — shown/hidden via CSS */}
      <Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',flex:1}}><div className="spinner"/></div>}>
        <div style={tabStyle('/')}><Home session={session} programs={programs} programsLoaded={programsLoaded} programsError={programsError} onRetryPrograms={loadPrograms} activeProgramId={activeProgramId} onSetActive={id => { setActiveProgramId(id); setActiveProgram(session.user.id, id).catch(() => {}) }} onReady={() => setHomeReady(true)} /></div>
        <div style={tabStyle('/programs')}><Programs session={session} programs={programs} setPrograms={setPrograms} activeProgramId={activeProgramId} onSetActive={id => { setActiveProgramId(id); setActiveProgram(session.user.id, id).catch(() => {}) }} /></div>
        <div style={tabStyle('/coach')}><Coach session={session} onProgramUpdated={(updated) => setPrograms(prev => prev.map(p => p.id === updated.id ? updated : p))} onSwitchProgram={(id) => { setActiveProgramId(id); return setActiveProgram(session.user.id, id) }} onProgramCreated={(created) => setPrograms(prev => [...prev, created])} /></div>
        <div style={tabStyle('/history')}><History session={session} /></div>
        <div style={tabStyle('/settings')}><Settings session={session} /></div>

        {/* Deep screens — normal route mounting */}
        {!isTab && (
          <Routes>
            <Route path="/workout" element={<Workout session={session} />} />
            <Route path="/exercises" element={<ExerciseLibrary />} />
            <Route path="/exercises/:id" element={<ExerciseDetail />} />
            <Route path="/body-weight" element={<BodyWeight session={session} />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </Suspense>

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
