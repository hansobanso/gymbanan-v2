// Gamla/omdopta ovningsnamn -> aktuellt kanoniskt namn. Historiken lagrar
// namn (inte id), sa nar en ovning byter namn tappas kopplingen till gamla
// loggar. Denna tabell delas av vikthistoriken (forifyllning/progression)
// och muskelgubben sa alla namnvarianter raknas som samma ovning.
export const EXERCISE_ALIASES = {
  'Benböjning sittande': 'Benspark',
  'Benextension': 'Benspark',
  'DB sidolyft': 'Sidolyft med hantlar',
  'Lat-nedragning': 'Latsdrag med smalt neutralt grepp',
  'Lutande hantel press bort': 'Lutande hantelpress',
  'Uppåtlutande hantelpress': 'Lutande hantelpress',
  'Pullups nära neutral': 'Pullups',
  // Dubbletter som slogs ihop i databasen 2026-11-16 (historik och program
  // ar omdopta, men lokalt sparade pass kan ha kvar gamla namn)
  'Knäböj Smith maskin': 'Knäböj i smithmaskin',
  'Hack squat i maskin': 'Hack squat',
  'Rumänsk marklyft med hantlar': 'Rumänska marklyft med hantlar',
  'Frontlyft': 'Framåtlyft med hantlar',
  'Rodd med T-bar': 'T-stångsrodd',
  'Bencurl': 'Liggande bencurl',
  'Liggande lårcurl': 'Liggande bencurl',
  'Sittande lårcurl': 'Sittande bencurl',
  'Maskin crunch': 'Crunch i maskin',
  'Bicepscurl': 'Skivstångscurl',
  'Preachercurl med hantlar': 'Preachercurl med hantel',
  'Preachercurl enarms': 'Preachercurl med hantel',
  'Maskincurl': 'Bicepscurl i maskin',
  'Press': 'Militärpress',
  'Sittande press med hantlar': 'Sittande axelpress med hantlar',
  'Sittande skivstångspress': 'Sittande axelpress med skivstång',
  'Stående drag till hakan': 'Stående drag till hakan med skivstång',
  'Liggande triceps': 'Skull crushers',
  'Stående vadpress': 'Vadpress',
  'Latsdrag enarms': 'Enhands latsdrag',
  'Hip abduktion': 'Höftabduktion i maskin',
  'Stående kickback i maskin': 'Kickback i maskin',
  'Höftsträckning med kabel': 'Cable kickback',
  'Uppåtlutande bänkpress': 'Lutande bänkpress',
  'Maskinpress': 'Bröstpress i maskin',
  'Stående kabelflyes': 'Kabelflyes',
  'Pec deck': 'Maskinflyes',
  'Maskinrodd': 'Maskinrodd med stöd',
  'Kabelcurl': 'Kabelcurl med stång',
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
