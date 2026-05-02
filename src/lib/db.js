import { supabase } from './supabase'
import { EXERCISES } from '../data/exercises'

// Fallback when Supabase is unreachable
const BUILTIN_FALLBACK = Object.entries(EXERCISES).map(([name, data]) => ({
  id: '__builtin__' + name,
  name,
  muscle_group: data.muscle_group ?? 'Övrigt',
  secondary_muscle: data.secondary_muscle ?? null,
  user_id: null,
  is_global: true,
}))

// ── Simple in-memory cache (TTL: 60s) ─────────────────────
const _cache = new Map()
function cacheGet(key) {
  const entry = _cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > 60_000) { _cache.delete(key); return null }
  return entry.data
}
function cacheSet(key, data) { _cache.set(key, { data, ts: Date.now() }) }
export function cacheInvalidate(prefix) {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key)
  }
}

// ── Programs ──────────────────────────────────────────────
export async function getPrograms(userId) {
  let query = supabase.from('programs').select('*').order('name')
  if (userId) {
    query = query.or(`is_global.eq.true,user_id.eq.${userId}`)
  }
  const { data, error } = await query
  if (error) return []
  return data ?? []
}

export async function saveProgram(program) {
  const { data, error } = await supabase
    .from('programs')
    .insert(program)
    .select()
    .single()
  if (error) return []
  return data
}

export async function updateProgram(id, updates) {
  const { _id, _isNew, created_by, user_id, ...rest } = updates
  const { data, error } = await supabase
    .from('programs')
    .update(rest)
    .eq('id', id)
    .select()
    .single()
  if (error) return []
  return data
}

export async function deleteProgram(id) {
  const { error } = await supabase.from('programs').delete().eq('id', id)
  if (error) return []
}

// ── Exercises ─────────────────────────────────────────────
// Returns user's own exercises + global exercises, deduplicated:
// if the user has their own version of a global exercise, user's wins.
// Falls back to EXERCISES from exercises.js if Supabase is unreachable.
export async function getExercises() {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('name')
  if (error) return BUILTIN_FALLBACK
  const all = data ?? []
  // Separate owned vs global
  const owned = all.filter(e => e.user_id !== null)
  const global = all.filter(e => e.user_id === null)
  const ownedNames = new Set(owned.map(e => e.name))
  // User's own exercise shadows the global one with the same name
  const merged = [...owned, ...global.filter(e => !ownedNames.has(e.name))]
  return merged.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
}

// Copy a global exercise for the current user so they can customise it
export async function copyExerciseForUser(exercise, userId) {
  const { id: _id, user_id: _uid, is_global: _ig, created_by: _cb, ...fields } = exercise
  const { data, error } = await supabase
    .from('exercises')
    .insert({ ...fields, user_id: userId, created_by: userId, is_global: false })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function saveExercise(exercise) {
  const { data, error } = await supabase
    .from('exercises')
    .insert(exercise)
    .select()
    .single()
  if (error) return []
  return data
}

export async function updateExercise(id, updates) {
  const { data, error } = await supabase
    .from('exercises')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return []
  return data
}

export async function deleteExercise(id) {
  const { error } = await supabase
    .from('exercises')
    .delete()
    .eq('id', id)
  if (error) return []
}

export async function getExerciseByName(name) {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('name', name)
    .maybeSingle()
  if (error) return null
  return data
}

// Insert or update a user's exercise entry (used for editing builtins).
// If a row with this name already exists for this user, update it.
// Otherwise insert a new row.
export async function upsertExerciseByName(name, fields, userId) {
  const { data: existing } = await supabase
    .from('exercises')
    .select('id')
    .eq('name', name)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing?.id) {
    return updateExercise(existing.id, fields)
  }
  return saveExercise({ name, user_id: userId, created_by: userId, ...fields })
}

// Update notes for a specific exercise within a program session.
export async function updateProgramExerciseNotes(programId, sessionName, exerciseName, notes) {
  if (!programId) return
  const { data: prog, error } = await supabase
    .from('programs')
    .select('sessions')
    .eq('id', programId)
    .single()
  if (error || !prog) return

  const sessions = (prog.sessions ?? []).map(session => {
    if (session.name !== sessionName) return session
    return {
      ...session,
      exercises: (session.exercises ?? []).map(ex =>
        ex.name !== exerciseName ? ex : { ...ex, notes: notes || null }
      ),
    }
  })
  await supabase.from('programs').update({ sessions }).eq('id', programId)
}

