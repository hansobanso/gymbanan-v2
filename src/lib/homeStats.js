// Ren logik for startsidan (ingen React): veckoremsa, muskellage och
// passuppskattningar. Testas i homeStats.test.js.

import { SUBDIVISION_TO_BROAD } from '../data/muscleGroups.js'
import { EXERCISES } from '../data/exercises.js'
import { EXERCISE_ALIASES } from './exerciseAliases.js'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function mondayOf(now) {
  const day = now.getDay()
  const mon = startOfDay(now)
  mon.setDate(mon.getDate() - (day === 0 ? 6 : day - 1))
  return mon
}

const DAY_LETTERS = ['M', 'T', 'O', 'T', 'F', 'L', 'S']
const DAY_NAMES = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']

/**
 * De senaste veckorna (aldst forst, innevarande vecka sist), sju dagar var
 * (man-son) med dagens sparade pass. Inget mal och inget "missat": en dag ar
 * tranad, idag, eller tom.
 */
export function weekStrips(workouts, now = new Date(), weeks = 8) {
  const thisMon = mondayOf(now)
  const today = startOfDay(now).getTime()
  const byDay = new Map() // dagens midnatt -> [pass]
  for (const w of workouts ?? []) {
    if (!w.finished_at) continue
    const t = startOfDay(new Date(w.finished_at)).getTime()
    if (!byDay.has(t)) byDay.set(t, [])
    byDay.get(t).push(w)
  }
  const out = []
  for (let k = weeks - 1; k >= 0; k--) {
    const mon = new Date(thisMon); mon.setDate(thisMon.getDate() - 7 * k)
    const days = DAY_LETTERS.map((letter, i) => {
      // Rakna via datum (inte millisekunder) sa sommartid inte flyttar dagen.
      const d = new Date(mon); d.setDate(mon.getDate() + i)
      const key = startOfDay(d).getTime()
      const dayWorkouts = byDay.get(key) ?? []
      return {
        letter,
        name: DAY_NAMES[i],
        date: d,
        workouts: dayWorkouts,
        trained: dayWorkouts.length > 0,
        isToday: key === today,
        isFuture: key > today,
      }
    })
    out.push({
      week: isoWeekOf(mon).week,
      isCurrent: k === 0,
      days,
      count: days.filter(d => d.trained).length,
    })
  }
  return out
}

/** Innevarande vecka (se weekStrips). */
export function weekStrip(workouts, now = new Date()) {
  const cur = weekStrips(workouts, now, 1)[0]
  return { days: cur.days, count: cur.count }
}

// Muskelgrupper som visas pa startsidan. Vader bryts ut ur Ben eftersom
// de latt glöms bort och aterhamtar sig snabbt.
export const STATUS_GROUPS = ['Bröst', 'Rygg', 'Axlar', 'Armar', 'Ben', 'Vader', 'Bål']

// Vilotid i timmar innan gruppen raknas som redo igen.
const REST_HOURS = { 'Bröst': 72, 'Rygg': 72, 'Ben': 72, 'Axlar': 48, 'Armar': 48, 'Vader': 48, 'Bål': 48 }
// Ett pass med manga set pa samma grupp ger ett dygn extra.
const HEAVY_SETS = 10
const NEGLECTED_DAYS = 14

export function statusGroupOf(muscleGroup) {
  if (!muscleGroup) return null
  if (muscleGroup === 'Vader') return 'Vader'
  const broad = SUBDIVISION_TO_BROAD[muscleGroup]
  if (broad === 'Core') return 'Bål'
  if (broad === 'Övrigt' || !broad) return null
  return broad
}

function muscleOf(ex, exerciseMap) {
  const alias = EXERCISE_ALIASES[ex.name]
  const lib = exerciseMap?.[ex.name] ?? (alias ? exerciseMap?.[alias] : null)
  if (ex.is_cardio || lib?.is_cardio) return null
  return ex.muscle_group ?? lib?.muscle_group ?? EXERCISES[ex.name]?.muscle_group
    ?? (alias ? EXERCISES[alias]?.muscle_group : null) ?? null
}

function calendarDaysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS)
}

/**
 * Lage per muskelgrupp utifran senaste passen (nyast forst).
 *   state: 'ready'      aterhamtad, kan tranas
 *          'resting'    nyligen tranad, readyLabel sager nar den ar farsk
 *          'neglected'  inte tranad pa 14+ dagar (eller inte alls i historiken)
 *   days:  kalenderdagar sedan senast, null om gruppen saknas i historiken
 */
