// Pling nar vilotiden ar ute.
//
// Vi anvander BARA Web Audio (en kort ton schemalagd vid sluttiden). Web
// Audio mixas med annat ljud pa iPhone, sa det pausar INTE Spotify/musik.
//
// Tidigare holls en tyst <audio>-loop igang i bakgrunden for att plinget
// skulle spela aven med slackt skarm - men ett <audio>-element tar over
// ljudsessionen pa iOS och pausar anvandarens musik. Det var fel pris, sa
// det ar borttaget. Nackdelen: med helt slackt skarm kan iOS frysa
// ljudklockan sa plinget uteblir eller kommer sent. Med skarmen pa (appen
// i forgrunden, som nar man tittar pa vilotimern) spelar det som det ska.

let ctx = null
let scheduled = []

function getCtx() {
  if (ctx) return ctx
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (AC) ctx = new AC()
  } catch { /* ingen web audio - strunta i ljud */ }
  return ctx
}

// Anropas fran anvandargesten nar vilan startar sa ljudkontexten lases upp.
export function primeRestSound() {
  const c = getCtx()
  try { if (c && c.state === 'suspended') c.resume() } catch { /* ignored */ }
}

// Schemalagg plinget vid given wall-clock-tid (Date.now()-ms). Avbryter ev.
// tidigare schemalagt pling forst (t.ex. nar man lagger till tid).
export function scheduleRestBeep(endEpochMs) {
  const c = getCtx()
  cancelRestBeep()
  if (!c) return
  try { if (c.state === 'suspended') c.resume() } catch { /* ignored */ }
  const offset = Math.max(0, (endEpochMs - Date.now()) / 1000)
  const when = c.currentTime + offset
  // Tre korta toner - tydligt men inte skrikigt.
  for (let i = 0; i < 3; i++) {
    try {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      const t = when + i * 0.2
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      osc.connect(gain); gain.connect(c.destination)
      osc.start(t)
      osc.stop(t + 0.18)
      scheduled.push(osc)
    } catch { /* ignored */ }
  }
}

// Avbryter schemalagt pling. Anropas vid stopp/paus/omschemalaggning.
export function cancelRestBeep() {
  for (const o of scheduled) {
    try { o.stop() } catch { /* ignored */ }
    try { o.disconnect() } catch { /* ignored */ }
  }
  scheduled = []
}

// Behalls for bakatkompatibilitet med useTimer (keep-alive finns inte langre).
export function endRestSound() { /* no-op */ }
