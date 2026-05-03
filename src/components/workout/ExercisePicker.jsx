import { useState, useEffect, useRef, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getExercises, saveExercise } from '../../lib/db'
import { MUSCLE_GROUPS } from '../../data/exercises'
import styles from './ExercisePicker.module.css'

export default function ExercisePicker({ open, onSelect, onClose, replacingExercise = null }) {
  const [allExercises, setAllExercises] = useState([])
  const [query, setQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [createMode, setCreateMode] = useState(false)
  const [createMuscle, setCreateMuscle] = useState('')
  const [saving, setSaving] = useState(false)
  const searchRef = useRef(null)

  // Slap upp metadata for ovningen som ersatts (om vi byter ut, inte lagger till).
  // Vi laser direkt fran exercise-objektet om det finns dar (db-rad), annars
  // letar vi i allExercises pa namn (om det bara ar en stang i sessionen).
  const replacingMeta = useMemo(() => {
    if (!replacingExercise) return null
    const direct = {
      name: replacingExercise.name,
      muscle_group: replacingExercise.muscle_group,
      movement_pattern: replacingExercise.movement_pattern,
    }
    if (direct.muscle_group || direct.movement_pattern) return direct
    const found = allExercises.find(e => e.name === replacingExercise.name)
    return found ? {
      name: replacingExercise.name,
      muscle_group: found.muscle_group,
      movement_pattern: found.movement_pattern,
    } : direct
  }, [replacingExercise, allExercises])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setSelectedGroup(null)
      setCreateMode(false)
      setCreateMuscle('')
      return
    }
    getExercises().then(setAllExercises).catch(() => {})
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [open])

  async function handleCreate() {
    if (!query.trim() || saving) return
    setSaving(true)
    try {
      const ex = await saveExercise({ name: query.trim(), muscle_group: createMuscle || null })
      setAllExercises(prev => [...prev, ex])
      onSelect(ex)
      onClose()
    } catch { /* ignored */ }
    setSaving(false)
  }

  // Filtrera pa fritext + muskelgrupp-chip.
  const filtered = allExercises.filter(e => {
    const matchQuery = !query.trim() || e.name.toLowerCase().includes(query.toLowerCase())
    const matchGroup = !selectedGroup || e.muscle_group === selectedGroup
    return matchQuery && matchGroup
  })

  const noResults = query.trim() && filtered.length === 0

  // Berakna "Liknande ovningar" - samma muskelgrupp + rorelsemonster
  // som den ersatts. Visas bara nar:
  // - vi byter ut en ovning (inte lagger till)
  // - inget chip-filter ar valt (annars filtrerar anvandaren medvetet)
  // - inget aktivt sokord
  // - vi har metadata pa ovningen som ersatts
  const showSimilar = !!replacingMeta
    && !!replacingMeta.muscle_group
    && !selectedGroup
    && !query.trim()

  const similar = showSimilar
    ? filtered.filter(e =>
        e.name !== replacingMeta.name
        && e.muscle_group === replacingMeta.muscle_group
        && (!replacingMeta.movement_pattern || e.movement_pattern === replacingMeta.movement_pattern)
      )
    : []

  const similarIds = new Set(similar.map(e => e.id))

  // Resten grupperas per muskelgrupp som forr (men exkludera de som redan
  // visas under "Liknande" sa de inte dubbleras).
  const groupedRest = filtered
    .filter(e => !similarIds.has(e.id))
    .reduce((acc, ex) => {
      const g = ex.muscle_group || 'Övrigt'
      if (!acc[g]) acc[g] = []
      acc[g].push(ex)
      return acc
    }, {})

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={styles.sheet}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className={styles.handle} />
            <div className={styles.header}>
              <div className={styles.headerText}>
                <span className={styles.title}>
                  {replacingMeta ? 'Byt övning' : 'Välj övning'}
                </span>
                {replacingMeta && (
                  <span className={styles.subtitle}>Ersätter {replacingMeta.name}</span>
                )}
              </div>
              <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Stäng">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className={styles.searchWrap}>
              <input
                ref={searchRef}
                className={styles.search}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Sök övning…"
              />
            </div>
            <div className={styles.chips}>
              <button
                className={`${styles.chip} ${!selectedGroup ? styles.chipActive : ''}`}
                onClick={() => setSelectedGroup(null)}
                type="button"
              >
                Alla
              </button>
              {MUSCLE_GROUPS.map(mg => (
                <button
                  key={mg}
                  className={`${styles.chip} ${selectedGroup === mg ? styles.chipActive : ''}`}
                  onClick={() => setSelectedGroup(g => g === mg ? null : mg)}
                  type="button"
                >
                  {mg}
                </button>
              ))}
            </div>
            <div className={styles.list}>
              {createMode ? (
                <div className={styles.createWrap}>
                  <p className={styles.createLabel}>Muskelgrupp för <strong>{query.trim()}</strong></p>
                  <div className={styles.muscleGrid}>
                    {MUSCLE_GROUPS.map(mg => (
                      <button
                        key={mg}
                        className={`${styles.muscleBtn} ${createMuscle === mg ? styles.muscleBtnActive : ''}`}
                        onClick={() => setCreateMuscle(mg)}
                        type="button"
                      >
                        {mg}
                      </button>
                    ))}
                  </div>
                  <button
                    className={styles.confirmBtn}
                    onClick={handleCreate}
                    disabled={saving}
                    type="button"
                  >
                    {saving ? 'Sparar…' : 'Skapa övning'}
                  </button>
                  <button className={styles.cancelLink} onClick={() => setCreateMode(false)} type="button">
                    Avbryt
                  </button>
                </div>
              ) : (
                <>
                  {noResults ? (
                    <div className={styles.noResultsWrap}>
                      <p className={styles.empty}>Ingen träff</p>
                      <button
                        className={styles.createPrompt}
                        onClick={() => setCreateMode(true)}
                        type="button"
                      >
                        + Skapa &quot;{query.trim()}&quot;
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Liknande ovningar (samma muskelgrupp + rorelsemonster) */}
                      {similar.length > 0 && (
                        <div>
                          <div className={`${styles.groupHeader} ${styles.groupHeaderSimilar}`}>
                            Liknande övningar
                          </div>
                          {similar
                            .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
                            .map(ex => (
                              <button
                                key={ex.id}
                                className={styles.item}
                                onClick={() => { onSelect(ex); onClose() }}
                                type="button"
                              >
                                {ex.name}
                              </button>
                            ))}
                        </div>
                      )}

                      {/* Resten - grupperat per muskelgrupp */}
                      {Object.entries(groupedRest)
                        .sort(([a], [b]) => a.localeCompare(b, 'sv'))
                        .map(([group, exs]) => (
                          <div key={group}>
                            <div className={styles.groupHeader}>{group}</div>
                            {exs.sort((a, b) => a.name.localeCompare(b.name, 'sv')).map(ex => (
                              <button
                                key={ex.id}
                                className={styles.item}
                                onClick={() => { onSelect(ex); onClose() }}
                                type="button"
                              >
                                {ex.name}
                              </button>
                            ))}
                          </div>
                        ))}
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
