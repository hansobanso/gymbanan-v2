// Stoppar iOS egen kantsvep-navigering (bakat/framat). Utan den kan man dra
// fram forra sidan under den man ar pa, t.ex. se Program under Historik.
//
// En touch som borjar ytterst vid en skarmkant far preventDefault, vilket
// hindrar gesten. Priset ar att webblasaren da inte skapar nagot klick, sa
// ett tryck som inte rort sig skickas vidare som klick for hand. Appens egna
// kantgester (passvyn och "tillbaka till passet") lyssnar pa touchmove och
// paverkas inte.

const EDGE_PX = 20
const TAP_SLOP_PX = 10

export function installEdgeGuard() {
  if (typeof document === 'undefined' || !('ontouchstart' in window)) return
  let start = null

  document.addEventListener('touchstart', e => {
    start = null
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    if (t.clientX > EDGE_PX && t.clientX < window.innerWidth - EDGE_PX) return
    if (e.cancelable) e.preventDefault()
    start = { x: t.clientX, y: t.clientY, moved: false }
  }, { passive: false })

  document.addEventListener('touchmove', e => {
    if (!start) return
    const t = e.touches[0]
    if (Math.abs(t.clientX - start.x) > TAP_SLOP_PX || Math.abs(t.clientY - start.y) > TAP_SLOP_PX) start.moved = true
  }, { passive: true })

  document.addEventListener('touchend', () => {
    const s = start
    start = null
    if (!s || s.moved) return
    const el = document.elementFromPoint(s.x, s.y)
    if (!el) return
    if (el.matches('input, textarea, select')) el.focus()
    el.click()
  }, { passive: true })

  document.addEventListener('touchcancel', () => { start = null }, { passive: true })
}
