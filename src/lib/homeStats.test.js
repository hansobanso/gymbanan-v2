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
