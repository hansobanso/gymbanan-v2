const AI_ENDPOINT = 'https://opta-proxy.gymbanan.workers.dev'
const AI_MODEL = 'claude-haiku-4-5-20251001'

/**
 * Skickar meddelanden + kontext till PT-endpointen.
 * Returnerar AI:ns svarstext.
 */
export async function chatWithAI({ messages, context, memory }) {
  const body = {
    model: AI_MODEL,
    max_tokens: 1024,
    messages,
  }
  const parts = ['Du är en personlig tränare i en träningsapp. Hjälp användaren med frågor om träning, teknik, belastning och progression. Svara alltid på svenska.']
  if (memory) parts.push(`\nHär är träningshistorik och kontext för den här användaren:\n${memory}`)
  if (context) parts.push(`\nAktuellt pass:\n${context}`)
  body.system = parts.join('\n')

  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`AI-fel: ${res.status}`)
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

/**
 * Genererar en kort PT-intro inför ett pass.
 */
export async function generateWorkoutIntro({ context, memory }) {
  const body = {
    model: AI_MODEL,
    max_tokens: 256,
    messages: [{ role: 'user', content: 'Ge mig en kort genomgång inför detta pass.' }],
    system: [
      'Du är en PT. Ge en kort, personlig genomgång inför detta pass – max 3–4 meningar. Nämn vad användaren ska fokusera på, om någon övning inte gjorts på länge (ta det lugnt) eller om det går bra (pusha). Var direkt och konkret, inga generella fraser. Svara på svenska. VIKTIGT: Om du rekommenderar en lättare dag (deload, återhämtning, skonsam träning) – skriv ordet DELOAD i svaret så appen kan justera vikterna automatiskt.',
      memory ? `\nAnvändarens träningshistorik:\n${memory}` : '',
      context ? `\nDetta pass:\n${context}` : '',
    ].join(''),
  }
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`AI-fel: ${res.status}`)
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

/**
 * Bygger minnescontent från senaste pass + befintliga anteckningar.
 * Delar upp befintlig memory i historia vs personliga anteckningar.
 */
export function buildMemoryContent(recentWorkouts, existingMemory) {
  // Parse existing user notes (below the delimiter)
  const NOTES_MARKER = '--- PERSONLIGA ANTECKNINGAR ---'
  const existingNotes = existingMemory?.includes(NOTES_MARKER)
    ? existingMemory.split(NOTES_MARKER)[1].trim()
    : ''

  const lines = ['--- TRÄNINGSHISTORIK ---']
  for (const w of recentWorkouts.slice(0, 5)) {
    const date = new Date(w.finished_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
    lines.push(`\n${date}: ${w.session_name ?? 'Pass'}`)
    for (const ex of w.exercises ?? []) {
      const doneSets = (ex.sets ?? []).filter(s => s.type === 'work' && s.done)
      if (doneSets.length === 0) continue
      const setStr = doneSets.map(s => `${s.weight || '?'}kg×${s.reps || '?'}${s.rir !== null && s.rir !== undefined ? ` RIR${s.rir}` : ''}`).join(', ')
      lines.push(`  ${ex.name}: ${setStr}`)
    }
  }

  if (existingNotes) {
    lines.push(`\n${NOTES_MARKER}\n${existingNotes}`)
  }

  return lines.join('\n')
}

/**
 * Lägger till fri text till minnesanteckningarna.
 */
export function appendUserNote(existingMemory, newNote) {
  const NOTES_MARKER = '--- PERSONLIGA ANTECKNINGAR ---'
  const historyPart = existingMemory?.includes(NOTES_MARKER)
    ? existingMemory.split(NOTES_MARKER)[0].trimEnd()
    : (existingMemory ?? '')
  const existingNotes = existingMemory?.includes(NOTES_MARKER)
    ? existingMemory.split(NOTES_MARKER)[1].trim()
    : ''
  const combinedNotes = [existingNotes, newNote].filter(Boolean).join('\n')
  return `${historyPart}\n\n${NOTES_MARKER}\n${combinedNotes}`
}

/**
 * Bygger en kontextsträng från pågående pass.
 */
export function buildWorkoutContext(sessionName, exercises, workoutNotes) {
  const lines = [`Pass: ${sessionName}`, '']
  if (workoutNotes?.trim()) {
    lines.push(`Anteckningar fran anvandaren: "${workoutNotes.trim()}"`, '')
  }
  for (const ex of exercises) {
    const doneSets = ex.sets.filter(s => s.done)
    if (doneSets.length === 0) continue
    lines.push(`${ex.name}${ex.muscleGroup ? ` (${ex.muscleGroup})` : ''}:`)
    for (const s of doneSets) {
      const label = s.type === 'warmup' ? 'Uppvarmning' : 'Set'
      const rir = s.rir !== null && s.rir !== undefined ? ` · RIR ${s.rir}` : ''
      lines.push(`  ${label}: ${s.weight || '?'} kg x ${s.reps || '?'}${rir}`)
    }
    if (ex.aiComment?.trim()) lines.push(`  Notering: "${ex.aiComment}"`)
    lines.push('')
  }
  return lines.join('\n').trim()
}
