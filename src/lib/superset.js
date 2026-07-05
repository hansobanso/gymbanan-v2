// Hjalpare for superset-par (tva ovningar med delat supersetId).

/**
 * Sorterar en ovningslista sa att superset-par alltid ligger intill
 * varandra: den andra medlemmen flyttas till platsen direkt efter den
 * forsta. Ovriga ovningar behaller sin inbordes ordning.
 * Fungerar pa bade program-ovningar och pass-ovningar (kraver bara
 * supersetId-faltet). Returnerar en NY array (muterar inte input).
 */
export function sortSupersetsAdjacent(list) {
  if (!Array.isArray(list)) return list
  const placed = new Set()
  const result = []
  for (const ex of list) {
    if (placed.has(ex)) continue
    result.push(ex)
    placed.add(ex)
    if (ex?.supersetId) {
      const partner = list.find(o => o !== ex && !placed.has(o) && o?.supersetId === ex.supersetId)
      if (partner) {
        result.push(partner)
        placed.add(partner)
      }
    }
  }
  return result
}
