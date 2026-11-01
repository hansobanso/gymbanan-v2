// Pling nar vilotiden ar ute - aven med slackt skarm (iPhone-PWA).
//
// Problemet: nar skarmen slacks fryser iOS vanliga timers (setInterval),
// sa vi kan inte "spela ljud nar left === 0" - den koden kors aldrig forran
// appen kommer i forgrunden igen.
//
// Losningen (tva delar som maste samverka):
//  1. Schemalagg sjalva plinget i Web Audio vid den EXAKTA sluttiden redan
//     nar vilan startar (osc.start(when)). Web Audio har en egen klocka och
//     spelar pa utsatt tid aven utan att JS kor.
//  2. Hall ljud-sessionen vid liv i bakgrunden med ett tyst loopande ljud.
//     Annars suspendar iOS hela AudioContext nar skarmen slacks, klockan
//     pausar och plinget kommer aldrig (eller for sent).
//
// Allt maste startas fran en anvandargest (tap) - vilotimern startar fran
// att man bockar av ett set, sa den gesten racker for att "lasa upp" ljudet.

let ctx = null
let keepAliveEl = null
let silentUrl = null
let scheduled = []

function getCtx() {
  if (ctx) return ctx
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (AC) ctx = new AC()
  } catch { /* ingen web audio - strunta i ljud */ }
  return ctx
}

// Bygger ett kort tyst WAV-ljud i minnet (blob-url) som keep-alive-loop.
function getSilentUrl() {
  if (silentUrl) return silentUrl
  try {
    const rate = 8000
    const n = Math.floor(0.5 * rate)
    const buf = new ArrayBuffer(44 + n * 2)
    const dv = new DataView(buf)
    const ws = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)) }
    ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE')
    ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true)
    dv.setUint16(22, 1, true); dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true)
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
    ws(36, 'data'); dv.setUint32(40, n * 2, true)
    // samplingarna ar redan 0 = tystnad
    silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
  } catch { /* ignored */ }
  return silentUrl
}

// Anropas fran anvandargesten nar vilan startar: skapa/resuma ljudkontext
// och forbered keep-alive-elementet.
export function primeRestSound() {
  const c = getCtx()
  try { if (c && c.state === 'suspended') c.resume() } catch { /* ignored */ }
  if (!keepAliveEl) {
    try {
      const url = getSilentUrl()
      if (url) {
        keepAliveEl = new Audio(url)
        keepAliveEl.loop = true
        keepAliveEl.volume = 0.02
        keepAliveEl.setAttribute('playsinline', '')
      }
    } catch { /* ignored */ }
  }
}

function startKeepAlive() {
  try { keepAliveEl?.play?.()?.catch?.(() => {}) } catch { /* ignored */ }
}

function stopKeepAlive() {
  try { keepAliveEl?.pause?.() } catch { /* ignored */ }
}

// Schemalagg plinget vid given wall-clock-tid (Date.now()-ms). Avbryter ev.
// tidigare schemalagt pling forst (t.ex. nar man lagger till tid).
export function scheduleRestBeep(endEpochMs) {
  const c = getCtx()
  cancelRestBeep()
  if (!c) return
  try { if (c.state === 'suspended') c.resume() } catch { /* ignored */ }
  startKeepAlive()
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

// Avbryter schemalagt pling och tystar keep-alive. Anropas vid stopp/paus.
export function cancelRestBeep() {
  for (const o of scheduled) {
    try { o.stop() } catch { /* ignored */ }
    try { o.disconnect() } catch { /* ignored */ }
  }
  scheduled = []
}

// Timern tog slut (eller stoppades) - sluta hall ljudsessionen vid liv.
export function endRestSound() {
  stopKeepAlive()
}
