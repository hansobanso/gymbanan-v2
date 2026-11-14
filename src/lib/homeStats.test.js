import { describe, it, expect } from 'vitest'
import { weekStrip, muscleStatus, sessionSummary, pbCount, statusGroupOf, daysLabel } from './homeStats.js'

// Torsdag 12 nov 2026 kl 18:00 lokal tid
const NOW = new Date(2026, 10, 12, 18, 0)
const at = (daysAgo, hour = 18) => new Date(2026, 10, 12 - daysAgo, hour, 0).toISOString()

const work = (n, extra = {}) => Array.from({ length: n }, () => ({ type: 'work', done: true, weight: 50, reps: 8, ...extra }))
const wo = (daysAgo, name, exercises, mins = 60) => ({
  session_name: name,
  finished_at: at(daysAgo),
  started_at: new Date(new Date(at(daysAgo)).getTime() - mins * 60000).toISOString(),
  exercises,
})

describe('weekStrip', () => {
  it('markerar tranade dagar och idag, utan mal', () => {
    const { days, count } = weekStrip([wo(3, 'A', []), wo(9, 'B', [])], NOW)
    expect(days.map(d => d.trained)).toEqual([true, false, false, false, false, false, false])
    expect(days[3].isToday).toBe(true)
    expect(days[4].isFuture).toBe(true)
    expect(count).toBe(1)
  })
  it('tva pass samma dag raknas som en tranad dag', () => {
    const { count } = weekStrip([wo(0, 'A', []), wo(0, 'B', [])], NOW)
    expect(count).toBe(1)
  })
  it('sondag hor till veckan som borjade i mandags', () => {
    const sunday = new Date(2026, 10, 15, 10, 0)
    const { days } = weekStrip([{ finished_at: new Date(2026, 10, 9, 9, 0).toISOString() }], sunday)
    expect(days[0].trained).toBe(true)
    expect(days[6].isToday).toBe(true)
  })
})

describe('muscleStatus', () => {
  const byGroup = rows => Object.fromEntries(rows.map(r => [r.group, r]))

  it('redo, vilar och inte tranad pa lange', () => {
    const rows = byGroup(muscleStatus([
      wo(1, 'A', [{ name: 'x', muscle_group: 'Quads', sets: work(4) }]),
      wo(5, 'B', [{ name: 'y', muscle_group: 'Bröst', sets: work(3) }]),
      wo(20, 'C', [{ name: 'z', muscle_group: 'Vader', sets: work(3) }]),
    ], {}, NOW))
    expect(rows.Ben.state).toBe('resting')
    expect(rows.Ben.readyLabel).toBe('redo på lördag')
    expect(rows['Bröst']).toMatchObject({ state: 'ready', days: 5 })
    expect(rows.Vader).toMatchObject({ state: 'neglected', days: 20 })
    expect(rows.Rygg).toMatchObject({ state: 'neglected', days: null })
  })

  it('liten grupp vilar 48 h, stor 72 h', () => {
    const rows = byGroup(muscleStatus([
      wo(2, 'A', [
        { name: 'a', muscle_group: 'Biceps', sets: work(3) },
        { name: 'b', muscle_group: 'Lats', sets: work(3) },
      ]),
    ], {}, NOW))
    expect(rows.Armar.state).toBe('ready')
    expect(rows.Rygg).toMatchObject({ state: 'resting', readyLabel: 'redo imorgon' })
  })

  it('manga set ger ett dygn extra', () => {
    const rows = byGroup(muscleStatus([
      wo(3, 'A', [{ name: 'a', muscle_group: 'Bröst', sets: work(10) }]),
    ], {}, NOW))
    expect(rows['Bröst'].state).toBe('resting')
  })

  it('uppvarmning och kardio raknas inte', () => {
    const rows = byGroup(muscleStatus([
      wo(0, 'A', [
        { name: 'a', muscle_group: 'Bröst', sets: [{ type: 'warmup', done: true }] },
        { name: 'b', muscle_group: 'Quads', is_cardio: true, sets: work(1) },
      ]),
    ], {}, NOW))
    expect(rows['Bröst'].days).toBe(null)
    expect(rows.Ben.days).toBe(null)
  })

  it('slar upp muskel via ovningsbiblioteket och gamla "Axlar"', () => {
    const rows = byGroup(muscleStatus([
      wo(4, 'A', [{ name: 'Okand press', sets: work(3) }, { name: 'q', muscle_group: 'Axlar', sets: work(2) }]),
    ], { 'Okand press': { muscle_group: 'Triceps' } }, NOW))
    expect(rows.Armar.state).toBe('ready')
    expect(rows.Axlar.state).toBe('ready')
  })
})

