// Uppskattar hur lang tid ett pass tar, baserat pa antal set och vila.
// Detta ar en UPPSKATTNING (±), inte exakt - tanken ar att ge en kansla
// for om passet ar rimligt langt nar man bygger det.
//
// Antaganden (latta att justera om de kanns fel):
// Kalibrerade mot 8 verkliga pass (jun 2026): formeln underskattade 30-50%
// - i verkligheten tar set, vila och stationsbyten langre an teorin,
// sarskilt vid hard traning (1-0 RIR).
const SECONDS_PER_WORK_SET = 60      // sjalva utforandet av ett arbetsset
const SECONDS_PER_WARMUP_SET = 30    // uppvarmningsset gar snabbare
const DEFAULT_REST = 120             // om vila inte angetts pa ovningen
const WARMUP_REST = 60               // kortare vila efter uppvarmningsset
const SETUP_PER_EXERCISE = 90        // byta station, ga till maskin, stalla in vikt
const REALITY_FACTOR = 1.25          // verklig vila/spill ar langre an planerad

/**
 * Uppskattar tiden for ett enskilt pass i sekunder.
 * @param {object} session - { exercises: [{ workSets, warmupSets, backoffSets, restSeconds }] }
 * @returns {number} uppskattad tid i sekunder
 */
export function estimateSessionSeconds(session) {
  const exercises = session?.exercises ?? []
  let total = 0
  for (const ex of exercises) {
    const work = (ex.workSets ?? 3) + (ex.backoffSets ?? 0)
    const warmup = ex.warmupSets ?? 0
    const rest = ex.restSeconds ?? DEFAULT_REST

    // Tid for sjalva seten
    total += work * SECONDS_PER_WORK_SET
    total += warmup * SECONDS_PER_WARMUP_SET

    // Vila mellan set (det blir n-1 vilor, men vi forenklar till n
    // for att tacka in lite extra spill - haller uppskattningen arlig)
    total += work * rest
    total += warmup * WARMUP_REST

    // Lite tid for att byta ovning/station
    total += SETUP_PER_EXERCISE
  }
  return Math.round(total * REALITY_FACTOR)
}

/** Uppskattad tid for ett pass i minuter (avrundat). */
export function estimateSessionMinutes(session) {
  return Math.round(estimateSessionSeconds(session) / 60)
}

/**
 * Formaterar minuter snyggt: "~45 min" eller "~1h 5min".
 * Returnerar null om passet ar tomt (ingen ovning).
 */
export function formatSessionTime(session) {
  const exercises = session?.exercises ?? []
  if (exercises.length === 0) return null
  const mins = estimateSessionMinutes(session)
  if (mins < 60) return `~${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `~${h}h ${m}min` : `~${h}h`
}
