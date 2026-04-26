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
  const parts = [
`Du är en personlig tränare i en träningsapp. Hjälp användaren med frågor om träning, belastning, progression, vila, programmering och struktur.

VIKTIGT - vad du INTE kan:
- Du kan INTE se användaren träna. Du har bara siffror (vikt, reps, RIR) från loggade pass.
- Säg ALDRIG att användaren har "bra form", "bra teknik", "bra kontroll på rörelsen" eller liknande - du kan inte observera detta.
- Påstå ALDRIG att du ser hur någon utför övningar.
- Om användaren frågar om teknik/form: ge allmänna tips, men klargör att du inte kan bedöma deras utförande utan bara erbjuda vanliga fokuspunkter.

Vad du KAN bedöma utifrån data:
- Viktprogression över tid (går vikten upp? stagnation?)
- Volym (sets × reps × vikt) per muskelgrupp
- RIR-trender (om användaren ligger nära failure eller har marginal)
- Vilotid mellan pass, träningsfrekvens
- Om användaren följer sitt program eller inte

═══ ANPASSA AKTUELLT PASS ═══
Om användaren beskriver en omständighet som motiverar att passet anpassas (sjuk, trött, dålig sömn, ont någonstans, deload, kort om tid, vill köra tyngre, vill köra lättare, etc.) ska du:

1. Förklara kort i ord vad du föreslår och varför.
2. Avsluta MED ett JSON-block exakt så här:

<adjustment>
{
  "summary": "Sänkt vikter 30% och färre reps på allt - sjukpass",
  "changes": [
    { "exerciseName": "Bänkpress", "weightMultiplier": 0.7, "repsMin": 6, "repsMax": 8 },
    { "exerciseName": "Hantelrodd", "weightMultiplier": 0.7, "repsMin": 8, "repsMax": 10 }
  ]
}
</adjustment>

Regler för JSON-blocket:
- Inkludera ALLA övningar i passet (du ser dem under "Aktuellt pass" nedan).
- "exerciseName" måste exakt matcha namnen i passet.
- "weightMultiplier" är en faktor mot förra passets vikter (0.7 = 70%, 1.1 = 110%).
- "repsMin"/"repsMax" är de nya rep-målen. Utelämna fältet om de inte ändras.
- "summary" är en KORT mening (max ca 60 tecken) som visas på knappen "Tillämpa".
- Föreslå BARA en justering om användaren faktiskt ber om det eller beskriver en situation som motiverar det. Vid vanliga frågor (progression, teknik, etc.): inget JSON-block.
- Skriv inget mer text efter JSON-blocket.

Stil: direkt, konkret, på svenska. Inga generella fraser.`
  ]
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
 * Analyserar träningshistorik och aktuellt pass för att hitta
 * konkreta händelser PT:n ska kommentera proaktivt.
 *
 * Returnerar en sträng med insikter som skickas in till AI:n
 * tillsammans med vanlig kontext.
 */