describe('statusGroupOf', () => {
  it('mappar undergrupper', () => {
    expect(statusGroupOf('Hamstrings')).toBe('Ben')
    expect(statusGroupOf('Vader')).toBe('Vader')
    expect(statusGroupOf('Core')).toBe('Bål')
    expect(statusGroupOf('Övrigt')).toBe(null)
    expect(statusGroupOf(undefined)).toBe(null)
  })
})

describe('sessionSummary', () => {
  const session = { name: 'Pass B', exercises: [
    { name: 'Lutande hantelpress', workSets: 3 },
    { name: 'Latsdrag', workSets: 3 },
    { name: 'Hantelcurl', workSets: 2 },
  ] }
  const map = {
    'Lutande hantelpress': { muscle_group: 'Bröst' },
    'Latsdrag': { muscle_group: 'Lats' },
    'Hantelcurl': { muscle_group: 'Biceps' },
  }
  const history = [
    wo(3, 'Pass A', []),
    wo(9, 'Pass B', [{ name: 'Lutande hantelpress', sets: [...work(2, { weight: 22 }), { type: 'work', subtype: 'backoff', done: true, weight: 30 }] }], 62),
    wo(16, 'Pass B', [], 48),
  ]

  it('hittar senaste passet, typisk tid, muskler och vikter', () => {
    const s = sessionSummary(session, history, map)
    expect(s.last.finished_at).toBe(history[1].finished_at)
    expect(s.estMin).toBe(60)
    expect(s.muscles.slice(0, 2).sort()).toEqual(['Bröst', 'Rygg'])
    expect(s.preview[0]).toMatchObject({ name: 'Lutande hantelpress', sets: 3, weight: 22 })
    expect(s.preview[1].weight).toBe(null)
  })

  it('tal ett pass som aldrig korts', () => {
    const s = sessionSummary(session, [], map)
    expect(s.last).toBe(null)
    expect(s.estMin).toBe(null)
  })
})

describe('smatt', () => {
  it('pbCount raknar PB-set', () => {
    expect(pbCount({ exercises: [{ sets: [{ done: true, isPB: true }, { done: true }, { done: false, isPB: true }] }] })).toBe(1)
  })
  it('daysLabel', () => {
    expect(daysLabel(0)).toBe('idag')
    expect(daysLabel(1)).toBe('igår')
    expect(daysLabel(9)).toBe('9 dagar')
  })
})

import { groupByWeek, monthStats, fmtMinutes, isoWeek } from './homeStats.js'

describe('historik', () => {
  const mk = (y, m, d, mins = 60, pb = 0) => ({
    started_at: new Date(y, m, d, 18, 0).toISOString(),
    finished_at: new Date(y, m, d, 18, mins).toISOString(),
    exercises: [{ sets: Array.from({ length: pb }, () => ({ done: true, isPB: true })) }],
  })
  it('grupperar per ISO-vecka, aven over arsskifte', () => {
    const g = groupByWeek([mk(2027, 0, 2), mk(2026, 11, 29), mk(2026, 11, 22)])
    expect(g.map(x => [x.week, x.workouts.length])).toEqual([[53, 2], [52, 1]])
  })
  it('isoWeek', () => {
    expect(isoWeek(new Date(2026, 10, 12))).toBe(46)
  })
  it('monthStats raknar bara innevarande manad', () => {
    const s = monthStats([mk(2026, 10, 12, 117, 2), mk(2026, 10, 3, 129, 1), mk(2026, 9, 29, 50, 3)], new Date(2026, 10, 13))
    expect(s).toMatchObject({ month: 'November', count: 2, minutes: 246, timeLabel: '4:06', pbs: 3 })
  })
  it('fmtMinutes', () => {
    expect(fmtMinutes(58)).toBe('58 min')
    expect(fmtMinutes(117)).toBe('1 h 57 min')
    expect(fmtMinutes(120)).toBe('2 h')
    expect(fmtMinutes(0)).toBe(null)
  })
})

import { weekStrips } from './homeStats.js'

describe('weekStrips', () => {
  it('ger aldst forst och lagger passen pa ratt dag', () => {
    const w = [wo(3, 'A', []), wo(9, 'B', []), wo(9, 'C', [])]
    const weeks = weekStrips(w, NOW, 3)
    expect(weeks.map(x => x.week)).toEqual([44, 45, 46])
    expect(weeks[2].isCurrent).toBe(true)
    expect(weeks[1].days[1].workouts.map(x => x.session_name)).toEqual(['B', 'C'])
    expect(weeks[1].count).toBe(1)
    expect(weeks[0].count).toBe(0)
  })
})

import { muscleDetail, withExtras } from './homeStats.js'

