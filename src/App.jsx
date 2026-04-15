import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { getPrograms, getActiveProgram, setActiveProgram } from './lib/db'
import Auth from './screens/Auth'
import Home from './screens/Home'
import Workout from './screens/Workout'
import History from './screens/History'
import Settings from './screens/Settings'
import ExerciseLibrary from './screens/ExerciseLibrary'
import ExerciseDetail from './screens/ExerciseDetail'
import Admin from './screens/Admin'
import BodyWeight from './screens/BodyWeight'
import Programs from './screens/Programs'
import BottomNav from './components/shared/BottomNav'
import './App.css'

const TAB_PATHS = ['/', '/programs', '/history', '/settings']
const ACTIVE_WORKOUT_KEY = 'gymbanan_active_workout'

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

  useEffect(() => {
    getPrograms(session.user.id).then(async progs => {
      setPrograms(progs)
      const active = await getActiveProgram(session.user.id, progs)
      if (active) setActiveProgramId(active.id)
      setProgramsLoaded(true)
    }).catch(() => setProgramsLoaded(true))
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
      <div style={tabStyle('/')}><Home session={session} programs={programs} programsLoaded={programsLoaded} activeProgramId={activeProgramId} /></div>
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

      {isTab && <BottomNav />}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)


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
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    )
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