// ── Workouts ──────────────────────────────────────────────
export async function getWorkouts(userId, limit = 20) {
  const key = `workouts:${userId}:${limit}`
  const cached = cacheGet(key)
  if (cached) return cached
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(limit)
  if (error) return []
  const result = data ?? []
  cacheSet(key, result)
  return result
}

// Workouts från och med senaste måndag (veckostart)
export async function getWeeklyWorkouts(userId) {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=sön, 1=mån, …
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysFromMonday)
  monday.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('workouts')
    .select('exercises, finished_at, session_name')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .gte('finished_at', monday.toISOString())
  if (error) return []
  return data ?? []
}

export async function createWorkout(workout) {
  const { data, error } = await supabase
    .from('workouts')
    .insert(workout)
    .select()
    .single()
  if (error) return []
  return data
}

export async function deleteWorkout(id) {
  const { error } = await supabase.from('workouts').delete().eq('id', id)
  if (!error) cacheInvalidate('workouts:')
  return !error
}

export async function updateWorkout(id, updates) {
  const { data, error } = await supabase
    .from('workouts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return []
  // Invalidate workout cache so History/Home reload fresh data
  if (updates.finished_at) cacheInvalidate('workouts:')
  return data
}

// Returns the work sets from the most recent completed workout containing this exercise
export async function getPreviousSetsForExercise(userId, exerciseName) {
  const { data, error } = await supabase
    .from('workouts')
    .select('exercises, adjusted')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(15)
  if (error || !data) return null
  // Hoppa över anpassade pass (sjukpass, deload, manuell PT-justering) -
  // de representerar inte användarens normala progression.
  for (const workout of data) {
    if (workout.adjusted) continue
    const ex = (workout.exercises ?? []).find(e => e.name === exerciseName)
    if (!ex) continue
    const allSets = (ex.sets ?? []).filter(s => s.done && (s.weight !== undefined && s.weight !== null))
    if (allSets.length > 0) return allSets
  }
  // Fallback: om INGA icke-anpassade pass finns, ta första bästa - hellre någon
  // data än ingen alls.
  for (const workout of data) {
    const ex = (workout.exercises ?? []).find(e => e.name === exerciseName)
    if (!ex) continue
    const allSets = (ex.sets ?? []).filter(s => s.done && (s.weight !== undefined && s.weight !== null))
    if (allSets.length > 0) return allSets
  }
  return null
}

// Returnerar de tva senaste passens sets for en ovning.
// Anvands av progressionsmotorn for "under repMin 2 pass i rad"-flagga.
export async function getTwoPreviousSetsForExercise(userId, exerciseName) {
  const { data, error } = await supabase
    .from('workouts')
    .select('exercises, adjusted')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(20)
  if (error || !data) return { prev: null, prevPrev: null }

  const found = []
  for (const workout of data) {
    if (workout.adjusted) continue
    const ex = (workout.exercises ?? []).find(e => e.name === exerciseName)
    if (!ex) continue
    const allSets = (ex.sets ?? []).filter(s => s.done && (s.weight !== undefined && s.weight !== null))
    if (allSets.length > 0) {
      found.push(allSets)
      if (found.length >= 2) break
    }
  }
  return { prev: found[0] ?? null, prevPrev: found[1] ?? null }
}

// Returns { exerciseName: equipment } for a list of names
export async function getEquipmentMap(exerciseNames) {
  if (!exerciseNames?.length) return {}
  const { data } = await supabase
    .from('exercises')
    .select('name, equipment')
    .in('name', exerciseNames)
  const map = {}
  for (const ex of data ?? []) {
    if (ex.equipment) map[ex.name] = ex.equipment
  }
  return map
}

// ── User Settings ─────────────────────────────────────────
export async function getActiveProgram(userId, programs) {
  const { data } = await supabase
    .from('profiles')
    .select('active_program_id')
    .eq('id', userId)
    .single()
  const match = programs.find(p => p.id === data?.active_program_id)
  return match ?? programs[0] ?? null
}

export async function setActiveProgram(userId, programId) {
  const { error } = await supabase
    .from('profiles')
    .update({ active_program_id: programId })
    .eq('id', userId)
}

// ── Deload week ────────────────────────────────────────
// Returns { deloadUntil, deloadStartedAt, isActive, daysLeft } or null
export async function getDeloadStatus(userId) {
  const { data } = await supabase
    .from('user_settings')
    .select('deload_until, deload_started_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data?.deload_until) return { deloadUntil: null, deloadStartedAt: null, isActive: false, daysLeft: 0 }
  const until = new Date(data.deload_until)
  const now = new Date()
  const isActive = until > now
  const daysLeft = isActive ? Math.ceil((until - now) / (1000 * 60 * 60 * 24)) : 0
  return {
    deloadUntil: data.deload_until,
    deloadStartedAt: data.deload_started_at,
    isActive,
    daysLeft,
  }
}

// Starta en deload-vecka. days = antal dagar (default 7).
export async function startDeloadWeek(userId, days = 7) {
  const now = new Date()
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  const { data: existing } = await supabase
    .from('user_settings')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) {
    const { error } = await supabase
      .from('user_settings')
      .update({
        deload_until: until.toISOString(),
        deload_started_at: now.toISOString(),
      })
      .eq('user_id', userId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('user_settings')
      .insert({
        user_id: userId,
        deload_until: until.toISOString(),
        deload_started_at: now.toISOString(),
      })
    if (error) throw error
  }
  return { deloadUntil: until.toISOString(), daysLeft: days }
}

// Avsluta deload-veckan i förtid
export async function endDeloadWeek(userId) {
  const { error } = await supabase
    .from('user_settings')
    .update({ deload_until: null, deload_started_at: null })
    .eq('user_id', userId)
  if (error) throw error
}

// ── Rest Overrides ────────────────────────────────────────
// Returns { exerciseName: restSeconds } map for the user
export async function getRestOverrides(userId) {
  const { data } = await supabase
    .from('user_rest_overrides')
    .select('exercise_name, rest_seconds')
    .eq('user_id', userId)
  const map = {}
  for (const row of data ?? []) map[row.exercise_name] = row.rest_seconds
  return map
}

export async function upsertRestOverride(userId, exerciseName, restSeconds) {
  const { data, error } = await supabase
    .from('user_rest_overrides')
    .upsert(
      { user_id: userId, exercise_name: exerciseName, rest_seconds: restSeconds },
      { onConflict: 'user_id,exercise_name' }
    )
    .select()
    .single()
  if (error) return null
  return data
}

export async function deleteRestOverride(userId, exerciseName) {
  await supabase
    .from('user_rest_overrides')
    .delete()
    .eq('user_id', userId)
    .eq('exercise_name', exerciseName)
}

// ── Body Weight ───────────────────────────────────────────
export async function logBodyWeight(userId, weight) {
  const { data, error } = await supabase
    .from('body_weight')
    .insert({ user_id: userId, weight, logged_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getBodyWeights(userId, limit = 20) {
  const { data, error } = await supabase
    .from('body_weight')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return data ?? []
}

// ── AI Memory ─────────────────────────────────────────────
export async function getAiMemory(userId) {
  const { data, error } = await supabase
    .from('ai_memory')
    .select('content')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return null
  return data
}

export async function upsertAiMemory(userId, content) {
  await supabase
    .from('ai_memory')
    .upsert({ user_id: userId, content, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
}

// ── AI Conversations ───────────────────────────────────────
export async function createConversation({ userId, context }) {
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ user_id: userId, context, messages: [] })
    .select()
    .single()
  if (error) return []
  return data
}

export async function appendMessage(conversationId, message) {
  // Hämta befintliga meddelanden och lägg till nytt
  const { data: conv, error: fetchErr } = await supabase
    .from('ai_conversations')
    .select('messages')
    .eq('id', conversationId)
    .single()
  if (fetchErr) throw fetchErr

  const messages = [...(conv.messages ?? []), message]
  const { data, error } = await supabase
    .from('ai_conversations')
    .update({ messages })
    .eq('id', conversationId)
    .select()
    .single()
  if (error) return []
  return data
}

export async function getConversations(userId, limit = 20) {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return data ?? []
}

// ── Personliga anteckningar (user_exercise_notes) ─────────────

export async function getUserExerciseNote(userId, exerciseName) {
  if (!userId || !exerciseName) return null
  const { data, error } = await supabase
    .from('user_exercise_notes')
    .select('note')
    .eq('user_id', userId)
    .eq('exercise_name', exerciseName)
    .maybeSingle()
  if (error) return null
  return data?.note ?? null
}

export async function upsertUserExerciseNote(userId, exerciseName, note) {
  if (!userId || !exerciseName) return null
  const { data, error } = await supabase
    .from('user_exercise_notes')
    .upsert(
      { user_id: userId, exercise_name: exerciseName, note: note ?? '', updated_at: new Date().toISOString() },
      { onConflict: 'user_id,exercise_name' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}