describe('muscleDetail', () => {
  const map = {
    'Hantelcurl': { muscle_group: 'Biceps' },
    'Triceps pushdown': { muscle_group: 'Triceps' },
    'Knäböj': { muscle_group: 'Quads' },
    'Vadpress': { muscle_group: 'Vader' },
    'Sittande vadpress': { muscle_group: 'Vader' },
    'Hammercurl': { muscle_group: 'Biceps' },
  }
  const program = { sessions: [
    { name: 'Pass A', exercises: [{ name: 'Knäböj', workSets: 3 }] },
    { name: 'Pass B', exercises: [{ name: 'Hantelcurl', workSets: 2, repsMin: 8, repsMax: 12 }, { name: 'Triceps pushdown', workSets: 2 }] },
  ] }
  const history = [
    wo(9, 'Pass B', [{ name: 'Hantelcurl', sets: [...work(1, { weight: 12, reps: 10 }), ...work(1, { weight: 14, reps: 8 })] }]),
    wo(30, 'Fritt', [{ name: 'Vadpress', sets: work(2, { weight: 80, reps: 10 }) }]),
  ]

  it('listar programmets ovningar for gruppen med senaste basta set', () => {
    const d = muscleDetail('Armar', program, program.sessions[0], history, map)
    expect(d.inProgram.map(r => r.name)).toEqual(['Hantelcurl', 'Triceps pushdown'])
    expect(d.inProgram[0]).toMatchObject({ sessions: ['Pass B'], inNext: false, repsMin: 8, repsMax: 12 })
    expect(d.inProgram[0].last).toMatchObject({ weight: 14, reps: 8, sets: 2 })
    expect(d.inProgram[1].last).toBe(null)
    expect(d.inNextSession).toBe(false)
    expect(d.suggestions).toEqual([])
  })
  it('markerar det som redan ligger i nasta pass', () => {
    const d = muscleDetail('Armar', program, program.sessions[1], history, map)
    expect(d.inProgram.every(r => r.inNext)).toBe(true)
    expect(d.inNextSession).toBe(true)
  })
  it('foreslar ur biblioteket nar programmet saknar gruppen, korda ovningar forst', () => {
    const d = muscleDetail('Vader', program, program.sessions[0], history, map)
    expect(d.inProgram).toEqual([])
    expect(d.suggestions.map(r => r.name)).toEqual(['Vadpress', 'Sittande vadpress'])
  })
  it('tal tomt program', () => {
    expect(muscleDetail('Bål', null, null, [], {})).toEqual({ inProgram: [], suggestions: [], inNextSession: false })
  })
})

describe('withExtras', () => {
  const s = { name: 'Pass A', exercises: [{ name: 'Knäböj' }] }
  it('lagger till sist utan dubbletter', () => {
    const out = withExtras(s, [{ name: 'Hantelcurl', extra: true }, { name: 'Knäböj', extra: true }])
    expect(out.exercises.map(e => e.name)).toEqual(['Knäböj', 'Hantelcurl'])
    expect(s.exercises).toHaveLength(1)
  })
  it('utan extra returneras passet oforandrat', () => {
    expect(withExtras(s, [])).toBe(s)
    expect(withExtras(null, [{ name: 'x' }])).toBe(null)
  })
})

import { weekReport } from './homeStats.js'

describe('weekReport', () => {
  const map = { 'Bänk': { muscle_group: 'Bröst' }, 'Rodd': { muscle_group: 'Lats' }, 'Curl': { muscle_group: 'Biceps' } }
  const week = [
    wo(1, 'B', [
      { name: 'Rodd', sets: work(4) },
      { name: 'Curl', sets: [...work(1, { weight: 12, reps: 10, isPB: true }), ...work(1, { weight: 14, reps: 8, isPB: true })] },
    ], 50),
    wo(3, 'A', [{ name: 'Bänk', sets: [{ type: 'warmup', done: true }, ...work(3), { type: 'work', done: false }] }], 70),
  ]
  it('summerar pass, tid, set, muskler och PB', () => {
    const r = weekReport(week, map)
    expect(r).toMatchObject({ count: 2, minutes: 120, sets: 9 })
    expect(r.groups).toEqual([{ group: 'Rygg', sets: 4 }, { group: 'Bröst', sets: 3 }, { group: 'Armar', sets: 2 }])
    expect(r.rested).toEqual(['Axlar', 'Ben', 'Vader', 'Bål'])
    expect(r.pbs).toEqual([{ name: 'Curl', weight: 14, reps: 8 }])
    expect(r.workouts.map(w => w.session_name)).toEqual(['A', 'B'])
  })
  it('tom vecka', () => {
    expect(weekReport([], map)).toMatchObject({ count: 0, minutes: 0, sets: 0, groups: [], rested: [], pbs: [] })
  })
})
