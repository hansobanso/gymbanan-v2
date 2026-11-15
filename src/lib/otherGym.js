// "Annat gym": en ovning i ett pass kan markeras som kord pa ett annat gym
// (galler maskiner och kabel, dar vikterna inte gar att jamfora mellan gym).
// Sparas som other_gym: true pa ovningen i workouts.exercises. Sadana
// ovningar raknas som traning (muskellage, veckorapport, set, RIR) men
// hoppas over for PB, viktforslag, kurvor och maskinens kanda vikter.
export function isOtherGym(ex) {
  return !!(ex?.other_gym || ex?.otherGym)
}

export function canBeOtherGym(equipment) {
  const e = (equipment ?? '').toLowerCase()
  return e === 'maskin' || e === 'kabel'
}

// Vikterna som faktiskt korts pa hemmagymmets maskin, for att foresla nasta
// riktiga vikt i stacken (46 -> 52 i stallet for 51). Alla klarade set,
// aven uppvarmning. Nyaste passen forst, hogst 40 olika vikter.
export function knownMachineWeights(workouts, aliasNames) {
  const seen = new Set()
  for (const w of workouts ?? []) {
    if (!w.finished_at) continue
    for (const ex of w.exercises ?? []) {
      if (!aliasNames.has(ex.name) || isOtherGym(ex)) continue
      for (const s of ex.sets ?? []) {
        const v = parseFloat(s.weight)
        if (s.done && v > 0) seen.add(v)
      }
    }
    if (seen.size >= 40) break
  }
  return [...seen].sort((a, b) => a - b)
}
