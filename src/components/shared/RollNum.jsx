import { useEffect, useState } from 'react'
import styles from './RollNum.module.css'

const DIGITS = '0123456789'

/**
 * Visar en text dar varje siffra rullar till sitt nya varde i stallet for
 * att hoppa. Ovriga tecken (+, %, mellanslag, bokstaver) visas som de ar.
 * Forsta gangen rullar siffrorna upp fran 0.
 */
export default function RollNum({ value, className }) {
  const text = String(value ?? '')
  const [shown, setShown] = useState(() => text.replace(/\d/g, '0'))
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(text))
    return () => cancelAnimationFrame(id)
  }, [text])

  // Nyckla kolumner fran hoger sa att entalet alltid ar samma kolumn
  const chars = [...shown]
  return (
    <span className={`${styles.wrap} ${className ?? ''}`} aria-label={text}>
      <span aria-hidden="true" className={styles.inner}>
        {chars.map((ch, i) => {
          const key = chars.length - i
          if (!DIGITS.includes(ch)) return <span key={`c${key}`} className={styles.char}>{ch}</span>
          return (
            <span key={`d${key}`} className={styles.col}>
              <span className={styles.strip} style={{ transform: `translateY(${-Number(ch) * 10}%)` }}>
                {DIGITS.split('').map(d => <span key={d} className={styles.digit}>{d}</span>)}
              </span>
            </span>
          )
        })}
      </span>
    </span>
  )
}
