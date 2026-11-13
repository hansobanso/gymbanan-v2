// Svensk singular/plural for de ord appen raknar: "1 övning", "2 övningar".
export const exWord = n => (n === 1 ? 'övning' : 'övningar')
export const nEx = n => `${n} ${exWord(n)}`
export const minWord = n => (n === 1 ? 'minut' : 'minuter')

// Vilotid i klartext, samma overallt: "30 s", "1 min", "1,5 min", "2 min"
export function fmtRest(s) {
  if (s == null) return 'Auto'
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (rem === 30) return `${m},5 min`
  return rem ? `${m} min ${rem} s` : `${m} min`
}
