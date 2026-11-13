// Korta kanselsignaler. Android: Vibration API. iPhone saknar det, men
// Safari (iOS 17.4+) ger ett latt "tick" nar en <input type="checkbox"
// switch> vaxlar - vi klickar pa en osynlig sadan. Allt ar "om det gar":
// misslyckas det hander ingenting. Inget ljud, sa musiken paverkas inte.

let switchLabel = null

function iosTick() {
  try {
    if (!switchLabel) {
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.setAttribute('switch', '')
      input.id = 'haptic-switch'
      input.tabIndex = -1
      switchLabel = document.createElement('label')
      switchLabel.htmlFor = 'haptic-switch'
      switchLabel.setAttribute('aria-hidden', 'true')
      switchLabel.style.cssText = 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden'
      switchLabel.appendChild(input)
      document.body.appendChild(switchLabel)
    }
    switchLabel.click()
  } catch { /* ignored */ }
}

function fire(pattern, ticks) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern)
      return
    }
  } catch { /* ignored */ }
  if (typeof document === 'undefined') return
  iosTick()
  for (let i = 1; i < ticks; i++) setTimeout(iosTick, i * 110)
}

/** Ett set bockas av. */
export function hapticTick() { fire(12, 1) }

/** Personbasta: dubbelt. */
export function hapticSuccess() { fire([14, 70, 22], 2) }

/** Nagot saknas (t.ex. reps inte ifyllt). */
export function hapticWarn() { fire(30, 1) }
