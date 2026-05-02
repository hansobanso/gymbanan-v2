import { describe, it, expect } from 'vitest'
import {
  computeProgression,
  deriveCategory,
  epley1RM,
  epleyAdjustedReps,
} from './progression'

// Hjalpfunktion: bygg ett work set
function workSet(weight, reps, rir = null) {
  return { type: 'work', subtype: null, weight: String(weight), reps: String(reps), rir, done: true }
}

// ─── deriveCategory ────────────────────────────────────────────

describe('deriveCategory', () => {
  it('Skivstång + Press = heavy_compound', () => {
    expect(deriveCategory('Skivstång', 'Press')).toBe('heavy_compound')
  })
  it('Skivstång + Squat = heavy_compound', () => {
    expect(deriveCategory('Skivstång', 'Squat')).toBe('heavy_compound')
  })
  it('Skivstång + Hinge = heavy_compound', () => {
    expect(deriveCategory('Skivstång', 'Hinge')).toBe('heavy_compound')
  })
  it('Hantel + Press = heavy_compound', () => {
    expect(deriveCategory('Hantel', 'Press')).toBe('heavy_compound')
  })
  it('Hantel + Carry = compound', () => {
    expect(deriveCategory('Hantel', 'Carry')).toBe('compound')
  })
  it('Maskin + Press = isolation_or_machine', () => {
    expect(deriveCategory('Maskin', 'Press')).toBe('isolation_or_machine')
  })
  it('Kabel + Drag = isolation_or_machine', () => {
    expect(deriveCategory('Kabel', 'Drag')).toBe('isolation_or_machine')
  })
  it('Kroppsvikt + Press = compound (dips)', () => {
    expect(deriveCategory('Kroppsvikt', 'Press')).toBe('compound')
  })
  it('null + null = isolation_or_machine (default)', () => {
    expect(deriveCategory(null, null)).toBe('isolation_or_machine')
  })
})

// ─── Epley ─────────────────────────────────────────────────────

describe('epley1RM', () => {
  it('beräknar korrekt 1RM', () => {
    // 80 kg × 10 reps → 80 * (1 + 10/30) = 80 * 1.333 = 106.67
    expect(epley1RM(80, 10)).toBeCloseTo(106.67, 1)
  })
  it('1 rep = weight', () => {
    expect(epley1RM(100, 1)).toBe(100)
  })
  it('0 vikt = 0', () => {
    expect(epley1RM(0, 10)).toBe(0)
  })
})

describe('epleyAdjustedReps', () => {
  it('lägre vikt = fler reps', () => {
    // 12.5 × 10 → e1RM = 12.5 * (1 + 10/30) = 16.67
    // 12 → 30 * (16.67/12 - 1) = 30 * 0.389 = 11.67 → 12
    expect(epleyAdjustedReps(12.5, 10, 12)).toBe(12)
  })
  it('högre vikt = färre reps', () => {
    expect(epleyAdjustedReps(12, 12, 12.5)).toBeLessThan(12)
  })
  it('samma vikt = samma reps', () => {
    expect(epleyAdjustedReps(80, 10, 80)).toBe(10)
  })
  it('clamp min 1', () => {
    expect(epleyAdjustedReps(50, 5, 200)).toBe(1)
  })
  it('clamp max 30', () => {
    expect(epleyAdjustedReps(100, 10, 10)).toBe(30)
  })
})

// ─── computeProgression ───────────────────────────────────────

