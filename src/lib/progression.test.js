import { describe, it, expect } from 'vitest'
import {
  computeProgression,
  deriveCategory,
  epley1RM,
  epleyAdjustedReps,
  detectGapAdjustment,
  suggestNextSetReps,
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
    expect(result.messageToUser).toMatch(/upprepa/i)
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

// ─── Rep-fordelning, RIR-skalning och sparrar ──────────────────

describe('progression: fordelning och RIR', () => {
  const base = { repsMin: 6, repsMax: 8, category: 'isolation_or_machine', weightIncrement: 2.5, numWorkSets: 3 }
  const sets = (w, reps, rir) => reps.map(r => workSet(w, r, rir))

  it('rep-okningen laggs pa sista setet (7+7+7 -> 7+7+8)', () => {
    const r = computeProgression({ ...base, prevSets: sets(100, [7, 7, 7], 1) })
    expect(r.nextTargetRepsPerSet).toEqual([7, 7, 8])
  })

  it('snitt-RIR >= 3 ger +2 reps', () => {
    const r = computeProgression({ ...base, prevSets: sets(100, [7, 7, 7], 3) })
    expect(r.nextTargetRepsPerSet).toEqual([7, 8, 8])
  })

  it('0 RIR under taket: befast samma mal EN gang', () => {
    const prev = sets(100, [7, 7, 7], 0)
    const first = computeProgression({ ...base, prevSets: prev })
    expect(first.nextTargetRepsPerSet).toEqual([7, 7, 7])
    expect(first.reason).toBe('reps_hold_zero_rir')
    // Samma resultat tva pass i rad -> ga vidare, fastna inte
    const second = computeProgression({ ...base, prevSets: prev, prevPrevSets: prev })
    expect(second.nextTargetRepsPerSet).toEqual([7, 7, 8])
  })

  it('0 RIR pa taket: upprepa vikten EN gang, hoj sedan', () => {
    const prev = sets(100, [8, 8, 8], 0)
    const first = computeProgression({ ...base, prevSets: prev })
    expect(first.action).toBe('repeat_weight')
    const second = computeProgression({ ...base, prevSets: prev, prevPrevSets: prev })
    expect(second.action).toBe('increase_weight')
    expect(second.nextWeight).toBe(102.5)
  })

  it('andrat antal set skalar om totalen (3 set forra gangen, 1 set nu)', () => {
    const r = computeProgression({ ...base, numWorkSets: 1, repsMin: null, repsMax: null, prevSets: sets(100, [8, 8, 8], 1) })
    expect(r.nextTargetRepsPerSet).toEqual([9]) // inte 25 reps pa ett set
  })

  it('andrat antal set: 3 -> 4 set ger rimliga reps per set', () => {
    const r = computeProgression({ ...base, numWorkSets: 4, prevSets: sets(100, [7, 7, 7], 1) })
    expect(r.nextTargetRepsPerSet).toEqual([7, 7, 7, 8])
  })
})

describe('detectGapAdjustment', () => {
  const daysAgo = d => new Date(Date.now() - d * 86400000).toISOString()

  it('ingen sankning nar man tranat nyligen', () => {
    expect(detectGapAdjustment([{ finished_at: daysAgo(2), adjusted: false }], ['Bänkpress'])).toBeNull()
  })

  it('8-14 dagars uppehall: samma som sist (ingen sankning)', () => {
    const adj = detectGapAdjustment([{ finished_at: daysAgo(9), adjusted: false }], ['Bänkpress'])
    expect(adj.hold).toBe(true)
    expect(adj.changes).toEqual([])
    expect(adj.days).toBe(9)
  })

  it('15-28 dagar ger -10%, over 28 dagar -20%', () => {
    const a = detectGapAdjustment([{ finished_at: daysAgo(20), adjusted: false }], ['Bänkpress'])
    expect(a.hold).toBe(false)
    expect(a.changes[0].weightMultiplier).toBe(0.9)
    const b = detectGapAdjustment([{ finished_at: daysAgo(40), adjusted: false }], ['Bänkpress'])
    expect(b.changes[0].weightMultiplier).toBe(0.8)
  })

  it('deload-/sjukpass raknas som traning (ingen comeback-sankning efter deload-vecka)', () => {
    const recent = [
      { finished_at: daysAgo(2), adjusted: true },
      { finished_at: daysAgo(10), adjusted: false },
    ]
    expect(detectGapAdjustment(recent, ['Bänkpress'])).toBeNull()
  })
})

describe('suggestNextSetReps', () => {
  it('0 RIR: ett rep mindre nasta set (8 reps -> 7)', () => {
    expect(suggestNextSetReps({ doneReps: 8, doneRir: 0, donePlanReps: 8, nextPlanReps: 8 })).toBe(7)
    expect(suggestNextSetReps({ doneReps: 8, doneRir: 0, donePlanReps: 8, nextPlanReps: 9 })).toBe(7)
  })
  it('1 RIR: inte fler reps an man just gjorde', () => {
    expect(suggestNextSetReps({ doneReps: 7, doneRir: 1, donePlanReps: 7, nextPlanReps: 8 })).toBe(7)
  })
  it('enligt plan med marginal eller utan RIR: planens mal behalls (7 + 7 + 8)', () => {
    expect(suggestNextSetReps({ doneReps: 7, doneRir: null, donePlanReps: 7, nextPlanReps: 8 })).toBe(8)
    expect(suggestNextSetReps({ doneReps: 7, doneRir: 3, donePlanReps: 7, nextPlanReps: 8 })).toBe(8)
  })
  it('missad plan: forvanta inte mer nasta set', () => {
    expect(suggestNextSetReps({ doneReps: 5, doneRir: null, donePlanReps: 7, nextPlanReps: 7 })).toBe(5)
  })
  it('hogre an plan sanker aldrig nasta mal under planen i onodan', () => {
    expect(suggestNextSetReps({ doneReps: 9, doneRir: 2, donePlanReps: 7, nextPlanReps: 7 })).toBe(7)
  })
  it('utan plan: utga fran gjorda reps, aldrig under 1', () => {
    expect(suggestNextSetReps({ doneReps: 10, doneRir: null })).toBe(10)
    expect(suggestNextSetReps({ doneReps: 10, doneRir: 0 })).toBe(9)
    expect(suggestNextSetReps({ doneReps: 1, doneRir: 0 })).toBe(1)
  })
})

import { warmupPlan } from './progression.js'

describe('warmupPlan', () => {
  it('standardsteg for 1, 2 och 3 set', () => {
    expect(warmupPlan({ workWeight: 100, count: 1 })).toEqual([{ weight: 60, reps: 8 }])
    expect(warmupPlan({ workWeight: 100, count: 2 })).toEqual([{ weight: 50, reps: 8 }, { weight: 75, reps: 4 }])
    expect(warmupPlan({ workWeight: 100, count: 3 }).map(s => s.weight)).toEqual([40, 60, 80])
  })
  it('rundar till viktsteget', () => {
    expect(warmupPlan({ workWeight: 22, count: 2, increment: 2 })).toEqual([{ weight: 12, reps: 8 }, { weight: 16, reps: 4 }])
    expect(warmupPlan({ workWeight: 55, count: 1, increment: 5 })[0].weight).toBe(35)
  })
  it('alltid lagre an arbetsvikten, annars inget forslag', () => {
    expect(warmupPlan({ workWeight: 4, count: 2, increment: 2 })).toEqual([{ weight: 2, reps: 8 }, { weight: 2, reps: 4 }])
    expect(warmupPlan({ workWeight: 2, count: 1, increment: 2 })).toEqual([null])
    expect(warmupPlan({ workWeight: 0, count: 2 })).toEqual([null, null])
    expect(warmupPlan({ workWeight: 100, count: 0 })).toEqual([])
  })
  it('behaller egen andel och reps fran forra passet', () => {
    const prev = [{ weight: '40', reps: '10', done: true }]
    expect(warmupPlan({ workWeight: 80, count: 1, prevWarmups: prev, prevWorkWeight: 80 })).toEqual([{ weight: 40, reps: 10 }])
    expect(warmupPlan({ workWeight: 90, count: 1, prevWarmups: prev, prevWorkWeight: 80 })).toEqual([{ weight: 45, reps: 10 }])
  })
  it('ogjord eller tom uppvarmning forra gangen ger standardsteg', () => {
    const prev = [{ weight: '40', reps: '10', done: false }, { weight: '', reps: '', done: true }]
    expect(warmupPlan({ workWeight: 80, count: 2, prevWarmups: prev, prevWorkWeight: 80 })).toEqual([{ weight: 40, reps: 8 }, { weight: 60, reps: 4 }])
  })
  it('fler an tre set gar fran 40 till 80 procent', () => {
    const p = warmupPlan({ workWeight: 100, count: 4 })
    expect(p[0].weight).toBe(40)
    expect(p[3].weight).toBe(80)
    expect(p[3].reps).toBe(2)
  })
})