export function analyzeWorkoutContext(recentWorkouts, currentExercises) {
  const insights = []
  if (!recentWorkouts || recentWorkouts.length === 0) {
    insights.push('FÖRSTA PASSET: Användaren har inga tidigare loggade pass.')
    return insights.join('\n')
  }

  // 1) PR-detektion: jämför aktuell övnings tilltänkta vikter mot tidigare maxvikt
  const currentExNames = new Set((currentExercises ?? []).map(e => e.name))
  const exHistory = {} // { exName: [{ date, maxWeight, maxReps }] }
  for (const w of recentWorkouts) {
    for (const ex of (w.exercises ?? [])) {
      if (!exHistory[ex.name]) exHistory[ex.name] = []
      const workSets = (ex.sets ?? []).filter(s => s.type === 'work' && s.done)
      if (workSets.length === 0) continue
      const maxWeight = Math.max(...workSets.map(s => Number(s.weight) || 0))
      const repsAtMax = workSets
        .filter(s => Number(s.weight) === maxWeight)
        .map(s => Number(s.reps) || 0)
      const maxReps = repsAtMax.length ? Math.max(...repsAtMax) : 0
      exHistory[ex.name].push({
        date: w.finished_at,
        maxWeight,
        maxReps,
      })
    }
  }

  // 2) Övningar som inte tränats på länge (i aktuellt pass)
  const NOW = Date.now()
  const DAYS = (ms) => Math.round(ms / (1000 * 60 * 60 * 24))
  for (const exName of currentExNames) {
    const hist = exHistory[exName]
    if (!hist || hist.length === 0) {
      insights.push(`OBEKANT ÖVNING: "${exName}" - användaren har inte loggat denna övning tidigare. Föreslå försiktig ingångsvikt.`)
      continue
    }
    const lastDate = new Date(hist[0].date).getTime()
    const daysSince = DAYS(NOW - lastDate)
    if (daysSince > 21) {
      insights.push(`PAUS: "${exName}" har inte tränats på ${daysSince} dagar. Ta det lugnt med vikten på första set, kanske 80% av tidigare max.`)
    }
  }

  // 3) Stagnation: samma vikt × samma reps i 3+ pass i rad
  for (const exName of currentExNames) {
    const hist = exHistory[exName]?.slice(0, 5) ?? []
    if (hist.length < 3) continue
    const top3 = hist.slice(0, 3)
    const sameW = top3.every(h => h.maxWeight === top3[0].maxWeight)
    const sameR = top3.every(h => h.maxReps === top3[0].maxReps)
    if (sameW && sameR && top3[0].maxWeight > 0) {
      insights.push(`STAGNATION: "${exName}" har varit på ${top3[0].maxWeight}kg × ${top3[0].maxReps} reps i 3 pass i rad. Dags att försöka öka eller variera.`)
    }
  }

  // 4) PR-närhet: senaste pass var stark, antyd att en PR är möjlig idag
  for (const exName of currentExNames) {
    const hist = exHistory[exName]?.slice(0, 4) ?? []
    if (hist.length < 2) continue
    const allTimeMax = Math.max(...hist.map(h => h.maxWeight))
    const lastMax = hist[0].maxWeight
    if (lastMax === allTimeMax && lastMax > 0) {
      const repsAtMax = hist[0].maxReps
      if (repsAtMax >= 8) {
        insights.push(`PR-NÄRHET: "${exName}" - senaste passet körde ${lastMax}kg × ${repsAtMax} reps (vid all-time-max). Du kan nog öka vikten idag.`)
      }
    }
  }

  // 5) Veckostatistik: relativa mått
  // Räkna pass per vecka senaste 7 dagar, jämfört med användarens normala frekvens
  // (genomsnitt över de 30 dagar som föregick senaste 7 dagarna).
  const last7d = recentWorkouts.filter(w => {
    const t = new Date(w.finished_at).getTime()
    return DAYS(NOW - t) <= 7
  })
  // Beräkna baseline: pass mellan dag 8 och dag 37 (en månad innan denna vecka)
  const baselineWindow = recentWorkouts.filter(w => {
    const days = DAYS(NOW - new Date(w.finished_at).getTime())
    return days > 7 && days <= 37
  })
  const baselinePerWeek = baselineWindow.length / 4.3 // ≈ 30/7

  // Bara flagga om denna vecka är MARKANT högre än användarens normala
  // (minst 50% mer pass än vanligt OCH minst 5 pass)
  if (last7d.length >= 5 && baselinePerWeek > 0 && last7d.length > baselinePerWeek * 1.5) {
    insights.push(`HÖGFREKVENS: ${last7d.length} pass senaste 7 dagarna (vanligtvis ~${baselinePerWeek.toFixed(1)} pass/vecka). Återhämtning kan vara stressad.`)
  }

  // 6) Deload-signal: bygger på stagnation som primärsignal, inte total volym
  // Stagnation över flera övningar = trolig överbelastning, oavsett om användaren
  // kör 2 eller 5 pass/vecka. Ett program med många pass är inte i sig en deload-signal.
  const stagnationCount = insights.filter(i => i.startsWith('STAGNATION')).length
  if (stagnationCount >= 3) {
    insights.push(`DELOAD-SIGNAL: ${stagnationCount} övningar har stagnerat samtidigt - tecken på att kroppen behöver återhämtning. Föreslå en deload-vecka (sänk vikt 10-15%, halvera volym).`)
  } else if (stagnationCount >= 2 && last7d.length >= 4 && baselinePerWeek > 0 && last7d.length > baselinePerWeek * 1.3) {
    // Sekundärsignal: 2 stagnationer + en vecka som är högre än användarens normala
    insights.push(`DELOAD-SIGNAL: 2 övningar har stagnerat och denna vecka är ovanligt intensiv (${last7d.length} pass vs vanligt ~${baselinePerWeek.toFixed(1)}). Överväg lättare vecka.`)
  }

  if (insights.length === 0) {
    insights.push('Inga särskilda flaggor i datan - ge en generell, kort genomgång.')
  }
  return insights.join('\n')
}