export function muscleStatus(workouts, exerciseMap, now = new Date()) {
  const last = {} // grupp -> { at, sets }
  for (const w of workouts ?? []) {
    if (!w.finished_at) continue
    const at = new Date(w.finished_at)
    const setsByGroup = {}
    for (const ex of w.exercises ?? []) {
      const g = statusGroupOf(muscleOf(ex, exerciseMap))
      if (!g) continue
      const n = (ex.sets ?? []).filter(s => s.done && s.type !== 'warmup').length
      if (n > 0) setsByGroup[g] = (setsByGroup[g] ?? 0) + n
    }
    for (const [g, sets] of Object.entries(setsByGroup)) {
      if (!last[g] || at > last[g].at) last[g] = { at, sets }
    }
  }

  return STATUS_GROUPS.map(group => {
    const l = last[group]
    if (!l) return { group, state: 'neglected', days: null, readyLabel: null }
    const days = calendarDaysBetween(l.at, now)
    const restMs = (REST_HOURS[group] + (l.sets >= HEAVY_SETS ? 24 : 0)) * HOUR_MS
    const readyAt = new Date(l.at.getTime() + restMs)
    if (readyAt > now) {
      const inDays = calendarDaysBetween(now, readyAt)
      const readyLabel = inDays <= 0 ? 'redo senare idag'
        : inDays === 1 ? 'redo imorgon'
        : `redo på ${DAY_NAMES[(readyAt.getDay() + 6) % 7]}`
      return { group, state: 'resting', days, readyLabel }
    }
    if (days >= NEGLECTED_DAYS) return { group, state: 'neglected', days, readyLabel: null }
    return { group, state: 'ready', days, readyLabel: null }
  })
}

/** "idag", "igår", "3 dagar", "22 dagar" */
export function daysLabel(days) {
  if (days == null) return ''
  if (days <= 0) return 'idag'
  if (days === 1) return 'igår'
  return `${days} dagar`
}

/** Passets langd i minuter, eller null. */
export function workoutMinutes(w) {
  if (!w?.finished_at || !w?.started_at) return null
  const mins = Math.round((new Date(w.finished_at) - new Date(w.started_at)) / 60000)
  return mins >= 1 ? mins : null
}

/** Antal PB-set i ett sparat pass. */
export function pbCount(w) {
  return (w?.exercises ?? []).reduce(
    (sum, ex) => sum + (ex.sets ?? []).filter(s => s.done && s.isPB).length, 0)
}

/**
 * Sammanfattning av ett programpass utifran historiken:
 *   last:     senaste sparade passet med samma namn (eller null)
 *   estMin:   typisk passlangd (median av upp till 5 senaste), avrundad till 5
 *   muscles:  de storsta muskelgrupperna i passet, i storleksordning
 *   preview:  [{ name, sets, weight, repsMin, repsMax }], weight = tyngsta vikten sist
 */
export function sessionSummary(session, workouts, exerciseMap) {
  const same = (workouts ?? []).filter(w => w.finished_at && w.session_name === session?.name)
  const last = same[0] ?? null

  const mins = same.slice(0, 5).map(workoutMinutes).filter(Boolean).sort((a, b) => a - b)
  const median = mins.length ? mins[Math.floor(mins.length / 2)] : null
  const estMin = median ? Math.max(5, Math.round(median / 5) * 5) : null

  const weightByGroup = {}
  for (const ex of session?.exercises ?? []) {
    const g = statusGroupOf(muscleOf(ex, exerciseMap))
    if (g) weightByGroup[g] = (weightByGroup[g] ?? 0) + (Number(ex.workSets) || 1)
  }
  const muscles = Object.entries(weightByGroup).sort((a, b) => b[1] - a[1]).map(([g]) => g)

  const lastByName = {}
  for (const ex of last?.exercises ?? []) {
    const ws = (ex.sets ?? []).filter(s => s.done && s.type === 'work' && s.subtype !== 'backoff')
    const best = Math.max(0, ...ws.map(s => parseFloat(s.weight) || 0))
    lastByName[ex.name] = best
  }
  const preview = (session?.exercises ?? []).map(ex => ({
    name: ex.name,
    sets: Number(ex.workSets) || 0,
    weight: lastByName[ex.name] ?? null,
    repsMin: ex.repsMin ?? null,
    repsMax: ex.repsMax ?? null,
  }))

  return { last, estMin, muscles, preview }
}

// ── Historik ──

function isoWeekOf(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / DAY_MS + 1) / 7) }
}

/** ISO-veckonummer for ett datum. */
export function isoWeek(date = new Date()) {
  return isoWeekOf(date).week
}

/**
 * Grupperar pass (nyast forst) per ISO-vecka, i samma ordning.
 * -> [{ key: '2026-46', week: 46, workouts: [...] }]
 */
export function groupByWeek(workouts) {
  const groups = []
  for (const w of workouts ?? []) {
    const { year, week } = isoWeekOf(new Date(w.started_at ?? w.finished_at))
    const key = `${year}-${week}`
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.workouts.push(w)
    else groups.push({ key, week, workouts: [w] })
  }
  return groups
}

const MONTHS = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December']

/** Summering av innevarande manad: antal pass, total tid och PB. */
export function monthStats(workouts, now = new Date()) {
  const inMonth = (workouts ?? []).filter(w => {
    const d = new Date(w.started_at ?? w.finished_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const minutes = inMonth.reduce((sum, w) => sum + (workoutMinutes(w) ?? 0), 0)
  return {
    month: MONTHS[now.getMonth()],
    count: inMonth.length,
    minutes,
    timeLabel: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`,
    pbs: inMonth.reduce((sum, w) => sum + pbCount(w), 0),
  }
}

/** "58 min", "1 h 57 min", "2 h" */
export function fmtMinutes(mins) {
  if (!mins) return null
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60), m = mins % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
