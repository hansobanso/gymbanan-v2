import { useState, useMemo, useEffect } from 'react'
import { getBodyWeights } from '../../lib/db'
import { displayWeight } from '../../lib/weightUtils'
import styles from './ExerciseChartSheet.module.css'

function fmtDateShort(iso) {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function LineChart({ points, unit = 'kg' }) {
  if (points.length < 2) {
    return <p className={styles.noData}>Inte tillräckligt med data ännu</p>
  }

  const W = 320, H = 120
  const PAD = { top: 12, bottom: 24, left: 40, right: 10 }
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
      <text x={PAD.left} y={H - 3} className={styles.dateLabel} textAnchor="middle">
        {fmtDateShort(points[0].date)}
      </text>
      <text x={toX(points.length - 1)} y={H - 3} className={styles.dateLabel} textAnchor="middle">
        {fmtDateShort(points[points.length - 1].date)}
      </text>
    </svg>
  )
}

export default function ExerciseChartSheet({ open, onClose, userId, workouts, equipmentMap = {} }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [bodyWeights, setBodyWeights] = useState([])

  useEffect(() => {
    if (!open || !userId) return
    setSelected(null)
    setQuery('')
    getBodyWeights(userId, 20).then(setBodyWeights).catch(() => {})
  }, [open, userId])

  const exerciseNames = useMemo(() => {
    const names = new Set()
    for (const w of workouts) {
      for (const ex of w.exercises ?? []) {
        if ((ex.sets ?? []).some(s => s.type === 'work' && s.done && s.weight)) {
          names.add(ex.name)
        }
      }
    }
    return [...names].sort()
  }, [workouts])

  const filtered = query.trim()
    ? exerciseNames.filter(n => n.toLowerCase().includes(query.toLowerCase()))
    : exerciseNames

  const chartPoints = useMemo(() => {
    if (!selected) return []
    if (selected === '__bodyweight') {
      return [...bodyWeights].reverse().map(bw => ({
        date: bw.logged_at,
        value: parseFloat(bw.weight),
      }))
    }
    const equipment = equipmentMap[selected]
    const sorted = [...workouts].sort((a, b) => new Date(a.finished_at) - new Date(b.finished_at))
    const points = []
    for (const w of sorted) {
      const ex = (w.exercises ?? []).find(e => e.name === selected)
      if (!ex) continue
      const best = Math.max(...(ex.sets ?? [])
        .filter(s => s.type === 'work' && s.done && s.weight)
        .map(s => displayWeight(parseFloat(s.weight) || 0, equipment)))
      if (best > 0) points.push({ date: w.finished_at, value: best })
    }
    return points.slice(-20)
  }, [selected, workouts, bodyWeights, equipmentMap])

  const selectedLabel = selected === '__bodyweight' ? 'Kroppsvikt' : selected

  if (!open) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        {selected ? (
          <button className={styles.backBtn} onClick={() => setSelected(null)} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {selectedLabel}
          </button>
        ) : (
          <span className={styles.title}>Styrkegrafer</span>
        )}
        <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Stäng">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {selected ? (
        <div className={styles.scrollArea}>
          <div className={styles.chartView}>
            <LineChart points={chartPoints} />
            {chartPoints.length >= 2 && (
              <p className={styles.chartMeta}>
                {chartPoints.length} mätpunkter · bästa vikt per pass
                {selected !== '__bodyweight' && equipmentMap[selected] === 'Hantel' && (
                  <span className={styles.doubleTag}> · ×2 total (hantel)</span>
                )}
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className={styles.searchWrap}>
            <input
              className={styles.search}
              type="text"
              placeholder="Sök övning…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className={styles.scrollArea}>
            {!query && (
              <button className={styles.listItem} onClick={() => setSelected('__bodyweight')} type="button">
                <span className={styles.listItemName}>Kroppsvikt</span>
                <span className={styles.listItemMeta}>{bodyWeights.length > 0 ? `${parseFloat(bodyWeights[0].weight)} kg` : '–'}</span>
              </button>
            )}
            {filtered.map(name => (
              <button key={name} className={styles.listItem} onClick={() => setSelected(name)} type="button">
                <span className={styles.listItemName}>{name}</span>
              </button>
            ))}
            {filtered.length === 0 && query && (
              <p className={styles.noResults}>Ingen övning hittades</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
