/**
 * Smart Double Progression Engine
 *
 * Beraknar nasta vikt + repmaal baserat pa tidigare prestation.
 * Ren logik — ingen React, inga DB-anrop, inga sidoeffekter.
 *
 * Inkopplad i useWorkout.js via loadExerciseData().
 * weight_increment per ovning (default via equipment), Epley-omrakning aktiv.
 */

// ─── Kategori-harleding ────────────────────────────────────────
// Harled ovningskategori fran equipment + movement_pattern.
// Undviker hardkodad lista — skalbart nar nya ovningar laggs till.

export function deriveCategory(equipment, movementPattern) {
  const eq = (equipment ?? '').toLowerCase()
  const mp = (movementPattern ?? '').toLowerCase()

  // Skivstangs-flerledsovningar ar alltid tunga
  if (eq === 'skivstång') {
    if (['press', 'squat', 'hinge', 'drag'].includes(mp)) return 'heavy_compound'
    return 'compound'
  }

  // Tunga hantelovningar (press/drag/hinge/carry) raknas som compound eller heavy
  if (eq === 'hantel') {
    if (['press', 'hinge', 'drag'].includes(mp)) return 'heavy_compound'
    if (mp === 'carry') return 'compound'
  }

  // Maskin och kabel ar alltid isolation_or_machine oavsett monster
  if (['maskin', 'kabel'].includes(eq)) return 'isolation_or_machine'

  // Kroppsvikt med flerled (dips, chins etc) ar compound
  if (eq === 'kroppsvikt' && ['press', 'drag', 'squat'].includes(mp)) return 'compound'

  // Allt med flerledsmonster ar compound
  if (['press', 'drag', 'squat', 'hinge'].includes(mp)) return 'compound'

  // Default: isolation
  return 'isolation_or_machine'
}

// ─── Hjalpfunktioner ───────────────────────────────────────────

function totalReps(sets) {
  return sets.reduce((sum, s) => sum + (parseInt(s.reps) || 0), 0)
}

function allSetsAtMax(sets, repsMax) {
  if (repsMax == null) return false
  return sets.length > 0 && sets.every(s => (parseInt(s.reps) || 0) >= repsMax)
}

function anySetsUnderMin(sets, repsMin) {
  if (repsMin == null) return false
  return sets.some(s => {
    const r = parseInt(s.reps) || 0
    return s.done && r > 0 && r < repsMin
  })
}

function averageRIR(sets) {
  const rirVals = sets
    .filter(s => s.rir != null && s.rir !== '' && s.done)
    .map(s => parseFloat(s.rir))
    .filter(v => !isNaN(v))
  if (rirVals.length === 0) return null
  return rirVals.reduce((a, b) => a + b, 0) / rirVals.length
}

function allSetsZeroRIR(sets) {
  const rirVals = sets
    .filter(s => s.done)
    .map(s => s.rir != null && s.rir !== '' ? parseFloat(s.rir) : null)
  // Alla set maste ha RIR=0, och minst ett set maste ha RIR-data
  if (rirVals.every(v => v === null)) return false
  return rirVals.every(v => v === 0 || v === null)
}

// Har samma prestation redan upprepats? Sant om passet FORE forra hade
// samma vikt och minst lika manga totalreps. Anvands sa "befast"-sparrarna
// (0 RIR) bara haller igen EN gang - annars fastnar den som alltid tranar
// till failure pa samma vikt och reps for evigt.
function alreadyRepeated(workSets, prevPrevSets) {
  const pp = (prevPrevSets ?? []).filter(s =>
    s.type === 'work' && s.subtype !== 'backoff' && s.done
  )
  if (pp.length === 0 || workSets.length === 0) return false
  const w = parseFloat(workSets[0].weight) || 0
  const ppw = parseFloat(pp[0].weight) || 0
  return ppw === w && totalReps(pp) >= totalReps(workSets)
}

// Berakna viktstegets procentuella storlek
function weightJumpPercent(currentWeight, nextWeight) {
  if (!currentWeight || currentWeight <= 0) return 0
  return ((nextWeight - currentWeight) / currentWeight) * 100
}

// Runda vikt till narmaste steg (default 2.5 kg)
function roundToIncrement(weight, increment = 2.5) {
  return Math.round(weight / increment) * increment
}

