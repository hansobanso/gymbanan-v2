// Gamla/omdopta ovningsnamn -> aktuellt kanoniskt namn. Historiken lagrar
// namn (inte id), sa nar en ovning byter namn tappas kopplingen till gamla
// loggar. Denna tabell delas av vikthistoriken (forifyllning/progression)
// och muskelgubben sa alla namnvarianter raknas som samma ovning.
export const EXERCISE_ALIASES = {
  'Benböjning sittande': 'Benspark',
  'Benextension': 'Benspark',
  'DB sidolyft': 'Sidolyft med hantlar',
  'Lat-nedragning': 'Latsdrag med smalt neutralt grepp',
  'Lutande hantel press bort': 'Uppåtlutande hantelpress',
  'Lutande hantelpress': 'Uppåtlutande hantelpress',
  'Pullups nära neutral': 'Pullups',
}

/**
 * Alla namn som avser samma ovning som `name`: namnet sjalvt, dess
 * kanoniska namn, och alla andra alias som pekar pa samma kanoniska namn.
 */
export function namesMatching(name) {
  const canonical = EXERCISE_ALIASES[name] ?? name
  const set = new Set([name, canonical])
  for (const [alias, target] of Object.entries(EXERCISE_ALIASES)) {
    if (target === canonical) set.add(alias)
  }
  return set
}
