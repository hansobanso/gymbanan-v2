import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getExercises } from '../lib/db'
import { MUSCLE_GROUPS } from '../data/exercises'
import styles from './ExerciseLibrary.module.css'

export default function ExerciseLibrary() {
  const navigate = useNavigate()
  const [allExercises, setAllExercises] = useState([])
  const [muscleFilter, setMuscleFilter] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getExercises().then(setAllExercises).catch(() => {})
  }, [])

  const filtered = allExercises.filter(e =>
    (!muscleFilter || e.muscle_group === muscleFilter) &&
    (!search || e.name.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className={styles.screen}>

      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/settings')} type="button" aria-label="Tillbaka">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className={styles.title}>Övningar</h1>
        <div style={{ width: 36 }} />
      </div>

      {/* Sökfält */}
      <div className={styles.searchWrap}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Sök övning..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Chip-filter */}
      <div className={styles.chips}>
        <button
          className={`${styles.chip} ${!muscleFilter ? styles.chipActive : ''}`}
          onClick={() => setMuscleFilter(null)}
          type="button"
        >Alla</button>
        {MUSCLE_GROUPS.map(mg => (
          <button
            key={mg}
            className={`${styles.chip} ${muscleFilter === mg ? styles.chipActive : ''}`}
            onClick={() => setMuscleFilter(g => g === mg ? null : mg)}
            type="button"
          >{mg}</button>
        ))}
      </div>

      {/* Lista – varje rad navigerar till detaljvy */}
      <div className={styles.body}>
        <div className={styles.card}>
          {filtered.map((ex, i, arr) => (
            <button
              key={ex.id}
              className={`${styles.exRow} ${i < arr.length - 1 ? styles.rowBorder : ''}`}
              onClick={() => navigate(`/exercises/${encodeURIComponent(ex.id)}`)}
              type="button"
            >
              <span className={styles.exName}>{ex.name}</span>
              <div className={styles.exMeta}>
                {ex.muscle_group && <span className={styles.exGroup}>{ex.muscle_group}</span>}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={styles.exChevron}>
                  <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