/**
 * Genererar en kort PT-intro inför ett pass, nu med proaktiva insikter.
 */
export async function generateWorkoutIntro({ context, memory, recentWorkouts, currentExercises }) {
  const insights = analyzeWorkoutContext(recentWorkouts, currentExercises)
  const body = {
    model: AI_MODEL,
    max_tokens: 320,
    messages: [{ role: 'user', content: 'Ge mig en kort genomgång inför detta pass.' }],
    system: [
`Du är en PT som ser användarens träningsdata (siffror från tidigare pass). Ge en kort, personlig genomgång inför detta pass – max 3-4 meningar.

VAD DU SKA GÖRA:
- Plocka 1-2 saker från PROAKTIVA INSIKTER nedan och kommentera konkret. Det är viktigast.
- Fira PR-närhet med entusiasm ("Du kan ta din rekord idag på X!")
- Varna mjukt om paus/stagnation/deload med konkret action.
- Om inga insikter finns: ge generell men kort genomgång baserat på programmet.

FÖRBJUDET:
- Kommentera ALDRIG form, teknik, rörelsekontroll eller utförande - du kan inte se detta.
- Inga generella klyschor ("bra jobbat!", "håll kvar där") utan data bakom.

VIKTIGT: Om du rekommenderar en lättare dag (deload, återhämtning) - skriv ordet DELOAD i svaret så appen kan justera vikterna automatiskt.

Svara på svenska, direkt och konkret.`,
      memory ? `\nAnvändarens träningshistorik:\n${memory}` : '',
      context ? `\nDetta pass:\n${context}` : '',
      `\nPROAKTIVA INSIKTER (analyserat från användarens data):\n${insights}`,
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
  for (const w of recentWorkouts.slice(0, 50)) {
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

/**
 * Parsar ett AI-svar och hittar ett <adjustment>...</adjustment>-block.
 * Returnerar { displayText, adjustment } där displayText är svaret utan
 * JSON-blocket, och adjustment är det parsade förslaget eller null.
 */
export function parseAdjustment(aiText) {
  if (!aiText) return { displayText: aiText, adjustment: null }
  const match = aiText.match(/<adjustment>\s*([\s\S]*?)\s*<\/adjustment>/i)
  if (!match) return { displayText: aiText, adjustment: null }
  const jsonStr = match[1].trim()
  let adjustment = null
  try {
    const parsed = JSON.parse(jsonStr)
    if (Array.isArray(parsed.changes) && parsed.changes.length > 0) {
      adjustment = {
        summary: typeof parsed.summary === 'string' ? parsed.summary : 'Tillämpa förslag',
        changes: parsed.changes.filter(c => typeof c?.exerciseName === 'string'),
      }
    }
  } catch {
    // ogiltig JSON - ignorera
  }
  const displayText = aiText.replace(match[0], '').trim()
  return { displayText, adjustment }
}
