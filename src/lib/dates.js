// Datum-hjalpare.

/**
 * Antal KALENDERDAGAR sedan ett datum (i lokal tid) - inte 24h-perioder.
 * Ett pass i lordags ska vara "2 dagar sedan" pa mandag morgon oavsett
 * klockslag. (Math.floor((nu - da) / 86400000) raknar fel: 46 timmar
 * blir "1 dag" fast det ar tva kalenderdagar sedan.)
 */
export function calendarDaysAgo(iso) {
  const d = new Date(iso)
  const now = new Date()
  const then = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((today - then) / 86400000)
}