describe('computeProgression', () => {

  // ── Ingen data ──
  it('first_time: inga prev-sets', () => {
    const result = computeProgression({ repsMin: 8, repsMax: 12, numWorkSets: 2 })
    expect(result.action).toBe('first_time')
    expect(result.nextTargetRepsPerSet).toEqual([8, 8])
  })

  // ── Punkt 2: totalreps ökar → behåll vikt ──
  it('keep_weight_add_reps: totalreps ökar', () => {
    const prev = [workSet(80, 10), workSet(80, 9)]
    const result = computeProgression({
      prevSets: prev, repsMin: 8, repsMax: 12, numWorkSets: 2,
    })
    expect(result.action).toBe('keep_weight_add_reps')
    expect(result.nextWeight).toBe(80)
    expect(result.nextTargetTotalReps).toBe(20) // 19 + 1
    expect(result.messageToUser).toContain('80 kg')
  })

  // ── Punkt 3: alla set vid repMax → höj vikt ──
  it('increase_weight: alla set vid repMax', () => {
    const prev = [workSet(80, 12), workSet(80, 12)]
    const result = computeProgression({
      prevSets: prev, repsMin: 8, repsMax: 12, numWorkSets: 2,
      category: 'isolation_or_machine',
    })
    expect(result.action).toBe('increase_weight')
    expect(result.nextWeight).toBe(82.5)
    expect(result.nextTargetRepsPerSet).toEqual([8, 8])
  })

  // ── Punkt 4: heavy_compound + 0 RIR → upprepa ──
  it('repeat_weight: heavy_compound + 0 RIR', () => {
    const prev = [workSet(80, 12, 0), workSet(80, 12, 0)]
    const result = computeProgression({
      prevSets: prev, repsMin: 8, repsMax: 12, numWorkSets: 2,
      category: 'heavy_compound',
    })
    expect(result.action).toBe('repeat_weight')
    expect(result.nextWeight).toBe(80)
    expect(result.messageToUser).toContain('Upprepa')
  })

  // ── Punkt 4b: heavy_compound utan RIR → buffert ──
  it('keep_weight_add_reps: heavy_compound utan RIR, behöver buffert', () => {
    // 12+12=24, men buffert kräver 25
    const prev = [workSet(80, 12), workSet(80, 12)]
    const result = computeProgression({
      prevSets: prev, repsMin: 8, repsMax: 12, numWorkSets: 2,
      category: 'heavy_compound',
    })
    expect(result.action).toBe('keep_weight_add_reps')
    expect(result.nextTargetTotalReps).toBe(25) // 12*2 + 1
  })

  // heavy_compound utan RIR men redan vid buffert → höj
  it('increase_weight: heavy_compound utan RIR, redan vid buffert', () => {
    const prev = [workSet(80, 13), workSet(80, 12)]
    const result = computeProgression({
      prevSets: prev, repsMin: 8, repsMax: 12, numWorkSets: 2,
      category: 'heavy_compound',
    })
    // totalReps = 25, buffert = 25, ska passera
    expect(result.action).toBe('increase_weight')
  })

  // heavy_compound MED RIR > 0 → höj direkt
  it('increase_weight: heavy_compound med RIR > 0', () => {
    const prev = [workSet(80, 12, 2), workSet(80, 12, 1)]
    const result = computeProgression({
      prevSets: prev, repsMin: 8, repsMax: 12, numWorkSets: 2,
      category: 'heavy_compound',
    })
    expect(result.action).toBe('increase_weight')
  })

  // ── Punkt 5: stort viktsteg → extra reps ──
  it('keep_weight_add_reps: stort viktsteg kräver extra reps', () => {
    // 10 kg → 12.5 kg = 25% hopp → +4 extra → 24+4 = 28
    const prev = [workSet(10, 12), workSet(10, 12)]
    const result = computeProgression({
      prevSets: prev, repsMin: 8, repsMax: 12, numWorkSets: 2,
      category: 'isolation_or_machine', weightIncrement: 2.5,
    })
    expect(result.action).toBe('keep_weight_add_reps')
    expect(result.nextTargetTotalReps).toBe(28) // 24 + 4 (>20% hopp)
  })

  it('keep_weight_add_reps: medel viktsteg kräver +2', () => {
    // 20 kg → 22.5 kg = 12.5% hopp → +2 extra → 24+2 = 26
    const prev = [workSet(20, 12), workSet(20, 12)]
    const result = computeProgression({
      prevSets: prev, repsMin: 8, repsMax: 12, numWorkSets: 2,
      category: 'isolation_or_machine', weightIncrement: 2.5,
    })
    expect(result.action).toBe('keep_weight_add_reps')
    expect(result.nextTargetTotalReps).toBe(26) // 24 + 2 (10-20% hopp)
  })

  it('increase_weight: litet viktsteg (<=10%), höj direkt', () => {
    // 40 kg → 42.5 kg = 6.25% hopp → normalt
    const prev = [workSet(40, 12), workSet(40, 12)]
    const result = computeProgression({
      prevSets: prev, repsMin: 8, repsMax: 12, numWorkSets: 2,
      category: 'isolation_or_machine', weightIncrement: 2.5,
    })
    expect(result.action).toBe('increase_weight')
    expect(result.nextWeight).toBe(42.5)
  })

  // ── Punkt 6: under repMin ──
  it('keep_weight_add_reps: under repMin en gång', () => {
    const prev = [workSet(80, 7), workSet(80, 9)]
    const result = computeProgression({
      prevSets: prev, repsMin: 8, repsMax: 12, numWorkSets: 2,
    })
    expect(result.action).toBe('keep_weight_add_reps')
    expect(result.messageToUser).toContain('under')
  })

  it('too_heavy_flag: under repMin två pass i rad', () => {
    const prev = [workSet(80, 7), workSet(80, 6)]
    const prevPrev = [workSet(80, 7), workSet(80, 7)]
    const result = computeProgression({
      prevSets: prev, prevPrevSets: prevPrev, repsMin: 8, repsMax: 12, numWorkSets: 2,
    })
    expect(result.action).toBe('too_heavy_flag')
    expect(result.nextWeight).toBe(77.5)
  })

  // ── Edge cases ──

  it('fler än 2 set', () => {
    const prev = [workSet(60, 10), workSet(60, 9), workSet(60, 8)]
    const result = computeProgression({
      prevSets: prev, repsMin: 8, repsMax: 12, numWorkSets: 3,
    })
    expect(result.action).toBe('keep_weight_add_reps')
    expect(result.nextTargetTotalReps).toBe(28) // 27 + 1
    expect(result.nextTargetRepsPerSet.length).toBe(3)
  })

  it('kroppsvikt (vikt = 0)', () => {
    const prev = [workSet(0, 12), workSet(0, 12)]
    const result = computeProgression({
      prevSets: prev, repsMin: 8, repsMax: 12, numWorkSets: 2,
      category: 'compound',
    })
    expect(result.action).toBe('increase_weight')
    expect(result.nextWeight).toBe(2.5) // börja adda vikt
  })

  it('saknat repintervall (repsMin/Max = null)', () => {
    const prev = [workSet(50, 10), workSet(50, 9)]
    const result = computeProgression({
      prevSets: prev, repsMin: null, repsMax: null, numWorkSets: 2,
    })
    expect(result.action).toBe('keep_weight_add_reps')
    expect(result.nextTargetTotalReps).toBe(20) // 19 + 1
  })

  it('bara warmup-sets returnerar first_time', () => {
    const prev = [
      { type: 'warmup', weight: '40', reps: '10', done: true, rir: null, subtype: null },
    ]
    const result = computeProgression({ prevSets: prev, repsMin: 8, repsMax: 12, numWorkSets: 2 })
    expect(result.action).toBe('first_time')
  })

  it('mixed set-typer filtrerar korrekt', () => {
    const prev = [
      { type: 'warmup', weight: '40', reps: '10', done: true, rir: null, subtype: null },
      workSet(80, 10),
      workSet(80, 9),
      { type: 'work', subtype: 'backoff', weight: '60', reps: '12', done: true, rir: null },
    ]
    const result = computeProgression({
      prevSets: prev, repsMin: 8, repsMax: 12, numWorkSets: 2,
    })
    expect(result.action).toBe('keep_weight_add_reps')
    expect(result.nextTargetTotalReps).toBe(20) // 19 + 1 (bara work, ej warmup/backoff)
  })
})
