import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { displayWeight } from '../../lib/weightUtils'
import styles from './StrengthView.module.css'

function epley(weight, reps, equipment) {
  const w = displayWeight(parseFloat(weight), equipment)
  const r = parseInt(reps)
  if (!w || !r) return 0
  if (r === 1) return w
  return w * (1 + r / 30)
}

function best1RM(sets, equipment) {
  let best = 0
  for (const s of sets) {
    if (s.type === 'work' && s.done) {
      const e = epley(s.weight, s.reps, equipment)
      if (e > best) best = e
    }
  }
  return best
}

function fmtDateShort(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function LineChart({ points }) {
  if (points.length === 1) {
    return (
      <div className={styles.singlePoint}>
        <span className={styles.singleValue}>{Math.round(points[0].value)} kg</span>
        <span className={styles.singleLabel}>estimerat 1RM</span>
      </div>
    )
  }

  const W = 300, H = 110
  const PAD = { top: 10, bottom: 22, left: 38, right: 8 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const vals = points.map(p => p.value)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const range = maxV - minV || 1

  const toX = i => PAD.left + (i / (points.length - 1)) * innerW
  const toY = v => PAD.top + innerH - ((v - minV) / range) * innerH

  const linePath = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`
  ).join(' ')

  const areaPath = `${linePath} L${toX(points.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${PAD.left},${(PAD.top + innerH).toFixed(1)} Z`

  const gridVals = [minV, minV + range * 0.5, maxV]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} aria-hidden="true">
      {gridVals.map((v, i) => {
        const y = toY(v)
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} className={styles.gridLine} />
            <text x={PAD.left - 4} y={y + 3.5} className={styles.axisLabel} textAnchor="end">
              {Math.round(v)}
            </text>
          </g>
        )
      })}
      <path d={areaPath} className={styles.area} />
      <path d={linePath} className={styles.line} fill="none" />
      {points.map((p, i) => (
        <circle key={i} cx={toX(i)} cy={toY(p.value)} r="3" className={styles.dot} />
      ))}
      <text x={PAD.left} y={H - 2} className={styles.dateLabel} textAnchor="middle">
        {fmtDateShort(points[0].date)}
      </text>
      <text x={toX(points.length - 1)} y={H - 2} className={styles.dateLabel} textAnchor="middle">
        {fmtDateShort(points[points.length - 1].date)}
      </text>
    </svg>
  )
}

export default function StrengthView({ workout, allWorkouts, equipmentMap = {}, open, onClose }) {
  const charts = useMemo(() => {
    if (!workout || !allWorkouts) return []

    const sorted = [...allWorkouts].sort(
      (a, b) => new Date(a.finished_at) - new Date(b.finished_at)
    )

    const exercises = (workout.exercises ?? []).filter(ex =>
      ex.sets?.some(s => s.type === 'work' && s.done)
    )

    return exercises.map(ex => {
      const equipment = equipmentMap[ex.name]
      const history = []
      for (const w of sorted) {
        const match = (w.exercises ?? []).find(e => e.name === ex.name)
        if (!match) continue
        const rm = best1RM(match.sets ?? [], equipment)
        if (rm > 0) history.push({ date: w.finished_at, value: rm })
      }
      const points = history.slice(-10)
      return { name: ex.name, points, isDouble: equipment === 'Hantel' }
    }).filter(c => c.points.length > 0)
  }, [workout, allWorkouts, equipmentMap])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={styles.sheet}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className={styles.handle} />
            <div className={styles.header}>
              <span className={styles.title}>Styrkegrafer</span>
              <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Stäng">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className={styles.list}>
              {charts.length === 0 ? (
                <p className={styles.empty}>Ingen 1RM-data att visa för detta pass.</p>
              ) : (
                charts.map(c => (
                  <div key={c.name} className={styles.chartCard}>
                    <div className={styles.chartName}>
                      {c.name}
                      {c.isDouble && <span className={styles.doubleTag}>×2 total</span>}
                    </div>
                    <LineChart points={c.points} />
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
