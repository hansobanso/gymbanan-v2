import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getExercises } from '../lib/db'
import { BROAD_MUSCLE_GROUPS, broadOf, subGroupsOf, matchesSubGroup } from '../data/muscleGroups'
import ExercisePicker from '../components/workout/ExercisePicker'
import styles from './ExerciseLibrary.module.css'

export default function ExerciseLibrary() {
  const navigate = useNavigate()
  const [allExercises, setAllExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [muscleFilter, setMuscleFilter] = useState(null)
  const [subFilter, setSubFilter] = useState(null)
  const [search, setSearch] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const restoreScrollRef = useRef(null)

  // Aterstall sok/filter/scrollposition nar man kommer TILLBAKA fran en
  // ovnings detaljsida (sparas vid navigering dit, konsumeras har).
  useEffect(() => {
    const saved = sessionStorage.getItem('gymbanan_exlib_state')
    if (!saved) return
    sessionStorage.removeItem('gymbanan_exlib_state')
    try {
      const st = JSON.parse(saved)
      setSearch(st.search ?? '')
      setMuscleFilter(st.muscleFilter ?? null)
      setSubFilter(st.subFilter ?? null)
      restoreScrollRef.current = st.scrollY ?? 0
    } catch { /* korrupt state - ignorera */ }
  }, [])

  // Scrolla tillbaka nar listan laddats
  useEffect(() => {
    if (!loading && restoreScrollRef.current != null) {
      const y = restoreScrollRef.current
      restoreScrollRef.current = null
      requestAnimationFrame(() => window.scrollTo(0, y))
    }
  }, [loading])

  function goToExercise(id) {
    sessionStorage.setItem('gymbanan_exlib_state', JSON.stringify({
      search, muscleFilter, subFilter, scrollY: window.scrollY,
    }))
    navigate(`/exercises/${encodeURIComponent(id)}`)
  }

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
        <button className={styles.addBtn} onClick={() => setPickerOpen(true)} type="button" aria-label="Lägg till övning">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
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

      {/* Chip-filter - doljs under sokning sa traffarna syns direkt under
          sokfaltet (annars goms de bakom tangentbordet) */}
      {!search && (
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
      )}

      {/* Sub-chip-filter (visas bara nar broad-grupp med subs ar vald) */}
      {!search && muscleFilter && subGroupsOf(muscleFilter).length > 0 && (
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
              onClick={() => goToExercise(ex.id)}
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

      <ExercisePicker
        open={pickerOpen}
        startInCreate
        onClose={() => setPickerOpen(false)}
        onSelect={(ex) => {
          setPickerOpen(false)
          // Lagg till i listan direkt och ga till detaljsidan om den har ett id
          if (ex?.id) {
            setAllExercises(prev =>
              prev.some(e => e.id === ex.id) ? prev : [...prev, ex]
            )
            goToExercise(ex.id)
          }
        }}
      />
    </div>
  )
}
