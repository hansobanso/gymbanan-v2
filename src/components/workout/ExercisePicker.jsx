import { useState, useEffect, useRef, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getExercises, saveExercise, getProfile, getWorkouts } from '../../lib/db'
import { supabase } from '../../lib/supabase'
import { MUSCLE_GROUPS, BROAD_MUSCLE_GROUPS, EQUIPMENT_OPTIONS, MOVEMENT_OPTIONS, broadOf, subGroupsOf, matchesSubGroup } from '../../data/muscleGroups'
import MuscleMap from '../shared/MuscleMap'
import { colorForIntensityRed } from '../../lib/muscleColor'
import { exWord } from '../../lib/plural'
import styles from './ExercisePicker.module.css'

// Sa manga av anvandarens senast korda ovningar visas overst
const MAX_RECENT = 6
// Nya ovningar i ett pass far tre arbetsset (samma som passbyggaren)
const DEFAULT_SETS = 3

/**
 * Valj ovning. Nar man lagger till (inte byter) kan flera bockas i pa en
 * gang. sessionExercises = passets nuvarande ovningar [{name, workSets}]:
 * de markeras "I passet" och later muskelgubben visa vad passet tacker.
 */
export default function ExercisePicker({ open, onSelect, onClose, replacingExercise = null, startInCreate = false, sessionExercises = null }) {
  const multi = !replacingExercise && !startInCreate
  const [picked, setPicked] = useState([]) // valda ovningar, i den ordning de bockades i
  const [equipment, setEquipment] = useState(null)
  const [showEquipment, setShowEquipment] = useState(false)
  const [lastDone, setLastDone] = useState({}) // ovningsnamn -> senast kord (ms)
  const [allExercises, setAllExercises] = useState([])
  const [query, setQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedSub, setSelectedSub] = useState(null)
  const [createMode, setCreateMode] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createMuscle, setCreateMuscle] = useState('')
  const [createSecondary, setCreateSecondary] = useState([])
  const [createEquipment, setCreateEquipment] = useState('')
  const [createMovement, setCreateMovement] = useState('')
  const [createInstructions, setCreateInstructions] = useState('')
  const [createRest, setCreateRest] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState(null)
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
      setPicked([])
      setEquipment(null)
      setShowEquipment(false)
      setQuery('')
      setSelectedGroup(null)
      setSelectedSub(null)
      setCreateMode(false)
      setCreateName('')
      setCreateMuscle('')
      setCreateSecondary([])
      setCreateEquipment('')
      setCreateMovement('')
      setCreateInstructions('')
      setCreateRest('')
      return
    }
    getExercises().then(setAllExercises).catch(() => {})
    // Hamta admin-status sa vi vet om nya ovningar ska bli globala
    // getSession laser lokalt (inget natverksanrop), sa listan fylls direkt
    supabase.auth.getSession().then(({ data }) => {
      const uid = data?.session?.user?.id
      if (!uid) return
      getProfile(uid).then(p => setIsAdmin(!!p?.is_admin)).catch(() => {})
      // "Dina vanliga": nar varje ovning senast kordes (samma cache som startsidan)
      getWorkouts(uid, 40).then(ws => {
        const map = {}
        for (const w of ws ?? []) {
          const at = new Date(w.finished_at ?? w.started_at).getTime()
          if (!at) continue
          for (const ex of w.exercises ?? []) {
            if (!ex.sets?.some(st => st.done)) continue
            if (!map[ex.name] || at > map[ex.name]) map[ex.name] = at
          }
        }
        setLastDone(map)
      }).catch(() => {})
    })
    // Oppna direkt i skapa-laget om den som oppnade vill det (t.ex. + i
    // ovningsbiblioteket - man vill skapa, inte valja).
    if (startInCreate) {
      setCreateMode(true)
    } else {
      setTimeout(() => searchRef.current?.focus(), 100)
    }
  }, [open, startInCreate])

  // Oppna skapa-laget. Forifyll namnet fran sokrutan om man sokt pa nat.
  function openCreate() {
    setCreateName(query.trim())
    setCreateMuscle('')
    setCreateSecondary([])
    setCreateEquipment('')
    setCreateMovement('')
    setCreateInstructions('')
    setCreateRest('')
    setCreateMode(true)
  }

  function toggleSecondary(mg) {
    setCreateSecondary(prev =>
      prev.includes(mg) ? prev.filter(m => m !== mg) : (prev.length < 7 ? [...prev, mg] : prev)
    )
  }

  async function handleCreate() {
    const name = createName.trim()
    if (!name || !createMuscle || saving) return
    setSaving(true)
    setCreateError(null)
    try {
      const base = {
        name,
        muscle_group: createMuscle,
        secondary_muscles: createSecondary,
        equipment: createEquipment || null,
        movement_pattern: createMovement || null,
        instructions: createInstructions.trim() || null,
        default_rest: createRest ? parseInt(createRest) : null,
      }
      // Admin -> global ovning (for alla). Annars personlig (kraver user_id).
      let payload = base
      if (isAdmin) {
        payload = { ...base, is_global: true, user_id: null }
      } else {
        const { data: u } = await supabase.auth.getUser()
        payload = { ...base, user_id: u?.user?.id, created_by: u?.user?.id }
      }
      const ex = await saveExercise(payload)
      if (!ex?.name) throw new Error('Övningen kunde inte sparas')
      setAllExercises(prev => [...prev, ex])
      // Redan ibockade ovningar foljer med nar man skapar en ny
      picked.forEach(p => onSelect(p))
      onSelect(ex)
      onClose()
    } catch (err) {
      setCreateError(err?.message || 'Något gick fel. Övningen sparades inte. Försök igen.')
    }
    setSaving(false)
  }

  // Filtrera pa fritext + muskelgrupp-chip + ev. sub-chip.
  const filtered = allExercises.filter(e => {
    const matchQuery = !query.trim() || e.name.toLowerCase().includes(query.toLowerCase())
    let matchGroup
    if (selectedGroup === 'Kardio') {
      matchGroup = e.is_cardio === true
    } else if (e.is_cardio) {
      matchGroup = false  // kardio bara under Kardio-filtret (om ej sokning)
    } else {
      matchGroup = !selectedGroup || broadOf(e.muscle_group) === selectedGroup
      if (matchGroup && selectedSub && selectedGroup) {
        matchGroup = matchesSubGroup(e.muscle_group, selectedGroup, selectedSub)
      }
    }
    const matchEquipment = !equipment || e.equipment === equipment
    // Vid fritextsokning: visa aven kardio bland traffarna
    if (query.trim()) return matchQuery && matchEquipment
    return matchQuery && matchGroup && matchEquipment
  })

  const inSession = new Set((sessionExercises ?? []).map(e => e.name))
  const isPicked = ex => picked.some(p => p.name === ex.name)

  function choose(ex) {
    if (!multi) { onSelect(ex); onClose(); return }
    if (inSession.has(ex.name)) return
    setPicked(prev => prev.some(p => p.name === ex.name) ? prev.filter(p => p.name !== ex.name) : [...prev, ex])
  }

  function confirmPicked() {
    picked.forEach(ex => onSelect(ex))
    onClose()
  }

  // Dina vanliga: ovningar du kort, senaste forst. Inte under sokning.
  const recent = query.trim() ? [] : filtered
    .filter(e => lastDone[e.name] && !(multi && inSession.has(e.name)))
    .sort((a, b) => lastDone[b.name] - lastDone[a.name])
    .slice(0, MAX_RECENT)
  const recentIds = new Set(recent.map(e => e.id))

  // Muskelgubben: passet som det ser ut med det som ar ibockat
  const infoByName = useMemo(() => {
    const m = {}
    for (const e of allExercises) m[e.name] = e
    return m
  }, [allExercises])
  const coverage = multi && sessionExercises ? [{
    finished_at: null,
    exercises: [
      ...sessionExercises.map(e => ({ name: e.name, n: Number(e.workSets) || 0 })),
      ...picked.map(e => ({ name: e.name, n: DEFAULT_SETS })),
    ].filter(e => !infoByName[e.name]?.is_cardio)
      .map(e => ({ name: e.name, sets: Array.from({ length: e.n }, () => ({ type: 'work', done: true })) })),
  }] : null
  const coverageSets = {}
  for (const e of coverage?.[0].exercises ?? []) {
    const g = broadOf(infoByName[e.name]?.muscle_group)
    if (g && g !== 'Övrigt') coverageSets[g] = (coverageSets[g] ?? 0) + e.sets.length
  }
  const coverageLine = Object.entries(coverageSets).sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} ${n}`).join(' · ')

  const renderItem = ex => {
    const on = isPicked(ex)
    const there = multi && inSession.has(ex.name)
    return (
      <button
        key={ex.id}
        className={`${styles.item} ${on ? styles.itemPicked : ''} ${there ? styles.itemThere : ''}`}
        onClick={() => choose(ex)}
        disabled={there}
        aria-pressed={multi ? on : undefined}
        type="button"
      >
        <span className={styles.itemName}>{ex.name}</span>
        <span className={styles.itemMeta}>{there ? 'I passet' : ex.equipment ?? ''}</span>
        {multi && !there && (
          <span className={`${styles.check} ${on ? styles.checkOn : ''}`} aria-hidden="true">
            {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
          </span>
        )}
      </button>
    )
  }

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

  const similarIds = new Set([...similar.map(e => e.id), ...recentIds])

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
                  {createMode ? 'Skapa övning' : (replacingMeta ? 'Byt övning' : multi ? 'Välj övningar' : 'Välj övning')}
                </span>
                {replacingMeta && !createMode && (
                  <span className={styles.subtitle}>Ersätter {replacingMeta.name}</span>
                )}
              </div>
              <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Stäng">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {!createMode && (
            <>
            <div className={styles.searchRow}>
            <div className={styles.searchWrap}>
              <input
                ref={searchRef}
                className={styles.search}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Sök övning…"
              />
              {query && (
                <button
                  className={styles.searchClear}
                  onClick={() => { setQuery(''); searchRef.current?.focus() }}
                  type="button"
                  aria-label="Rensa sökning"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              )}
            </div>
              <button
                className={`${styles.filterBtn} ${equipment ? styles.filterBtnOn : ''}`}
                onClick={() => setShowEquipment(v => !v)}
                type="button"
                aria-label={equipment ? `Utrustning: ${equipment}` : 'Filtrera på utrustning'}
                aria-expanded={showEquipment}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4"/></svg>
              </button>
            </div>
            {showEquipment && (
              <div className={`${styles.chips} ${styles.subChips}`}>
                <button className={`${styles.chip} ${styles.subChip} ${!equipment ? styles.chipActive : ''}`} onClick={() => setEquipment(null)} type="button">All utrustning</button>
                {EQUIPMENT_OPTIONS.map(eq => (
                  <button key={eq} className={`${styles.chip} ${styles.subChip} ${equipment === eq ? styles.chipActive : ''}`} onClick={() => setEquipment(e => e === eq ? null : eq)} type="button">{eq}</button>
                ))}
              </div>
            )}
            {/* Chips doljs under sokning sa traffarna syns direkt under
                sokfaltet istallet for bakom tangentbordet */}
            {!query.trim() && (
            <div className={styles.chips}>
              <button
                className={`${styles.chip} ${!selectedGroup ? styles.chipActive : ''}`}
                onClick={() => { setSelectedGroup(null); setSelectedSub(null) }}
                type="button"
              >
                Alla
              </button>
              {BROAD_MUSCLE_GROUPS.map(mg => (
                <button
                  key={mg}
                  className={`${styles.chip} ${selectedGroup === mg ? styles.chipActive : ''}`}
                  onClick={() => {
                    setSelectedGroup(g => g === mg ? null : mg)
                    setSelectedSub(null)
                  }}
                  type="button"
                >
                  {mg}
                </button>
              ))}
              {allExercises.some(e => e.is_cardio) && (
                <button
                  className={`${styles.chip} ${selectedGroup === 'Kardio' ? styles.chipActive : ''}`}
                  onClick={() => { setSelectedGroup(g => g === 'Kardio' ? null : 'Kardio'); setSelectedSub(null) }}
                  type="button"
                >
                  Kardio
                </button>
              )}
            </div>
            )}
            {!query.trim() && selectedGroup && subGroupsOf(selectedGroup).length > 0 && (
              <div className={`${styles.chips} ${styles.subChips}`}>
                <button
                  className={`${styles.chip} ${styles.subChip} ${!selectedSub ? styles.chipActive : ''}`}
                  onClick={() => setSelectedSub(null)}
                  type="button"
                >
                  Alla
                </button>
                {subGroupsOf(selectedGroup).map(sub => (
                  <button
                    key={sub}
                    className={`${styles.chip} ${styles.subChip} ${selectedSub === sub ? styles.chipActive : ''}`}
                    onClick={() => setSelectedSub(s => s === sub ? null : sub)}
                    type="button"
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}
            </>
            )}
            <div className={styles.list}>
              {createMode ? (
                <div className={styles.createWrap}>
                  <label className={styles.createFieldLabel}>Namn</label>
                  <input
                    className={styles.createNameInput}
                    value={createName}
                    onChange={e => setCreateName(e.target.value)}
                    placeholder="Övningens namn"
                  />

                  <label className={styles.createFieldLabel}>Primär muskel</label>
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

                  <label className={styles.createFieldLabel}>Sekundära muskler <span className={styles.createHint}>(valfritt, max 7{createSecondary.length > 0 ? ` · ${createSecondary.length} vald${createSecondary.length > 1 ? 'a' : ''}` : ''})</span></label>
                  <div className={styles.muscleGrid}>
                    {MUSCLE_GROUPS.filter(mg => mg !== createMuscle).map(mg => (
                      <button
                        key={mg}
                        className={`${styles.muscleBtn} ${createSecondary.includes(mg) ? styles.muscleBtnSecondary : ''}`}
                        onClick={() => toggleSecondary(mg)}
                        type="button"
                      >
                        {mg}
                      </button>
                    ))}
                  </div>

                  <label className={styles.createFieldLabel}>Utrustning <span className={styles.createHint}>(valfritt)</span></label>
                  <div className={styles.muscleGrid}>
                    {EQUIPMENT_OPTIONS.map(eq => (
                      <button
                        key={eq}
                        className={`${styles.muscleBtn} ${createEquipment === eq ? styles.muscleBtnActive : ''}`}
                        onClick={() => setCreateEquipment(e => e === eq ? '' : eq)}
                        type="button"
                      >
                        {eq}
                      </button>
                    ))}
                  </div>

                  <label className={styles.createFieldLabel}>Rörelsemönster <span className={styles.createHint}>(valfritt)</span></label>
                  <div className={styles.muscleGrid}>
                    {MOVEMENT_OPTIONS.map(mv => (
                      <button
                        key={mv}
                        className={`${styles.muscleBtn} ${createMovement === mv ? styles.muscleBtnActive : ''}`}
                        onClick={() => setCreateMovement(m => m === mv ? '' : mv)}
                        type="button"
                      >
                        {mv}
                      </button>
                    ))}
                  </div>

                  <label className={styles.createFieldLabel}>Vilotid <span className={styles.createHint}>(valfritt, sekunder)</span></label>
                  <input
                    className={styles.createNameInput}
                    type="number"
                    inputMode="numeric"
                    value={createRest}
                    onChange={e => setCreateRest(e.target.value)}
                    placeholder="t.ex. 120"
                  />

                  <label className={styles.createFieldLabel}>Instruktioner <span className={styles.createHint}>(valfritt)</span></label>
                  <textarea
                    className={styles.createTextarea}
                    value={createInstructions}
                    onChange={e => setCreateInstructions(e.target.value)}
                    placeholder="Kort beskrivning av hur övningen utförs…"
                    rows={3}
                  />

                  {isAdmin && (
                    <p className={styles.createGlobalNote}>Skapas som global övning (för alla)</p>
                  )}
                  {createError && (
                    <p className={styles.createError}>{createError}</p>
                  )}
                  <button
                    className={styles.confirmBtn}
                    onClick={handleCreate}
                    disabled={saving || !createName.trim() || !createMuscle}
                    type="button"
                  >
                    {saving ? 'Sparar…' : 'Skapa övning'}
                  </button>
                  <button className={styles.cancelLink} onClick={() => startInCreate ? onClose() : setCreateMode(false)} type="button">
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
                        onClick={openCreate}
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
                          {similar.sort((a, b) => a.name.localeCompare(b.name, 'sv')).map(renderItem)}
                        </div>
                      )}

                      {coverage && (
                        <div className={styles.coverage}>
                          <MuscleMap workouts={coverage} exerciseMap={infoByName} colorFn={colorForIntensityRed} sensitivity={6} size={76} />
                          <div className={styles.coverageText}>
                            <span className={styles.coverageLabel}>{picked.length ? 'Passet med dina val' : 'Passet hittills'}</span>
                            <span className={styles.coverageLine}>{coverageLine ? `Set: ${coverageLine}` : 'Inga övningar än'}</span>
                          </div>
                        </div>
                      )}

                      {recent.length > 0 && (
                        <div>
                          <div className={styles.groupHeader}>Dina vanliga</div>
                          {recent.map(renderItem)}
                        </div>
                      )}

                      {/* Resten - grupperat per muskelgrupp */}
                      {Object.entries(groupedRest)
                        .sort(([a], [b]) => a.localeCompare(b, 'sv'))
                        .map(([group, exs]) => (
                          <div key={group}>
                            <div className={styles.groupHeader}>{group}</div>
                            {exs.sort((a, b) => a.name.localeCompare(b.name, 'sv')).map(renderItem)}
                          </div>
                        ))}

                      {/* Alltid nabar: skapa en helt ny ovning */}
                      <button
                        className={styles.createNewBtn}
                        onClick={openCreate}
                        type="button"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 5v14M5 12h14"/>
                        </svg>
                        Skapa ny övning
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
            {multi && !createMode && picked.length > 0 && (
              <div className={styles.pickBar}>
                <button className={styles.pickBtn} onClick={confirmPicked} type="button">
                  Lägg till {picked.length} {exWord(picked.length)}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
