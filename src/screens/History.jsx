import { useState, useEffect } from 'react'
import { getWorkouts, getEquipmentMap, deleteWorkout } from '../lib/db'
import WorkoutCard from '../components/history/WorkoutCard'
import ProgressView from '../components/history/ProgressView'
import { DumbbellIcon } from '../components/shared/Icons'
import styles from './History.module.css'

export default function History({ session }) {
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [progressOpen, setProgressOpen] = useState(false)
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
                <span className={styles.progressSub}>Se hur du blir starkare över tid</span>
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

      <ProgressView
        open={progressOpen}
        onClose={() => setProgressOpen(false)}
        workouts={workouts}
        equipmentMap={equipmentMap}
      />
    </div>
  )
}
