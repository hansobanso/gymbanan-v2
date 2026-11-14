import { useEffect, useRef, useState } from 'react'
import { BananaIcon } from '../shared/Icons'
import styles from './PbBurst.module.css'

const COUNT = 14

/**
 * Halls koll pa antalet PB-set i passet. Okar det skjuts en kort skur av
 * sma bananer upp fran nederkanten, en gang per nytt PB.
 */
export default function PbBurst({ exercises }) {
  const pbs = (exercises ?? []).reduce((n, ex) => n + ex.sets.filter(s => s.done && s.isPB).length, 0)
  const prev = useRef(pbs)
  const [burst, setBurst] = useState(0)

  useEffect(() => {
    if (pbs > prev.current) setBurst(b => b + 1)
    prev.current = pbs
  }, [pbs])

  useEffect(() => {
    if (!burst) return
    const t = setTimeout(() => setBurst(0), 1600)
    return () => clearTimeout(t)
  }, [burst])

  if (!burst) return null
  return (
    <div className={styles.layer} key={burst} aria-hidden="true">
      {Array.from({ length: COUNT }, (_, i) => {
        // Spridning: jamnt over bredden, slumpad hojd, rotation och fordrojning
        const x = (i + 0.5) / COUNT * 100 + (Math.random() - 0.5) * 6
        const style = {
          left: `${x}%`,
          '--rise': `${45 + Math.random() * 30}vh`,
          '--spin': `${(Math.random() - 0.5) * 540}deg`,
          '--drift': `${(Math.random() - 0.5) * 60}px`,
          animationDelay: `${Math.random() * 120}ms`,
          width: `${18 + Math.random() * 12}px`,
        }
        return <span key={i} className={styles.banana} style={style}><BananaIcon /></span>
      })}
      <span className={styles.label}>PB</span>
    </div>
  )
}
