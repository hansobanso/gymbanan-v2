// Ren logik for Framsteg-vyn. Inga React-beroenden. Har tester.

const DAY = 24 * 60 * 60 * 1000
const BANANA_KG = 0.12 // en banan vager ungefar 120 g

const workSets = ex => (ex?.sets ?? []).filter(s => s.type === 'work' && s.done && parseInt(s.reps) > 0)

/** Epley-estimerat 1RM. */
export function e1rm(weight, reps) {
  const w = parseFloat(weight) || 0
  const r = parseInt(reps) || 0
  if (!w || !r) return 0
  return r === 1 ? w : w * (1 + r / 30)
}

/**
 * En tidsserie per ovning, aldst forst. Varde = basta estimerade 1RM i
 * passet, eller flest reps for ovningar som aldrig loggats med vikt.
 * Anpassade pass (latt dag, sjuk, deload) hoppas over: de ska inte se ut
 * som ett tapp.
 * @returns {Map<string, {mode: 'weight'|'reps', points: Array<{date: string, value: number}>}>}
 */
export function exerciseSeries(workouts) {
  const sorted = (workouts ?? []).filter(w => w.finished_at && !w.adjusted)
    .sort((a, b) => new Date(a.finished_at) - new Date(b.finished_at))
  const raw = new Map()
  for (const w of sorted) {
    for (const ex of w.exercises ?? []) {
      const sets = workSets(ex)
      if (!sets.length) continue
      const best = sets.reduce((m, s) => Math.max(m, e1rm(s.weight, s.reps)), 0)
      const reps = sets.reduce((m, s) => Math.max(m, parseInt(s.reps) || 0), 0)
      if (!raw.has(ex.name)) raw.set(ex.name, [])
      raw.get(ex.name).push({ date: w.finished_at, best, reps })
    }
  }
  const out = new Map()
  for (const [name, rows] of raw) {
    const mode = rows.some(r => r.best > 0) ? 'weight' : 'reps'
    const points = rows
      .map(r => ({ date: r.date, value: mode === 'weight' ? r.best : r.reps }))
      .filter(p => p.value > 0)
    if (points.length) out.set(name, { mode, points })
  }
  return out
}

const median = xs => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Oversikten for en period. days = null betyder all historik.
 *   lifts:    alla ovningar i perioden, senast korda forst, med forandring
 *             mellan periodens forsta och sista pass (null om bara ett pass)
 *   headline: medianforandring i procent over ovningar med minst tva pass
 *   movers:   de tre som okat mest
 *   pbs:      periodens PB, nyaste forst (ett per ovning och dag)
 */
export function progressOverview(workouts, days = 90, now = new Date()) {
  const since = days == null ? -Infinity : now.getTime() - days * DAY
  const inPeriod = (workouts ?? []).filter(w => w.finished_at && new Date(w.finished_at).getTime() >= since)

  const lifts = []
  for (const [name, { mode, points }] of exerciseSeries(inPeriod)) {
    const first = points[0], last = points[points.length - 1]
    const has = points.length >= 2
    lifts.push({
      name, mode, points,
      count: points.length,
      current: last.value,
      lastDate: last.date,
      change: has ? last.value - first.value : null,
      pct: has && first.value > 0 ? ((last.value - first.value) / first.value) * 100 : null,
    })
  }
  lifts.sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate) || a.name.localeCompare(b.name, 'sv'))

  const measured = lifts.filter(l => l.pct != null)
  const headline = measured.length ? { pct: median(measured.map(l => l.pct)), count: measured.length } : null
  const movers = measured.filter(l => l.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 3)

  let tonnage = 0
  const pbs = []
  for (const w of inPeriod) {
    for (const ex of w.exercises ?? []) {
      let top = null
      for (const s of workSets(ex)) {
        const weight = parseFloat(s.weight) || 0
        const reps = parseInt(s.reps) || 0
        tonnage += weight * reps
        if (s.isPB && (!top || weight > top.weight || (weight === top.weight && reps > top.reps))) top = { weight, reps }
      }
      if (top) pbs.push({ name: ex.name, date: w.finished_at, ...top })
    }
  }
  pbs.sort((a, b) => new Date(b.date) - new Date(a.date))

  return {
    lifts, headline, movers, pbs,
    count: inPeriod.length,
    tonnageKg: Math.round(tonnage),
    bananas: Math.round(tonnage / BANANA_KG),
  }
}

/** 84 300 kg -> "84 ton", 950 kg -> "950 kg" */
export function fmtTonnage(kg) {
  if (kg >= 10000) return `${Math.round(kg / 1000)} ton`
  if (kg >= 1000) return `${String(Math.round(kg / 100) / 10).replace('.', ',')} ton`
  return `${kg} kg`
}

/** 702500 -> "700 000", 8450 -> "8 500" (tva gallande siffror, lattlast) */
export function fmtRough(n) {
  if (n < 100) return String(n)
  const mag = Math.pow(10, Math.floor(Math.log10(n)) - 1)
  return String(Math.round(n / mag) * mag).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}
