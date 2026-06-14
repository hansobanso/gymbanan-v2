const AI_ENDPOINT = 'https://opta-proxy.gymbanan.workers.dev'
// Sonnet ger markbart battre och mer idiomatisk svenska an Haiku
// (mindre svengelska). Lite langsammare/dyrare men vart det for PT-kvalitet.
const AI_MODEL = 'claude-sonnet-4-6'

/**
 * Skickar meddelanden + kontext till PT-endpointen.
 * Returnerar AI:ns svarstext.
 */
export async function chatWithAI({ messages, context, memory, deloadStatus, availableExercises, coachMode = false }) {
  // Filtrera till bara role+content — API:t accepterar inte extra falt
  // som displayContent, adjustment, deload etc.
  const cleanMessages = messages.map(m => ({ role: m.role, content: m.content }))
  const body = {
    model: AI_MODEL,
    max_tokens: coachMode ? 3072 : 1024,
    messages: cleanMessages,
  }
  const parts = [
`Du är en personlig tränare i en träningsapp. Hjälp användaren med frågor om träning, belastning, progression, vila, programmering och struktur.

DIN PERSONLIGHET OCH TON:
- Du är en peppig, jordnära och rak tränare som faktiskt bryr dig. Prata som en kunnig kompis på gymmet, inte som en lärobok.
- Skriv som du pratar: korta stycken, ledigt språk, gärna lite värme och humor. Det är okej att vara entusiastisk när något är bra ("snyggt jobbat!") och rak när något kan bli bättre.
- Var konkret och ärlig. Hellre en tydlig åsikt än en lista med förbehåll. Du får tycka till.
- Använd "du" och prata direkt med personen. Du kan referera till dig själv som "jag".

HUR DU FORMATERAR SVAR (viktigt):
- Skriv FLYTANDE TEXT i korta stycken. INGA markdown-rubriker (## eller ###), INGA horisontella linjer (---), INGA fetstilta rubriker över varje stycke.
- Använd INGEN markdown-formatering alls i texten: inga stjärnor för fet/kursiv stil (*text* eller **text**), inga understreck. Appen visar inte markdown, så sådana tecken syns som råa stjärnor. Vill du betona något - gör det med ordval, inte symboler.
- Undvik punktlistor när det går - prata istället i löpande text. Om du verkligen behöver lista flera saker (t.ex. konkreta övningar), håll det kort och enkelt.
- Tänk dig att du skriver ett chattmeddelande till en kompis, inte en rapport. Det ska kännas som ett samtal.
- Håll svaren lagom korta och kärnfulla. Säg det viktigaste, inte allt du vet.
- (Undantag: de tekniska blocken <programchange>, <programswitch> och <newprogram> som beskrivs längre ner är INTE vanlig text - dem skriver du precis enligt instruktionerna, de plockas bort automatiskt innan användaren ser svaret.)

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
Om användaren beskriver en omständighet som motiverar att passet anpassas (sjuk, trött, dålig sömn, ont någonstans, kort om tid, vill köra tyngre, vill köra lättare, etc.) ska du:

1. Förklara kort i ord vad du föreslår och varför.
2. Avsluta MED ett JSON-block exakt så här:

<adjustment>
{
  "summary": "Sjukpass: 30% lättare och färre reps",
  "changes": [
    { "exerciseName": "Bänkpress", "weightMultiplier": 0.7, "repsMin": 6, "repsMax": 8 },
    { "exerciseName": "Pullups", "repsMultiplier": 0.7 },
    { "exerciseName": "Hantelrodd", "weightMultiplier": 0.7, "setMultiplier": 0.67 }
  ]
}
</adjustment>

Regler för JSON-blocket:
- Inkludera ALLA övningar i passet (du ser dem under "Aktuellt pass" nedan).
- "exerciseName" måste exakt matcha namnen i passet.
- "weightMultiplier" är en faktor mot förra passets vikter (0.7 = 70%, 1.1 = 110%).
  Påverkar uppvärmning, arbetsset OCH back-off.
- "repsMultiplier" är en faktor som SÄNKER reps - använd för kroppsviktsövningar
  (pullups, dips, push-ups, hängande benlyft etc) som saknar vikt. Då finns
  ingen vikt att justera, så reps är det enda som kan ändras.
- "repsMin"/"repsMax" är de nya rep-målen för övningen (mer specifikt än repsMultiplier).
  Använd om du har ett konkret rep-intervall i åtanke.
- "setMultiplier" gångrar antalet ARBETSSET (0.5 = halvera, 0.67 = 2/3 etc).
  Använd vid deload eller om någon kör många set och behöver volym-reducering.
  Värdet 1 (oförändrat) ska utelämnas. Bara värden < 1 fungerar (kan inte lägga till set).
- "summary" är en KORT mening på SVENSKA (max ca 60 tecken) som visas på knappen.
- ALLT i svaret OCH i summary måste vara på svenska. Inga engelska ord eller fraser.
- Föreslå BARA en justering om användaren faktiskt ber om det eller beskriver en
  situation som motiverar det. Vid vanliga frågor (progression, teknik, etc.):
  inget JSON-block.
- Skriv inget mer text efter JSON-blocket.

═══ ÅTERKOMST EFTER PAUS ═══
Om användaren tränar igen efter en paus (sjukdom, deload, semester etc.) - följ
denna praxis:

- **1-3 dagar borta:** Ta vid där du var, ingen regression.
- **4-7 dagar borta:** Fungerar oftast med samma vikter. Ingen sänkning krävs.
- **8-14 dagar borta:** Sänk vikten ~10% första passet (weightMultiplier: 0.9).
  Ramp upp över 1-2 pass.
- **15-28 dagar borta:** Sänk vikten 15-20% (weightMultiplier: 0.8). Ramp upp
  över 2-3 pass.
- **1+ månad borta:** Sänk vikten 20-30% (weightMultiplier: 0.75). Ramp upp
  över 2-3 veckor.

EFTER DELOAD-VECKA: Användaren förväntas vara *starkare* (återhämtad), inte
svagare. Ingen extra sänkning. Fortsätt progressionen som vanligt.

EFTER ANPASSAT PASS (sjukpass, lättare): Senaste passet är inte representativt
för normal styrka. Hoppa över dess vikter när du föreslår progression - använd
passet före det.

═══ DELOAD-VECKA ═══
En deload-vecka är 7 dagar där alla pass automatiskt körs lättare för återhämtning.
När användaren ber om en deload-vecka (eller du tycker datan tydligt visar att de behöver),
föreslå det med ett SEPARAT JSON-format:

<deload>
{
  "summary": "Deload-vecka: -15% vikt, ett set mindre",
  "days": 7,
  "weightMultiplier": 0.85,
  "setReduction": 1
}
</deload>

Regler för deload-blocket:
- Använd <deload>...</deload>-taggar (NOT <adjustment>).
- "days" är 7 som standard, eller mer/mindre om användaren ber om det.
- "weightMultiplier" är 0.85 (= -15%) som standard.
- "setReduction" är hur många arbetsset som ska tas bort per övning (default 1).
- "summary" är en kort mening på svenska.
- Använd <deload>-blocket BARA när användaren faktiskt vill köra en deload-vecka,
  inte bara ett enstaka lättare pass (då används <adjustment> istället).

VIKTIGT om deload kontra anpassning:
- "Jag är sjuk idag" -> <adjustment> (bara detta pass)
- "Jag känner mig sliten, kanske dags för deload?" -> <deload> (hela veckan)
- "Jag vill köra deload" -> <deload>

Stil: direkt, konkret, på svenska. Inga generella fraser. Inga engelska låneord.`
  ]

  // Om vi har en ovningslista: lar PT att kunna generera ett helt pass.
  if (Array.isArray(availableExercises) && availableExercises.length > 0) {
    const exNames = availableExercises.map(e => e.name).join(', ')
    const timeBased = availableExercises.filter(e => e.is_time_based).map(e => e.name)
    parts.push(`
═══ GENERERA PASS ═══
Om användaren ber dig sätta ihop ett pass (t.ex. "skapa ett benpass", "ge mig ett helkroppspass med bara kroppsvikt", "ett kort överkroppspass"), föreslå övningar och avsluta svaret med ett JSON-block:

<workout>
{
  "summary": "Benpass, 5 övningar",
  "exercises": [
    { "name": "Knäböj", "sets": 4, "repsMin": 6, "repsMax": 10 },
    { "name": "Rumänsk marklyft", "sets": 3, "repsMin": 8, "repsMax": 12 }
  ]
}
</workout>

Regler för <workout>-blocket:
- Du FÅR BARA välja övningar från denna lista (exakt namn): ${exNames}
- Välj ALDRIG en övning som inte finns i listan. Hittar du inget som passar, välj det närmaste.
- 4-7 övningar för ett helkroppspass, 4-6 för en kroppsdel.
- Ange "sets" (vanligtvis 3-4) och "repsMin"/"repsMax" per övning.${timeBased.length ? `
- DESSA övningar mäts i SEKUNDER, inte reps - sätt repsMin/repsMax som sekunder (t.ex. 30-60): ${timeBased.join(', ')}` : ''}
- Skriv en kort, peppig motivering FÖRE blocket. Inget text efter blocket.
- Använd <workout> BARA när användaren ber om ett helt pass, inte för enstaka övningsfrågor.`)
  }

  if (deloadStatus?.isActive) {
    parts.push(`\n═══ AKTIV DELOAD-VECKA ═══\nAnvändaren kör just nu en deload-vecka (${deloadStatus.daysLeft} dagar kvar). Vikterna är redan automatiskt sänkta. Föreslå INTE en ny deload, och kommentera INTE stagnationer som problem - det är meningen att vikterna är låga nu.`)
  }
  if (memory) parts.push(`\nHär är träningshistorik och kontext för den här användaren:\n${memory}`)
  if (coachMode) {
    parts.push(`
═══ ÄNDRA I PROGRAMMET ═══
Du pratar nu med användaren utanför ett pass (fristående PT-läge). Du ser
användarens aktiva program nedan. Om användaren ber dig ändra i programmet
- lägga till/ta bort/byta övning, eller justera set/reps/vila - ska du:

1. Förklara kort vad du föreslår och varför.
2. Avsluta MED ett JSON-block exakt så här:

<programchange>
{
  "summary": "Kort beskrivning av andringen",
  "sessionName": "Namnet pa passet som ska andras",
  "operations": [
    { "op": "adjust", "exerciseName": "Knäböj", "workSets": 3, "repsMin": 5, "repsMax": 8 },
    { "op": "remove", "exerciseName": "Vadpress" },
    { "op": "add", "exerciseName": "Benpress", "workSets": 3, "repsMin": 8, "repsMax": 12, "restSeconds": 120 },
    { "op": "replace", "exerciseName": "Sittande bencurl", "newExerciseName": "Liggande bencurl" }
  ]
}
</programchange>

Regler:
- "sessionName" (pa toppniva) MASTE exakt matcha ett av passen i programmet nedan.
- FLYTTA en ovning mellan tva pass = tva operationer dar VARJE operation har
  ett eget "sessionName": en "remove" fran kallpasset och en "add" till malpasset.
  Exempel: flytta Benpress fran Övre 1 till Övre 2:
  [ { "op": "remove", "exerciseName": "Benpress", "sessionName": "Övre 1" },
    { "op": "add", "exerciseName": "Benpress", "sessionName": "Övre 2" } ]
- "op" ar en av: "adjust", "remove", "add", "replace".
- For "add" och "replace" MASTE ovningsnamnet (resp. "newExerciseName") exakt
  matcha en ovning i listan over tillgangliga ovningar ovan. Hitta ALDRIG pa
  ovningsnamn - valj bara bland de som finns.
- For "adjust"/"remove" maste "exerciseName" matcha en ovning som redan finns i passet.
- Anvand BARA detta block nar anvandaren faktiskt ber om en andring i programmet.
  For vanliga fragor svarar du bara i text.

═══ BYTA AKTIVT PROGRAM ═══
Om anvandaren vill byta till ett annat program (eller om du starkt
rekommenderar det), och programmet finns i listan "Tillgangliga program"
ovan, ska du forklara kort varfor och avsluta med:

<programswitch>
{ "summary": "Byt till Helkropp", "programName": "Helkropp" }
</programswitch>

Regler:
- "programName" MASTE exakt matcha ett av de tillgangliga programmen ovan.
- Foresla ALDRIG att byta till ett program som inte finns i listan.
- Byt bara nar anvandaren ber om det eller tydligt skulle ha nytta av det.

═══ SKAPA ETT HELT NYTT PROGRAM ═══
Om anvandaren ber dig skapa ett nytt traningsprogram (med flera pass), gor sa:

1. Forklara kort upplagget (hur manga pass, fokus, upplagg).
2. Avsluta med ett JSON-block:

<newprogram>
{
  "name": "Helkropp 3x/vecka",
  "sessions": [
    { "name": "Pass A", "exercises": [
      { "name": "Knäböj", "workSets": 3, "repsMin": 5, "repsMax": 8, "restSeconds": 180 },
      { "name": "Bänkpress", "workSets": 3, "repsMin": 6, "repsMax": 10, "restSeconds": 150 }
    ]},
    { "name": "Pass B", "exercises": [
      { "name": "Marklyft", "workSets": 3, "repsMin": 4, "repsMax": 6, "restSeconds": 180 }
    ]}
  ]
}
</newprogram>

Regler:
- ALLA ovningsnamn MASTE exakt matcha ovningar i listan over tillgangliga
  ovningar ovan. Hitta ALDRIG pa ovningar - valj bara bland de som finns.
- Ge varje ovning rimliga workSets (2-4), repsMin/repsMax och restSeconds.
- Ge programmet ett tydligt namn och varje pass ett namn (t.ex. "Overkropp", "Ben").
- Det nya programmet SPARAS men blir INTE automatiskt aktivt - anvandaren
  valjer sjalv att aktivera det. Namn det i din text.
- Anvand BARA detta block nar anvandaren faktiskt vill skapa ett nytt program.`)
  }
  if (context) parts.push(`\n${coachMode ? 'Anvandarens aktiva program och senaste traning' : 'Aktuellt pass'}:\n${context}`)
  body.system = parts.join('\n')

  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const e = new Error(`AI-fel: ${res.status}`)
    e.status = res.status
    throw e
  }
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

  const NOW = Date.now()
  const DAYS = (ms) => Math.round(ms / (1000 * 60 * 60 * 24))

  // 0) FRÅNVARO-DETEKTION: hur länge sedan senaste pass?
  // Hoppa över anpassade pass (sjuk/deload) - de räknas inte som "tränat normalt"
  const lastNormalWorkout = recentWorkouts.find(w => !w.adjusted)
  if (lastNormalWorkout) {
    const daysSinceLast = DAYS(NOW - new Date(lastNormalWorkout.finished_at).getTime())
    if (daysSinceLast >= 7 && daysSinceLast <= 10) {
      insights.push(`ÅTERKOMST EFTER PAUS: ${daysSinceLast} dagar sedan senaste normala pass. Föreslå att köra samma vikter som tidigare - kort paus ger ingen detraining. Säg "välkommen tillbaka" och håll vikterna oförändrade.`)
    } else if (daysSinceLast >= 11 && daysSinceLast <= 14) {
      insights.push(`ÅTERKOMST EFTER PAUS: ${daysSinceLast} dagar sedan senaste normala pass (1-2 veckor). Rekommendera att SÄNKA vikten 10% första passet, sedan ramp:a upp över 1-2 pass. Använd <adjustment> med weightMultiplier 0.9 för alla övningar.`)
    } else if (daysSinceLast >= 15 && daysSinceLast <= 28) {
      insights.push(`LÅNG FRÅNVARO: ${daysSinceLast} dagar sedan senaste normala pass (2-4 veckor). Sänk vikten 15-20% första passet och ramp:a upp över 2-3 pass. Använd <adjustment> med weightMultiplier 0.8 för alla övningar.`)
    } else if (daysSinceLast > 28) {
      insights.push(`MYCKET LÅNG FRÅNVARO: ${daysSinceLast} dagar sedan senaste normala pass (1+ månad). Sänk vikten 20-30% och ramp:a upp över 2-3 veckor. Använd <adjustment> med weightMultiplier 0.75.`)
    }
  }

  // 0b) Återkomst efter sjukperiod: senaste 1-2 pass var anpassade men nu kör användaren igen
  const recentAdjusted = recentWorkouts.slice(0, 3).filter(w => w.adjusted).length
  const lastWasAdjusted = recentWorkouts[0]?.adjusted
  if (lastWasAdjusted && recentAdjusted >= 1) {
    const daysSinceLastAny = DAYS(NOW - new Date(recentWorkouts[0].finished_at).getTime())
    if (daysSinceLastAny <= 7) {
      insights.push(`ÅTERKOMST EFTER SJUKPASS: Senaste pass var anpassat (sjuk/lättare). Om användaren mår bra idag - ta vid där det var INNAN sjukpasset. Hoppa över de anpassade vikterna när du föreslår progression.`)
    }
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
 * Detekterar traninsuppehall och returnerar en adjustment som kan
 * appliceras direkt — ingen AI-parsning behovs.
 * Returnerar null om inget uppehall detekteras (< 8 dagar).
 */
export function detectGapAdjustment(recentWorkouts, exerciseNames) {
  if (!recentWorkouts?.length || !exerciseNames?.length) return null
  const lastNormal = recentWorkouts.find(w => !w.adjusted)
  if (!lastNormal?.finished_at) return null

  const daysSince = Math.round((Date.now() - new Date(lastNormal.finished_at).getTime()) / 86400000)

  let weightMult = null
  let repsMult = null
  let summary = null

  if (daysSince >= 8 && daysSince <= 14) {
    weightMult = 0.9
    repsMult = 0.85
    summary = `${daysSince} dagar sedan senaste passet — vikter sänkta 10%`
  } else if (daysSince >= 15 && daysSince <= 28) {
    weightMult = 0.8
    repsMult = 0.75
    summary = `${daysSince} dagar sedan senaste passet — vikter sänkta 20%`
  } else if (daysSince > 28) {
    weightMult = 0.75
    repsMult = 0.7
    summary = `${daysSince} dagar sedan senaste passet — vikter sänkta 25%`
  }

  if (!weightMult) return null

  return {
    summary,
    changes: exerciseNames.map(name => ({
      exerciseName: name,
      weightMultiplier: weightMult,
      repsMultiplier: repsMult,
    })),
  }
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
 * Bygger kontext for den fristaende PT-chatten (utan aktivt pass).
 * Sammanfattar aktivt program, kommande pass och senaste traning sa att
 * PT:n kan svara pa allmanna fragor och fragor om uppkommande pass.
 *
 * @param {object} opts
 * @param {object|null} opts.activeProgram - aktivt program { name, sessions }
 * @param {Array} opts.recentWorkouts - senaste passen (fran getWorkouts)
 * @param {string|null} opts.displayName - anvandarens namn
 */
export function buildCoachContext({ activeProgram, recentWorkouts, displayName, allPrograms } = {}) {
  const lines = []
  if (displayName) lines.push(`Anvandare: ${displayName}`, '')

  if (activeProgram?.name) {
    lines.push(`Aktivt program just nu: ${activeProgram.name}`, '')
  } else {
    lines.push('Anvandaren har inget aktivt program just nu.', '')
  }

  if (Array.isArray(allPrograms) && allPrograms.length) {
    lines.push('Alla dina program (med innehall):')
    for (const p of allPrograms) {
      const aktiv = activeProgram?.id === p.id ? ' (AKTIVT nu)' : ''
      lines.push(`▸ ${p.name}${aktiv}`)
      const sessions = Array.isArray(p.sessions) ? p.sessions : []
      if (sessions.length) {
        for (const sess of sessions) {
          const exNames = Array.isArray(sess.exercises)
            ? sess.exercises.map(e => e.name).filter(Boolean)
            : []
          lines.push(`    - ${sess.name || 'Namnlost pass'}: ${exNames.join(', ') || '(inga ovningar)'}`)
        }
      } else {
        lines.push('    (inga pass)')
      }
    }
    lines.push('')
    lines.push('OBS: Du kan bara SPARA andringar i det AKTIVA programmet. Om')
    lines.push('anvandaren vill andra i ett annat program, ge garna radet i text,')
    lines.push('och forklara att de behover gora det aktivt forst for att du ska')
    lines.push('kunna spara andringen at dem.')
    lines.push('')
  }

  if (Array.isArray(recentWorkouts) && recentWorkouts.length) {
    lines.push('Senaste traningen:')
    for (const w of recentWorkouts.slice(0, 5)) {
      const datum = w.completed_at ? String(w.completed_at).slice(0, 10) : '?'
      const namn = w.session_name || w.name || 'Pass'
      const antal = Array.isArray(w.exercises) ? w.exercises.length : 0
      lines.push(`  - ${datum}: ${namn} (${antal} ovningar)`)
    }
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

/**
 * Parsar ett AI-svar och hittar ett <deload>...</deload>-block.
 * Returnerar { displayText, deload } där deload är förslaget eller null.
 */
export function parseDeload(aiText) {
  if (!aiText) return { displayText: aiText, deload: null }
  const match = aiText.match(/<deload>\s*([\s\S]*?)\s*<\/deload>/i)
  if (!match) return { displayText: aiText, deload: null }
  const jsonStr = match[1].trim()
  let deload = null
  try {
    const parsed = JSON.parse(jsonStr)
    deload = {
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Starta deload-vecka',
      days: Number.isFinite(parsed.days) ? parsed.days : 7,
      weightMultiplier: Number.isFinite(parsed.weightMultiplier) ? parsed.weightMultiplier : 0.85,
      setReduction: Number.isFinite(parsed.setReduction) ? parsed.setReduction : 1,
    }
  } catch {
    // ogiltig JSON
  }
  const displayText = aiText.replace(match[0], '').trim()
  return { displayText, deload }
}

/**
 * Parsar ett AI-svar och hittar ett <workout>...</workout>-block med ett
 * genererat pass. Returnerar { displayText, workoutPlan } dar workoutPlan ar
 * { summary, exercises: [{ name, sets, repsMin, repsMax }] } eller null.
 */
export function parseWorkoutPlan(aiText) {
  if (!aiText) return { displayText: aiText, workoutPlan: null }
  const match = aiText.match(/<workout>\s*([\s\S]*?)\s*<\/workout>/i)
  if (!match) return { displayText: aiText, workoutPlan: null }
  const jsonStr = match[1].trim()
  let workoutPlan = null
  try {
    const parsed = JSON.parse(jsonStr)
    if (Array.isArray(parsed.exercises) && parsed.exercises.length > 0) {
      const exercises = parsed.exercises
        .filter(e => typeof e?.name === 'string')
        .map(e => ({
          name: e.name,
          sets: Number.isFinite(e.sets) ? e.sets : 3,
          repsMin: Number.isFinite(e.repsMin) ? e.repsMin : null,
          repsMax: Number.isFinite(e.repsMax) ? e.repsMax : null,
        }))
      if (exercises.length > 0) {
        workoutPlan = {
          summary: typeof parsed.summary === 'string' ? parsed.summary : 'Lägg till passet',
          exercises,
        }
      }
    }
  } catch {
    // ogiltig JSON - ignorera
  }
  const displayText = aiText.replace(match[0], '').trim()
  return { displayText, workoutPlan }
}

/**
 * Parsar ett <programchange>...</programchange>-block dar PT:n foreslar
 * andringar i ett KOMMANDE pass i ett program. Varje operation valideras:
 * ovningsnamn som ska laggas till/bytas in MASTE finnas i availableNames,
 * annars slangs operationen (sa vi aldrig skapar orphans i programmet).
 *
 * Format som PT:n forvantas generera:
 * <programchange>
 * {
 *   "summary": "Byt ut X mot Y och lagg till Z i passet Ben",
 *   "sessionName": "Ben",
 *   "operations": [
 *     { "op": "adjust", "exerciseName": "Knäböj", "workSets": 3, "repsMin": 5, "repsMax": 8 },
 *     { "op": "remove", "exerciseName": "Vadpress" },
 *     { "op": "add", "exerciseName": "Benpress", "workSets": 3, "repsMin": 8, "repsMax": 12 },
 *     { "op": "replace", "exerciseName": "Sittande bencurl", "newExerciseName": "Liggande bencurl" }
 *   ]
 * }
 * </programchange>
 *
 * @param {string} aiText - PT:ns svar
 * @param {string[]} availableNames - giltiga ovningsnamn (fran exercises)
 * @returns {{ displayText: string, programChange: object|null, rejected: string[] }}
 */
export function parseProgramChange(aiText, availableNames = []) {
  if (!aiText) return { displayText: aiText, programChange: null, rejected: [] }
  const match = aiText.match(/<programchange>\s*([\s\S]*?)\s*<\/programchange>/i)
  if (!match) return { displayText: aiText, programChange: null, rejected: [] }

  const nameSet = new Set(availableNames)
  const rejected = []
  let programChange = null
  try {
    const parsed = JSON.parse(match[1].trim())
    const ops = Array.isArray(parsed.operations) ? parsed.operations : []
    const validOps = []
    for (const o of ops) {
      if (!o || typeof o.op !== 'string' || typeof o.exerciseName !== 'string') continue
      const op = o.op.toLowerCase()
      // 'adjust' och 'remove' kraver att ovningen redan finns i passet -
      // det validerar vi nar vi tillampar (mot passet), inte mot biblioteket.
      // 'add' och 'replace' for IN ett nytt namn som MASTE finnas i biblioteket.
      if (op === 'add' && !nameSet.has(o.exerciseName)) { rejected.push(o.exerciseName); continue }
      if (op === 'replace') {
        if (typeof o.newExerciseName !== 'string' || !nameSet.has(o.newExerciseName)) {
          rejected.push(o.newExerciseName || o.exerciseName); continue
        }
      }
      if (!['adjust', 'remove', 'add', 'replace'].includes(op)) continue
      validOps.push({ ...o, op })
    }
    if (validOps.length > 0) {
      programChange = {
        summary: typeof parsed.summary === 'string' ? parsed.summary : 'Ändra i programmet',
        sessionName: typeof parsed.sessionName === 'string' ? parsed.sessionName : null,
        operations: validOps,
      }
    }
  } catch {
    // ogiltig JSON - ignorera
  }
  const displayText = aiText.replace(match[0], '').trim()
  return { displayText, programChange, rejected }
}

/**
 * Tillampar en programChange pa ett programs sessions-array och returnerar
 * en NY sessions-array (muterar inte originalet). Anvands nar anvandaren
 * tryckt "tillampa". Operationer mot ovningar som inte finns i passet
 * ignoreras tyst (adjust/remove/replace pa saknad ovning).
 *
 * @param {Array} sessions - programmets sessions
 * @param {object} programChange - fran parseProgramChange
 * @returns {Array} ny sessions-array
 */
export function applyProgramChange(sessions, programChange) {
  if (!Array.isArray(sessions) || !programChange) return sessions
  const { sessionName, operations } = programChange

  const defaultsForNew = (op) => ({
    name: op.exerciseName,
    notes: '',
    repsMin: op.repsMin ?? 8,
    repsMax: op.repsMax ?? 12,
    workSets: op.workSets ?? 3,
    warmupSets: op.warmupSets ?? 2,
    backoffSets: op.backoffSets ?? 0,
    restSeconds: op.restSeconds ?? 120,
  })

  return sessions.map(sess => {
    let exercises = Array.isArray(sess.exercises) ? [...sess.exercises] : []

    for (const op of operations) {
      // Varje operation kan rikta sig mot ett eget pass (op.sessionName).
      // Saknas det anvands forslagets gemensamma sessionName. Saknas bada
      // appliceras operationen pa alla pass (bakatkompatibelt).
      const target = op.sessionName || sessionName
      if (target && sess.name !== target) continue

      const idx = exercises.findIndex(e => e.name === op.exerciseName)
      if (op.op === 'add') {
        if (idx === -1) exercises.push(defaultsForNew(op))
      } else if (op.op === 'remove') {
        if (idx !== -1) exercises.splice(idx, 1)
      } else if (op.op === 'replace') {
        if (idx !== -1) exercises[idx] = { ...exercises[idx], name: op.newExerciseName }
      } else if (op.op === 'adjust') {
        if (idx !== -1) {
          const e = { ...exercises[idx] }
          if (op.workSets != null) e.workSets = op.workSets
          if (op.warmupSets != null) e.warmupSets = op.warmupSets
          if (op.backoffSets != null) e.backoffSets = op.backoffSets
          if (op.repsMin != null) e.repsMin = op.repsMin
          if (op.repsMax != null) e.repsMax = op.repsMax
          if (op.restSeconds != null) e.restSeconds = op.restSeconds
          exercises[idx] = e
        }
      }
    }
    return { ...sess, exercises }
  })
}

/**
 * Parsar ett <programswitch>...</programswitch>-block dar PT:n foreslar
 * att BYTA aktivt program. Validerar att det foreslagna programmet finns
 * (matchar pa namn mot availablePrograms), annars returneras null.
 *
 * Format:
 * <programswitch>
 * { "summary": "Byt till Helkropp 3x/vecka", "programName": "Helkropp" }
 * </programswitch>
 *
 * @param {string} aiText
 * @param {Array<{id:string,name:string}>} availablePrograms
 * @returns {{ displayText: string, programSwitch: object|null }}
 */
export function parseProgramSwitch(aiText, availablePrograms = []) {
  if (!aiText) return { displayText: aiText, programSwitch: null }
  const match = aiText.match(/<programswitch>\s*([\s\S]*?)\s*<\/programswitch>/i)
  if (!match) return { displayText: aiText, programSwitch: null }

  let programSwitch = null
  try {
    const parsed = JSON.parse(match[1].trim())
    const target = availablePrograms.find(p => p.name === parsed.programName)
    if (target) {
      programSwitch = {
        summary: typeof parsed.summary === 'string' ? parsed.summary : `Byt till ${target.name}`,
        programId: target.id,
        programName: target.name,
      }
    }
  } catch {
    // ogiltig JSON - ignorera
  }
  const displayText = aiText.replace(match[0], '').trim()
  return { displayText, programSwitch }
}

/**
 * Parsar ett <newprogram>...</newprogram>-block dar PT:n foreslar ett HELT
 * nytt program med flera pass. Varje ovning valideras mot availableNames -
 * ogiltiga ovningar slangs (inga orphans). Pass utan giltiga ovningar slangs.
 * Om inget giltigt aterstar returneras null.
 *
 * Format:
 * <newprogram>
 * {
 *   "name": "Helkropp 3x/vecka",
 *   "sessions": [
 *     { "name": "Pass A", "exercises": [
 *        { "name": "Knäböj", "workSets": 3, "repsMin": 5, "repsMax": 8, "restSeconds": 180 },
 *        { "name": "Bänkpress", "workSets": 3, "repsMin": 6, "repsMax": 10 }
 *     ]},
 *     { "name": "Pass B", "exercises": [ ... ] }
 *   ]
 * }
 * </newprogram>
 *
 * @param {string} aiText
 * @param {string[]} availableNames - giltiga ovningsnamn
 * @returns {{ displayText: string, newProgram: object|null, rejected: string[] }}
 */
export function parseNewProgram(aiText, availableNames = []) {
  if (!aiText) return { displayText: aiText, newProgram: null, rejected: [] }
  const match = aiText.match(/<newprogram>\s*([\s\S]*?)\s*<\/newprogram>/i)
  if (!match) return { displayText: aiText, newProgram: null, rejected: [] }

  const nameSet = new Set(availableNames)
  const rejected = []
  let newProgram = null
  try {
    const parsed = JSON.parse(match[1].trim())
    const rawSessions = Array.isArray(parsed.sessions) ? parsed.sessions : []
    const sessions = []
    for (const s of rawSessions) {
      if (!s || typeof s.name !== 'string') continue
      const rawEx = Array.isArray(s.exercises) ? s.exercises : []
      const exercises = []
      for (const e of rawEx) {
        if (!e || typeof e.name !== 'string') continue
        if (!nameSet.has(e.name)) { rejected.push(e.name); continue }
        exercises.push({
          name: e.name,
          notes: typeof e.notes === 'string' ? e.notes : '',
          repsMin: e.repsMin ?? 8,
          repsMax: e.repsMax ?? 12,
          workSets: e.workSets ?? 3,
          warmupSets: e.warmupSets ?? 2,
          backoffSets: e.backoffSets ?? 0,
          restSeconds: e.restSeconds ?? 120,
        })
      }
      // Hoppa over pass som inte fick nagra giltiga ovningar
      if (exercises.length > 0) sessions.push({ name: s.name, exercises })
    }
    if (sessions.length > 0 && typeof parsed.name === 'string' && parsed.name.trim()) {
      newProgram = { name: parsed.name.trim(), sessions }
    }
  } catch {
    // ogiltig JSON - ignorera
  }
  const displayText = aiText.replace(match[0], '').trim()
  return { displayText, newProgram, rejected }
}
