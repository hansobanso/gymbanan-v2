import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getExercises } from '../lib/db'
import { BROAD_MUSCLE_GROUPS, broadOf, subGroupsOf, matchesSubGroup } from '../data/muscleGroups'
import styles from './ExerciseLibrary.module.css'

export default function ExerciseLibrary() {
  const navigate = useNavigate()
  const [allExercises, setAllExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [muscleFilter, setMuscleFilter] = useState(null)
  const [subFilter, setSubFilter] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getExercises()
      .then(d => { setAllExercises(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = allExercises.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
    if (!muscleFilter) return true
    if (broadOf(e.muscle_group) !== muscleFilter) return false
    if (subFilter && !matchesSubGroup(e.muscle_group, muscleFilter, subFilter)) return false
    return true
  })

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
          onClick={() => { setMuscleFilter(null); setSubFilter(null) }}
          type="button"
        >Alla</button>
        {BROAD_MUSCLE_GROUPS.map(mg => (
          <button
            key={mg}
            className={`${styles.chip} ${muscleFilter === mg ? styles.chipActive : ''}`}
            onClick={() => {
              setMuscleFilter(g => g === mg ? null : mg)
              setSubFilter(null)
            }}
            type="button"
          >{mg}</button>
        ))}
      </div>

      {/* Sub-chip-filter (visas bara nar broad-grupp med subs ar vald) */}
      {muscleFilter && subGroupsOf(muscleFilter).length > 0 && (
        <div className={`${styles.chips} ${styles.subChips}`}>
          <button
            className={`${styles.chip} ${styles.subChip} ${!subFilter ? styles.chipActive : ''}`}
            onClick={() => setSubFilter(null)}
            type="button"
          >Alla</button>
          {subGroupsOf(muscleFilter).map(sub => (
            <button
              key={sub}
              className={`${styles.chip} ${styles.subChip} ${subFilter === sub ? styles.chipActive : ''}`}
              onClick={() => setSubFilter(s => s === sub ? null : sub)}
              type="button"
            >{sub}</button>
          ))}
        </div>
      )}

      {/* Lista – varje rad navigerar till detaljvy */}
      <div className={styles.body}>
        <div className={styles.card}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <div className="spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-3)', fontSize: 14 }}>
              Inga övningar hittades
            </div>
          ) : filtered.map((ex, i, arr) => (
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
