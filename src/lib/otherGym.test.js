import { describe, it, expect } from 'vitest'
import { isOtherGym, canBeOtherGym, knownMachineWeights } from './otherGym'
import { exerciseSeries } from './progressStats'

const set = (weight, reps) => ({ type: 'work', done: true, weight: String(weight), reps: String(reps) })
const wo = (id, daysAgo, exercises) => ({ id, finished_at: new Date(Date.now() - daysAgo * 864e5).toISOString(), exercises })

describe('annat gym', () => {
  it('kanns igen i bada stavningarna', () => {
    expect(isOtherGym({ other_gym: true })).toBe(true)
    expect(isOtherGym({ otherGym: true })).toBe(true)
    expect(isOtherGym({})).toBe(false)
    expect(canBeOtherGym('Maskin')).toBe(true)
    expect(canBeOtherGym('Skivstång')).toBe(false)
  })
  it('kanda vikter hoppar over annat gym', () => {
    const ws = [
      wo('a', 1, [{ name: 'Bicepscurl i maskin', other_gym: true, sets: [set(70, 10)] }]),
      wo('b', 5, [{ name: 'Bicepscurl i maskin', sets: [set(46, 10), set(52, 8)] }]),
    ]
    expect(knownMachineWeights(ws, new Set(['Bicepscurl i maskin']))).toEqual([46, 52])
  })
  it('kurvan hoppar over annat gym', () => {
    const ws = [
      wo('a', 1, [{ name: 'Bicepscurl i maskin', other_gym: true, sets: [set(90, 10)] }]),
      wo('b', 5, [{ name: 'Bicepscurl i maskin', sets: [set(46, 10)] }]),
    ]
    const s = exerciseSeries(ws).get('Bicepscurl i maskin')
    expect(s.points.length).toBe(1)
  })
})
