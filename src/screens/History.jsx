import { useState, useEffect, useRef, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getWorkouts, getEquipmentMap, deleteWorkout, restoreWorkout } from '../lib/db'
import { displayWeight } from '../lib/weightUtils'
import WorkoutCard from '../components/history/WorkoutCard'
import ProgressView from '../components/history/ProgressView'
import { DumbbellIcon } from '../components/shared/Icons'
import styles from './History.module.css'

export default function History({ session }) {
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [progressOpen, setProgressOpen] = useState(false)
  const [equipmentMap, setEquipmentMap] = useState({})
  const [undoState, setUndoState] = useState(null) // { workout }
  const [progressInitial, setProgressInitial] = useState(null)
  const [progressFromLink, setProgressFromLink] = useState(false) // oppnad via 'Se din utveckling'
  const location = useLocation()
  const navigate = useNavigate()

  // Deep-link fran ovningens detaljsida: oppna styrkeutvecklingen med
  // ovningen forvald. State rensas sa den inte ater-oppnas vid navigering.
  useEffect(() => {
    const name = location.state?.progressExercise
    if (name) {
      setProgressInitial(name)
      setProgressFromLink(true)
      setProgressOpen(true)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps
  const undoTimerRef = useRef(null)

  function reload() {
    getWorkouts(session.user.id, 30)
      .then(ws => {
        setWorkouts(ws)
        const names = [...new Set(ws.flatMap(w => (w.exercises ?? []).map(e => e.name)))]
        return getEquipmentMap(names)
      })
      .then(setEquipmentMap)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [session.user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch när träning avslutas eller sida blir synlig
  useEffect(() => {
    function onChanged() { reload() }
    function onVisible() { if (document.visibilityState === 'visible') reload() }
    window.addEventListener('workoutsChanged', onChanged)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('workoutsChanged', onChanged)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [session.user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Senaste PR bland laddade pass: ga kronologiskt, hall koll pa basta 1RM
  // per ovning, notera den senaste gangen ett tidigare max slogs.
  const latestPr = useMemo(() => {
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
    const chrono = [...workouts].sort((a, b) => new Date(a.started_at) - new Date(b.started_at))
    const maxByName = {}
    let pr = null
    for (const w of chrono) {
      for (const ex of w.exercises ?? []) {
        const b = best1RM(ex.sets)
        if (b <= 0) continue
        const prevMax = maxByName[ex.name]
        if (prevMax != null && b > prevMax) pr = { name: ex.name, value: b }
        if (prevMax == null || b > prevMax) maxByName[ex.name] = b
      }
    }
    return pr
  }, [workouts])

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Historik</h1>
      </header>
      <div className={styles.body}>
        {loading && (
          <div className={styles.skeletons}>
            {[1, 2, 3].map(i => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        )}

        {!loading && workouts.length === 0 && (
          <div className={styles.empty}>
            <DumbbellIcon className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>Inga pass ännu</p>
            <p className={styles.emptyText}>Dina genomförda pass dyker upp här.</p>
          </div>
        )}

        {!loading && workouts.length > 0 && (
          <div className={styles.list}>
            {/* Tydlig ingång till styrkeutveckling */}
            <button className={styles.progressCard} onClick={() => setProgressOpen(true)} type="button">
              <span className={styles.progressIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 3v16a2 2 0 0 0 2 2h16"/>
                  <path d="m7 14 3-4 3 3 4-6"/>
                </svg>
              </span>
              <span className={styles.progressText}>
                <span className={styles.progressTitle}>Min styrkeutveckling</span>
                <span className={styles.progressSub}>
                  {latestPr
                    ? `Senaste PR: ${latestPr.name} ${Math.round(displayWeight(latestPr.value, equipmentMap[latestPr.name]))} kg`
                    : 'Se hur du blir starkare över tid'}
                </span>
              </span>
              <svg className={styles.progressArrow} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {workouts.map(w => (
              <WorkoutCard
                key={w.id}
                workout={w}
                equipmentMap={equipmentMap}
                onDelete={async (id) => {
                  const deleted = workouts.find(x => x.id === id)
                  const ok = await deleteWorkout(id)
                  if (ok) {
                    setWorkouts(prev => prev.filter(x => x.id !== id))
                    window.dispatchEvent(new CustomEvent('workoutsChanged'))
                    // Angra-toast i 6 sekunder
                    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
                    setUndoState({ workout: deleted })
                    undoTimerRef.current = setTimeout(() => setUndoState(null), 6000)
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {undoState && (
        <div className={styles.undoToast}>
          <span>Pass borttaget</span>
          <button
            className={styles.undoBtn}
            type="button"
            onClick={async () => {
              if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
              const w = undoState.workout
              setUndoState(null)
              if (w && await restoreWorkout(w)) {
                setWorkouts(prev =>
                  [...prev, w].sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
                )
                window.dispatchEvent(new CustomEvent('workoutsChanged'))
              }
            }}
          >
            Ångra
          </button>
        </div>
      )}

      <ProgressView
        open={progressOpen}
        onClose={() => {
          setProgressOpen(false)
          setProgressInitial(null)
          // Kom man hit via "Se din utveckling" pa en ovning ska stangning
          // ga TILLBAKA till ovningen, inte lamna en pa historik-fliken.
          if (progressFromLink) {
            setProgressFromLink(false)
            navigate(-1)
          }
        }}
        workouts={workouts}
        equipmentMap={equipmentMap}
        userId={session.user.id}
        initialExercise={progressInitial}
        fromLink={progressFromLink}
      />
    </div>
  )
}
