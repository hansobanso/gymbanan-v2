import { useEffect, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { getPrograms, setActiveProgram } from './lib/db'
import Auth from './screens/Auth'
import Home from './screens/Home'
import BottomNav from './components/shared/BottomNav'
import './App.css'

// Lazy-ladda allt utom Home + Auth (forsta skarmarna man ser).
// Drar ner main-bundlen rejalt sa appen startar snabbare.
const Workout = lazy(() => import('./screens/Workout'))
const History = lazy(() => import('./screens/History'))
const Settings = lazy(() => import('./screens/Settings'))
const ExerciseLibrary = lazy(() => import('./screens/ExerciseLibrary'))
const ExerciseDetail = lazy(() => import('./screens/ExerciseDetail'))
const Admin = lazy(() => import('./screens/Admin'))
const BodyWeight = lazy(() => import('./screens/BodyWeight'))
const Programs = lazy(() => import('./screens/Programs'))

const TAB_PATHS = ['/', '/programs', '/history', '/settings']
const ACTIVE_WORKOUT_KEY = 'gymbanan_active_workout'

// Branded laddningsskarm: banan-logga + gul progressbar.
function Splash() {
  return (
    <div className="loading-screen">
      <div className="splash">
        <div className="splashLogo">
          <span className="splashTitle">Gymbanan</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="#F5D020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 8 5"/>
            <path d="M5.15 17.89c5.52-1.52 8.65-6.89 7-12C11.55 4 11.5 2 13 2c3.22 0 5 5.5 5 8 0 6.5-4.2 12-10.49 12C5.55 22 4 21.3 4 20c0-1.1.5-2.31 1.15-2.11Z"/>
          </svg>
        </div>
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
  const [activeProgramId, setActiveProgramId] = useState(null)
  const [homeReady, setHomeReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getPrograms(session.user.id),
      supabase.from('profiles').select('active_program_id').eq('id', session.user.id).maybeSingle(),
    ]).then(([progs, { data: profile }]) => {
      if (cancelled) return
      setPrograms(progs)
      const activeId = profile?.active_program_id
      if (activeId && progs.some(p => p.id === activeId)) {
        setActiveProgramId(activeId)
      }
      setProgramsLoaded(true)
    }).catch(() => { if (!cancelled) setProgramsLoaded(true) })
    return () => { cancelled = true }
  }, [session.user.id])

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
          sa anvandaren ser en clean loader istallet for skelett som blinkar. */}
      {!homeReady && <div className="splash-overlay"><Splash /></div>}
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
        <div style={tabStyle('/')}><Home session={session} programs={programs} programsLoaded={programsLoaded} activeProgramId={activeProgramId} onSetActive={id => { setActiveProgramId(id); setActiveProgram(session.user.id, id).catch(() => {}) }} onReady={() => setHomeReady(true)} /></div>
        <div style={tabStyle('/programs')}><Programs session={session} programs={programs} setPrograms={setPrograms} activeProgramId={activeProgramId} onSetActive={id => { setActiveProgramId(id); setActiveProgram(session.user.id, id).catch(() => {}) }} /></div>
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
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)

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
