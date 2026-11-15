import { useEffect, useRef, useState } from 'react'
import { BananaIcon } from '../shared/Icons'
import styles from './BananaRow.module.css'

// Omogen gron banan -> mogen gul. Det enda stallet appen tillater gront.
const RIPE_FROM = [141, 179, 58]
const RIPE_TO = [245, 208, 32]
export function ripeColor(t) {
  const k = Math.min(1, Math.max(0, t))
  const c = RIPE_FROM.map((a, i) => Math.round(a + (RIPE_TO[i] - a) * k))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

const countSets = ex => {
  const ws = ex.sets.filter(s => s.type !== 'warmup')
  return { total: ws.length, done: ws.filter(s => s.done).length, pb: ex.sets.some(s => s.done && s.isPB) }
}

/**
 * Passets forlopp: en banan per ovning. Gron nar den inte ar paborjad,
 * gulnar for varje klart set, helt gul nar ovningen ar klar. Den aktiva
 * ar storre och gungar till nar ett set blir klart. Tryck for att hoppa
 * till ovningen. Superset sitter ihop som ett bananpar. En ovning med PB
 * far ett gult glitter. Bananerna ligger ner for att ta lite plats pa hojden.
 */
export default function BananaRow({ exercises, activeExId, onJump, compact = false }) {
  const known = useRef(null)          // ovningar som fanns forra renderingen
  const prevDone = useRef({})         // klara set per ovning, for gungningen
  const [wiggle, setWiggle] = useState({}) // localId -> raknare (ny nyckel = ny animation)
  const [wave, setWave] = useState(0)
  const allRipeBefore = useRef(null)

  const rows = exercises.map(ex => ({ ex, ...countSets(ex) }))
  const allRipe = rows.length > 0 && rows.every(r => r.total > 0 && r.done === r.total)

  // Nya ovningar (inte vid forsta visningen) far en liten pop
  const isNew = id => known.current != null && !known.current.has(id)

  useEffect(() => {
    known.current = new Set(exercises.map(e => e.localId))
    const next = {}
    const bumps = {}
    for (const r of rows) {
      next[r.ex.localId] = r.done
      const before = prevDone.current[r.ex.localId]
      if (before != null && r.done > before) bumps[r.ex.localId] = true
    }
    prevDone.current = next
    if (Object.keys(bumps).length) {
      setWiggle(w => {
        const out = { ...w }
        for (const id of Object.keys(bumps)) out[id] = (out[id] ?? 0) + 1
        return out
      })
    }
    if (allRipeBefore.current === false && allRipe) setWave(v => v + 1)
    allRipeBefore.current = allRipe
  })

  // Gruppera superset som ligger efter varandra till ett par
  const groups = []
  for (const r of rows) {
    const last = groups[groups.length - 1]
    if (r.ex.supersetId && last && last[0].ex.supersetId === r.ex.supersetId) last.push(r)
    else groups.push([r])
  }

  const n = rows.length
  // Storlek efter antal: stort vid fa ovningar, mindre nar det ar manga
  // compact = i passets sidhuvud, mellan namnet och knapparna
  const size = compact
    ? (n <= 4 ? 26 : n <= 6 ? 22 : n <= 8 ? 18 : 15)
    : (n <= 6 ? 32 : n <= 9 ? 28 : n <= 12 ? 23 : 19)

  return (
    <div className={`${styles.row} ${compact ? styles.compact : ''} ${wave ? styles.wave : ''}`} key={`w${wave}`} style={{ '--b': `${size}px` }}>
      {groups.map(g => (
        <span key={g[0].ex.localId} className={g.length > 1 ? styles.pair : styles.single}>
          {g.map(({ ex, total, done, pb }) => {
            const t = total ? done / total : 0
            const active = ex.localId === activeExId
            const idx = rows.findIndex(r => r.ex.localId === ex.localId)
            return (
              <button
                key={`${ex.localId}-${wiggle[ex.localId] ?? 0}`}
                className={[
                  styles.banana,
                  active ? styles.active : '',
                  wiggle[ex.localId] ? styles.wiggle : '',
                  isNew(ex.localId) ? styles.pop : '',
                ].join(' ')}
                style={{ '--i': idx }}
                onClick={() => onJump?.(ex.localId)}
                type="button"
                aria-label={`${ex.name}: ${done} av ${total} set klara${pb ? ', nytt PB' : ''}`}
                aria-current={active ? 'step' : undefined}
              >
                <span className={`${styles.fruit} ${pb ? styles.fruitPb : ''}`}>
                  <BananaIcon color={ripeColor(t)} />
                </span>
                {/* PB i ovningen: ett litet gult glitter som syns mot det morka */}
                {pb && (
                  <svg className={styles.sparkle} viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 1.5c.6 4.8 2.4 7.4 7 8.4.6.1.6 1 0 1.1-4.6 1-6.4 3.6-7 8.4-.1.6-1 .6-1.1 0-.6-4.8-2.4-7.4-7-8.4-.6-.1-.6-1 0-1.1 4.6-1 6.4-3.6 7-8.4.1-.6 1-.6 1.1 0Z" />
                  </svg>
                )}
              </button>
            )
          })}
        </span>
      ))}
    </div>
  )
}
