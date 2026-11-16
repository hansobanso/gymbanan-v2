import { describe, it, expect } from 'vitest'
import { figureIntensities } from './MuscleMap.jsx'

describe('figureIntensities', () => {
  it('ovre rygg ritas pa trapeziusytan, starkast vinner', () => {
    expect(figureIntensities({ 'Övre rygg': 0.6, Trapezius: 0.2 }).Trapezius).toBe(0.6)
    expect(figureIntensities({ 'Övre rygg': 0.6 })['Övre rygg']).toBeUndefined()
  })
  it('sma bidrag syns svagt', () => {
    expect(figureIntensities({ Core: 0.03 }).Core).toBe(0.12)
    expect(figureIntensities({ Core: 0 }).Core).toBeUndefined()
  })
})