// Epley 1RM-uppskattning
export function epley1RM(weight, reps) {
  if (!weight || weight <= 0 || !reps || reps <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

// Epley-baserad repomrakning vid viktandring
export function epleyAdjustedReps(plannedWeight, plannedReps, actualWeight) {
  if (!plannedWeight || plannedWeight <= 0 || !actualWeight || actualWeight <= 0) return plannedReps
  if (plannedWeight === actualWeight) return plannedReps

  const e1rm = epley1RM(plannedWeight, plannedReps)
  if (e1rm <= 0 || actualWeight >= e1rm) return 1

  const adjusted = Math.round(30 * (e1rm / actualWeight - 1))
  return Math.max(1, Math.min(30, adjusted))
}


// ─── Huvudfunktion ─────────────────────────────────────────────

/**
 * Beraknar progressionsforslag for en ovning.
 *
 * @param {Object} params
 * @param {Array}  params.prevSets        - Forra passets set [{weight, reps, rir, type, subtype, done}]
 * @param {Array}  params.prevPrevSets    - Passet fore det (for "under repMin 2 pass i rad"). null = okant.
 * @param {number} params.repsMin         - Undre gransen av repintervallet
 * @param {number} params.repsMax         - Ovre gransen av repintervallet
 * @param {string} params.category        - 'heavy_compound' | 'compound' | 'isolation_or_machine'
 * @param {number} params.weightIncrement - Tillgangligt viktsteg (default 2.5)
 * @param {number} params.numWorkSets     - Antal work sets i nuvarande program (for maalberakning)
 *
 * @returns {Object} Progressionsforslag
 */
export function computeProgression({
  prevSets = [],
  prevPrevSets = null,
  repsMin = null,
  repsMax = null,
  category = 'compound',
  weightIncrement = 2.5,
  numWorkSets = 2,
}) {
  // ── Edge case: inga prev-sets ──
  if (!prevSets || prevSets.length === 0) {
    return {
      action: 'first_time',
      nextWeight: 0,
      nextTargetTotalReps: repsMin != null ? repsMin * numWorkSets : 0,
      nextTargetRepsPerSet: Array(numWorkSets).fill(repsMin ?? 0),
      messageToUser: 'Första gången — välj en vikt du kan köra kontrollerat.',
      reason: 'no_previous_data',
    }
  }

  // Filtrera till bara work sets (ej warmup, ej backoff) som ar done
  const workSets = prevSets.filter(s =>
    s.type === 'work' && s.subtype !== 'backoff' && s.done
  )

  if (workSets.length === 0) {
    return {
      action: 'first_time',
      nextWeight: 0,
      nextTargetTotalReps: repsMin != null ? repsMin * numWorkSets : 0,
      nextTargetRepsPerSet: Array(numWorkSets).fill(repsMin ?? 0),
      messageToUser: 'Inga genomförda set hittades — välj en startvikt.',
      reason: 'no_completed_work_sets',
    }
  }

  const prevWeight = parseFloat(workSets[0].weight) || 0
  const prevTotal = totalReps(workSets)
  // Om antalet set andrats sedan forra passet (t.ex. 3 -> 4 set, eller en
  // ovning som laggs till med 1 set) skalas totalen om till dagens antal
  // set. Annars fordelas forra passets total fel (21 reps pa 1 set).
  const basisTotal = workSets.length === numWorkSets || numWorkSets <= 0
    ? prevTotal
    : Math.round(prevTotal * numWorkSets / workSets.length)
  const repeatedOnce = alreadyRepeated(workSets, prevPrevSets)
  const isBodyweight = prevWeight <= 0
  const currentWeight = prevWeight
  // Kroppsviktsovningar (chins, dips ...) har ingen vikt att "behalla" -
  // forut stod det "Behåll 0 kg" i tipset.
  const keepStr = isBodyweight ? 'Kör på kroppsvikt' : `Behåll ${currentWeight} kg`
  const atStr = isBodyweight ? 'kroppsvikt' : `${currentWeight} kg`
  const nextWeight = isBodyweight
    ? weightIncrement
    : roundToIncrement(currentWeight + weightIncrement, weightIncrement)

  // ── Punkt 6: Under repMin tva pass i rad → flagga ──
  if (repsMin != null && anySetsUnderMin(workSets, repsMin)) {
    // Kolla om aven forega passet var under repMin
    const prevPrevWork = (prevPrevSets ?? []).filter(s =>
      s.type === 'work' && s.subtype !== 'backoff' && s.done
    )
    const twoInARow = prevPrevWork.length > 0 && anySetsUnderMin(prevPrevWork, repsMin)

    if (twoInARow) {
      const lowerWeight = isBodyweight
        ? 0
        : roundToIncrement(currentWeight - weightIncrement, weightIncrement)
      return {
        action: 'too_heavy_flag',
        nextWeight: Math.max(0, lowerWeight),
        nextTargetTotalReps: repsMin * numWorkSets,
        nextTargetRepsPerSet: Array(numWorkSets).fill(repsMin),
        messageToUser: isBodyweight
          ? `Du har hamnat under ${repsMin} reps i två pass i rad — sikta på ${repsMin} per set, eller sänk rep-målet.`
          : `Du har hamnat under ${repsMin} reps i två pass i rad. Vikten kan vara för tung — prova att sänka till ${Math.max(0, lowerWeight)} kg.`,
        reason: 'under_rep_min_two_sessions',
      }
    }

    // Forsta gangen under repMin — behall vikten, forsok igen
    return {
      action: 'keep_weight_add_reps',
      nextWeight: currentWeight,
      nextTargetTotalReps: repsMin * numWorkSets,
      nextTargetRepsPerSet: Array(numWorkSets).fill(repsMin),
      messageToUser: `Något set hamnade under ${repsMin} reps. ${keepStr} och sikta på minst ${repsMin} per set.`,
      reason: 'under_rep_min_once',
    }
  }

  // ── Punkt 3: Alla set vid repMax → redo for viktökning ──
  if (repsMax != null && allSetsAtMax(workSets, repsMax)) {

    // ── Punkt 4: 0 RIR på alla set (alla övningstyper) → upprepa en gång ──
    // Nådde taket men till total failure: befäst vikten innan höjning.
    // Bara EN gang: klarade du samma sak passet innan ocksa gar vi vidare.
    if (allSetsZeroRIR(workSets) && !repeatedOnce) {
      return {
        action: 'repeat_weight',
        nextWeight: currentWeight,
        nextTargetTotalReps: repsMax * numWorkSets,
        nextTargetRepsPerSet: Array(numWorkSets).fill(repsMax),
        messageToUser: `Alla set på ${repsMax} reps men 0 RIR — upprepa ${isBodyweight ? 'samma' : atStr}. Klarar du samma igen höjer vi nästa gång.`,
        reason: 'zero_rir_caution',
      }
    }

    // Heavy compound utan RIR-data: lagg till +1 totalrep buffert
    if (category === 'heavy_compound') {
      const avgRir = averageRIR(workSets)
      if (avgRir === null) {
        const bufferedTarget = repsMax * numWorkSets + 1
        if (basisTotal < bufferedTarget) {
          return {
            action: 'keep_weight_add_reps',
            nextWeight: currentWeight,
            nextTargetTotalReps: bufferedTarget,
            nextTargetRepsPerSet: distributeReps(bufferedTarget, numWorkSets, repsMin, repsMax + 1),
            messageToUser: `Tung basövning utan RIR-data — tryck lite extra reps innan viktökning.`,
            reason: 'heavy_compound_no_rir_buffer',
          }
        }
      }
    }

    // ── Punkt 5: Stort viktsteg → krav extra totalreps ──
    const jumpPct = weightJumpPercent(currentWeight, nextWeight)
    let extraReps = 0
    let jumpReason = ''
    if (jumpPct > 20) {
      extraReps = 4
      jumpReason = `Viktsteget (${jumpPct.toFixed(0)}%) är stort — vi kräver +${extraReps} extra totalreps.`
    } else if (jumpPct > 10) {
      extraReps = 2
      jumpReason = `Viktsteget (${jumpPct.toFixed(0)}%) är medel — vi kräver +${extraReps} extra totalreps.`
    }

    if (extraReps > 0) {
      const requiredTotal = repsMax * numWorkSets + extraReps
      if (basisTotal < requiredTotal) {
        return {
          action: 'keep_weight_add_reps',
          nextWeight: currentWeight,
          nextTargetTotalReps: requiredTotal,
          nextTargetRepsPerSet: distributeReps(requiredTotal, numWorkSets, repsMin, repsMax + Math.ceil(extraReps / numWorkSets)),
          messageToUser: `Stort viktsteg till ${nextWeight} kg — tryck lite fler reps på ${atStr} först.`,
          reason: 'large_weight_jump_extra_reps',
        }
      }
    }

    // ── Punkt 7: Hoj vikt, nasta mal = repMin per set ──
    return {
      action: 'increase_weight',
      nextWeight: isBodyweight ? weightIncrement : nextWeight,
      nextTargetTotalReps: repsMin != null ? repsMin * numWorkSets : prevTotal,
      nextTargetRepsPerSet: Array(numWorkSets).fill(repsMin ?? Math.floor(prevTotal / numWorkSets)),
      messageToUser: `Dags att öka! → ${isBodyweight ? weightIncrement : nextWeight} kg, sikta på ${repsMin ?? '?'} reps per set.`,
      reason: 'all_sets_at_rep_max',
    }
  }

  // ── Punkt 2: Behåll vikten, öka totalreps (skalat efter RIR) ──
  // Marginal kvar (snitt-RIR >= 3) -> ta ett större kliv (+2 reps).
  // Nära failure (snitt-RIR < 0.5) -> befäst samma mål (+0) istället för
  // att kräva mer när du redan var slut. Annars +1 som vanligt.
  const avgRir = averageRIR(workSets)
  let repStep = 1
  if (avgRir != null && avgRir >= 3) repStep = 2
  // Befast bara en gang - har samma resultat redan upprepats gar vi vidare (+1).
  else if (avgRir != null && avgRir < 0.5 && !repeatedOnce) repStep = 0

  const perSetTarget = distributeReps(basisTotal + repStep, numWorkSets, repsMin, repsMax)
  // Hall totalen konsekvent med per-set efter min/max-klampning.
  const nextTargetTotal = perSetTarget.reduce((a, b) => a + b, 0)
  const perSetStr = perSetTarget.join(' + ')
  const msg = repStep === 0
    ? `Du körde till failure — ${isBodyweight ? 'kör' : `behåll ${currentWeight} kg och`} samma mål (${perSetStr}) en gång till.`
    : repStep === 2
      ? `Bra marginal kvar! ${keepStr} — sikta på ${perSetStr} reps.`
      : `${keepStr} — sikta på ${perSetStr} reps.`
  return {
    action: 'keep_weight_add_reps',
    nextWeight: currentWeight,
    nextTargetTotalReps: nextTargetTotal,
    nextTargetRepsPerSet: perSetTarget,
    messageToUser: msg,
    reason: repStep === 2 ? 'reps_progressing_high_rir'
      : repStep === 0 ? 'reps_hold_zero_rir'
      : 'total_reps_progressing',
  }
}


// ─── Hjalpfunktion: fordela totalreps over set ─────────────────
// Fordelar reps jamnt med avrundning, respekterar min/max granser.
// Extrarepsen laggs pa de SISTA seten, sa okningen kommer bakifran:
// 7+7+7 → 7+7+8 → 7+8+8 → 8+8+8. T.ex. 21 reps over 2 set → [10, 11].

function distributeReps(totalTarget, numSets, repsMin, repsMax) {
  if (numSets <= 0) return []
  const base = Math.floor(totalTarget / numSets)
  const remainder = totalTarget % numSets
  return Array.from({ length: numSets }, (_, i) => {
    // Sista `remainder` seten far +1 (okningen kommer bakifran).
    let r = i >= numSets - remainder ? base + 1 : base
    if (repsMin != null) r = Math.max(r, repsMin)
    if (repsMax != null) r = Math.min(r, repsMax)
    return r
  })
}

/**
 * Automatisk "comeback"-sankning efter langt uppehall. REN datum-matematik,
 * ingen AI. Flyttad hit fran ai.js nar AI-delen togs bort. Returnerar ett
 * adjustment-objekt (samma form som applyAdjustment vantar) eller null.
 */
export function detectGapAdjustment(recentWorkouts, exerciseNames) {
  if (!recentWorkouts?.length || !exerciseNames?.length) return null
  // Senaste passet oavsett typ: aven ett sjuk-/deloadpass ar traning. Annars
  // tolkas en deload-vecka som 8+ dagars franvaro och vikterna sanks en
  // gang till pa forsta vanliga passet efterat.
  const last = recentWorkouts.find(w => w.finished_at)
  if (!last?.finished_at) return null

  const daysSince = Math.round((Date.now() - new Date(last.finished_at).getTime()) / 86400000)

  // Kort uppehall (8-14 dagar) ger ingen matbar styrkeforlust: da foreslas
  // SAMMA vikter och reps som forra passet (ingen okning, ingen sankning).
  // Forst vid langre franvaro sanks vikterna, och mildare an forut
  // (forut -10 % redan efter 8 dagar, -20 % efter 15 och -25 % efter 28).
  if (daysSince >= 8 && daysSince <= 14) {
    return {
      summary: `${daysSince} dagar sedan senaste passet - samma som sist`,
      days: daysSince,
      hold: true,
      changes: [],
    }
  }

  let weightMult = null
  let repsMult = null
  let summary = null
  if (daysSince >= 15 && daysSince <= 28) {
    weightMult = 0.9
    repsMult = 0.9
    summary = `${daysSince} dagar sedan senaste passet - vikter sankta 10%`
  } else if (daysSince > 28) {
    weightMult = 0.8
    repsMult = 0.8
    summary = `${daysSince} dagar sedan senaste passet - vikter sankta 20%`
  }

  if (!weightMult) return null

  return {
    summary,
    days: daysSince,
    hold: false,
    changes: exerciseNames.map(name => ({
      exerciseName: name,
      weightMultiplier: weightMult,
      repsMultiplier: repsMult,
    })),
  }
}
