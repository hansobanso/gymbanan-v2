import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { hapticTick } from '../../lib/haptics'
import styles from './SwipeRow.module.css'

const OPEN = 84

/**
 * Svep pa ett set: at vanster visas "Ta bort", at hoger "Dubblera".
 * Raden stannar oppen tills man trycker pa knappen eller drar tillbaka.
 * Tillbaka fran gamla SetRow (forsvann nar passvyn byggdes om 2026-11).
 */
export default function SwipeRow({ children, onRemove, onDuplicate, onLongPress, disabled = false, card = false }) {
  const wrapRef = useRef(null)
  const moved = useRef(false)
  const x = useMotionValue(0)
  const removeOpacity = useTransform(x, [-OPEN, -24], [1, 0])
  const dupOpacity = useTransform(x, [24, OPEN], [0, 1])

  // Egen fingerhantering i stallet for framer-motions drag: den startar inte
  // nar fingret borjar pa ett inmatningsfalt, och kortets stora siffror ar falt.
  const handlers = useRef({})
  handlers.current = { onRemove, onDuplicate, onLongPress }
  useEffect(() => {
    const el = wrapRef.current
    if (!el || disabled) return
    let sx = 0, sy = 0, base = 0, dir = null, lastX = 0, lastT = 0, vel = 0
    let longTimer = null, longFired = false
    const clamp = v => {
      const { onRemove: r, onDuplicate: d } = handlers.current
      const min = r ? -OPEN - 12 : 0, max = d ? OPEN + 12 : 0
      return Math.max(min, Math.min(max, v))
    }
    const start = e => {
      const t = e.touches[0]
      sx = t.clientX; sy = t.clientY; base = x.get(); dir = null
      lastX = t.clientX; lastT = e.timeStamp; vel = 0
      moved.current = false
      longFired = false
      clearTimeout(longTimer)
      // Langtryck: halla stilla en halv sekund
      // Inte pa +/- och knapparna i setkortet: dar betyder halla inne annat
      if (handlers.current.onLongPress && !e.target.closest?.('[data-no-longpress]')) {
        longTimer = setTimeout(() => {
          if (dir !== null) return
          longFired = true
          moved.current = true // sa att trycket inte ocksa blir ett klick
          hapticTick()
          handlers.current.onLongPress()
        }, 500)
      }
    }
    const move = e => {
      const t = e.touches[0]
      const dx = t.clientX - sx, dy = t.clientY - sy
      if (dir === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) { dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'; clearTimeout(longTimer) }
      if (longFired) { e.preventDefault(); return }
      if (dir !== 'h') return
      e.preventDefault()
      moved.current = true
      x.set(clamp(base + dx))
      const dt = e.timeStamp - lastT
      if (dt > 0) vel = (t.clientX - lastX) / dt * 1000
      lastX = t.clientX; lastT = e.timeStamp
    }
    const end = e => {
      clearTimeout(longTimer)
      if (longFired && e?.cancelable) e.preventDefault()
      if (dir !== 'h') return
      const { onRemove: r, onDuplicate: d } = handlers.current
      // Beslut efter var raden hamnat, inte hur langt fingret dragit
      const pos = x.get()
      let target = 0
      if (r && (pos < -56 || (pos < -24 && vel < -600))) target = -OPEN
      else if (d && (pos > 56 || (pos > 24 && vel > 600))) target = OPEN
      if (target && target !== base) hapticTick()
      animate(x, target, { type: 'spring', stiffness: 500, damping: 40 })
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end, { passive: false })
    el.addEventListener('touchcancel', end, { passive: true })
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  }, [disabled, x])

  const close = () => animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 })

  if (disabled) return children

  return (
    <div className={`${styles.wrap} ${card ? styles.cardWrap : ''}`} ref={wrapRef}>
      {onRemove && (
        <motion.button
          className={styles.remove}
          style={{ opacity: removeOpacity }}
          onClick={() => { close(); onRemove() }}
          type="button"
          aria-label="Ta bort set"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M19 6l-.9 14H5.9L5 6" />
          </svg>
          <span>Ta bort</span>
        </motion.button>
      )}
      {onDuplicate && (
        <motion.button
          className={styles.dup}
          style={{ opacity: dupOpacity }}
          onClick={() => { close(); onDuplicate() }}
          type="button"
          aria-label="Dubblera set"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" />
          </svg>
          <span>Dubblera</span>
        </motion.button>
      )}
      <motion.div
        className={styles.row}
        style={{ x }}
        // Ett drag ska inte ocksa rakna som tryck pa raden
        onClickCapture={e => {
          if (moved.current || Math.abs(x.get()) > 4) {
            e.stopPropagation(); e.preventDefault()
            if (Math.abs(x.get()) > 4 && !moved.current) close()
          }
          moved.current = false
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}
