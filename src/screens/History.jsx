import { useState, useEffect } from 'react'
import { getWorkouts, getEquipmentMap, deleteWorkout } from '../lib/db'
import WorkoutCard from '../components/history/WorkoutCard'
import StrengthView from '../components/history/StrengthView'
import ExerciseChartSheet from '../components/history/ExerciseChartSheet'
import styles from './History.module.css'

export default function History({ session }) {
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [chartWorkout, setChartWorkout] = useState(null)
  const [chartSheetOpen, setChartSheetOpen] = useState(false)
  const [equipmentMap, setEquipmentMap] = useState({})

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

  return (
    <div className={styles.screen}>
      <div className={styles.body}>
        <button className={styles.chartBtn} onClick={() => setChartSheetOpen(true)} type="button" aria-label="Styrkegrafer">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 20H21M5 20V14M9 20V8M13 20V11M17 20V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {loading && (
          <div className={styles.skeletons}>
            {[1, 2, 3].map(i => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        )}

        {!loading && workouts.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyIcon}>🏋️</p>
            <p className={styles.emptyTitle}>Inga pass ännu</p>
            <p className={styles.emptyText}>Dina genomförda pass dyker upp här.</p>
          </div>
        )}

        {!loading && workouts.length > 0 && (
          <div className={styles.list}>
            {workouts.map(w => (
              <WorkoutCard
                key={w.id}
                workout={w}
                equipmentMap={equipmentMap}
                onShowCharts={() => setChartWorkout(w)}
                onDelete={async (id) => {
                  const ok = await deleteWorkout(id)
                  if (ok) {
                    setWorkouts(prev => prev.filter(x => x.id !== id))
                    window.dispatchEvent(new CustomEvent('workoutsChanged'))
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      <StrengthView
        workout={chartWorkout}
        allWorkouts={workouts}
        equipmentMap={equipmentMap}
        open={chartWorkout !== null}
        onClose={() => setChartWorkout(null)}
      />

      <ExerciseChartSheet
        open={chartSheetOpen}
        onClose={() => setChartSheetOpen(false)}
        userId={session.user.id}
        workouts={workouts}
        equipmentMap={equipmentMap}
      />
    </div>
  )
}
