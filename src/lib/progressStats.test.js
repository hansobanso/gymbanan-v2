import { describe, it, expect } from 'vitest'
import { e1rm, exerciseSeries, progressOverview, fmtTonnage, fmtRough } from './progressStats.js'

const NOW = new Date(2026, 10, 14, 12, 0)
const at = daysAgo => new Date(NOW.getTime() - daysAgo * 86400000).toISOString()
const set = (weight, reps, x = {}) => ({ type: 'work', done: true, weight: String(weight), reps: String(reps), ...x })
const wo = (daysAgo, exercises, x = {}) => ({ finished_at: at(daysAgo), exercises, ...x })

describe('e1rm', () => {
  it('Epley, en rep ar vikten sjalv', () => {
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(90, 10)).toBeCloseTo(120)
    expect(e1rm(0, 10)).toBe(0)
  })
})

describe('exerciseSeries', () => {
  it('aldst forst, basta set per pass, hoppar over anpassade pass och uppvarmning', () => {
    const s = exerciseSeries([
      wo(1, [{ name: 'Bänk', sets: [set(60, 10), set(60, 8)] }]),
      wo(5, [{ name: 'Bänk', sets: [set(40, 10)] }], { adjusted: true }),
      wo(9, [{ name: 'Bänk', sets: [{ type: 'warmup', done: true, weight: '100', reps: '5' }, set(55, 10), { ...set(80, 5), done: false }] }]),
    ])
    const b = s.get('Bänk')
    expect(b.mode).toBe('weight')
    expect(b.points.map(p => Math.round(p.value))).toEqual([73, 80])
  })
  it('kroppsvikt raknas i reps', () => {
    const s = exerciseSeries([wo(2, [{ name: 'Chins', sets: [set(0, 8), set(0, 6)] }]), wo(9, [{ name: 'Chins', sets: [set(0, 7)] }])])
    expect(s.get('Chins')).toMatchObject({ mode: 'reps', points: [{ value: 7 }, { value: 8 }] })
  })
})

describe('progressOverview', () => {
  const history = [
    wo(2, [{ name: 'Bänk', sets: [set(66, 10, { isPB: true })] }, { name: 'Rodd', sets: [set(50, 10)] }]),
    wo(30, [{ name: 'Bänk', sets: [set(60, 10)] }, { name: 'Rodd', sets: [set(50, 10)] }, { name: 'Curl', sets: [set(12, 10)] }]),
    wo(200, [{ name: 'Bänk', sets: [set(40, 10)] }]),
  ]
  it('rubrik, storst okning, PB och ton for perioden', () => {
    const o = progressOverview(history, 90, NOW)
    expect(o.count).toBe(2)
    expect(o.lifts.map(l => l.name)).toEqual(['Bänk', 'Rodd', 'Curl'])
    expect(o.lifts[0]).toMatchObject({ count: 2 })
    expect(Math.round(o.lifts[0].pct)).toBe(10)
    expect(o.lifts[2]).toMatchObject({ change: null, pct: null })
    expect(o.headline.count).toBe(2)
    expect(Math.round(o.headline.pct)).toBe(5)
    expect(o.movers.map(l => l.name)).toEqual(['Bänk'])
    expect(o.pbs).toEqual([{ name: 'Bänk', date: history[0].finished_at, weight: 66, reps: 10 }])
    expect(o.tonnageKg).toBe(660 + 500 + 600 + 500 + 120)
    expect(o.bananas).toBe(Math.round(2380 / 0.12))
  })
  it('all historik med days = null', () => {
    const o = progressOverview(history, null, NOW)
    expect(o.count).toBe(3)
    expect(Math.round(o.lifts[0].pct)).toBe(65)
  })
  it('tom historik', () => {
    expect(progressOverview([], 90, NOW)).toMatchObject({ lifts: [], headline: null, movers: [], pbs: [], count: 0, tonnageKg: 0 })
  })
})

describe('format', () => {
  it('fmtTonnage', () => {
    expect(fmtTonnage(950)).toBe('950 kg')
    expect(fmtTonnage(8450)).toBe('8,5 ton')
    expect(fmtTonnage(84300)).toBe('84 ton')
  })
  it('fmtRough', () => {
    expect(fmtRough(42)).toBe('42')
    expect(fmtRough(8450)).toBe('8 500')
    expect(fmtRough(702500)).toBe('700 000')
  })
})
