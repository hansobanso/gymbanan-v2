import { useState, useMemo, useEffect } from 'react'
import { displayWeight } from '../../lib/weightUtils'
import styles from './ProgressView.module.css'

// Epley-estimerat 1RM for ett set
function epley(weight, reps, equipment) {
  const w = displayWeight(parseFloat(weight), equipment)
  const r = parseInt(reps)
  if (!w || !r) return 0
  if (r === 1) return w
  return w * (1 + r / 30)
}

// Basta estimerade 1RM i ett pass for en ovning
function bestRM(sets, equipment) {
  let best = 0
  for (const s of sets ?? []) {
    if (s.type === 'work' && s.done) {
      const e = epley(s.weight, s.reps, equipment)
      if (e > best) best = e
    }
  }
  return best
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function fmtKg(v) {
  // Snygga tal: heltal om jamnt, annars en decimal
  return Number.isInteger(v) ? `${v}` : v.toFixed(1)
}

function ProgressChart({ points }) {
  if (points.length < 2) {
    return (
      <div className={styles.singleWrap}>
        <span className={styles.singleValue}>{Math.round(points[0]?.value ?? 0)} kg</span>
        <span className={styles.singleLabel}>
          {points.length === 1 ? 'Träna fler pass för att se din utveckling' : 'Ingen data ännu'}
        </span>
      </div>
    )
  }

  const W = 360, H = 190
  const PAD = { top: 24, bottom: 26, left: 40, right: 14 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const vals = points.map(p => p.value)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const range = maxV - minV || 1
  // Lite luft over/under sa linjen inte klistras mot kanten
  const padV = range * 0.15
  const lo = minV - padV
  const hi = maxV + padV
  const span = hi - lo || 1

  const toX = i => PAD.left + (i / (points.length - 1)) * innerW
  const toY = v => PAD.top + innerH - ((v - lo) / span) * innerH

  const linePath = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`
  ).join(' ')
  const areaPath = `${linePath} L${toX(points.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${PAD.left},${(PAD.top + innerH).toFixed(1)} Z`

  const gridVals = [maxV, minV + range * 0.5, minV]

  // PR = hogsta punkten
  const prIdx = vals.indexOf(maxV)
  const lastIdx = points.length - 1

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg}>
      <defs>
        <linearGradient id="progArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridVals.map((v, i) => {
        const y = toY(v)
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} className={styles.gridLine} />
            <text x={PAD.left - 6} y={y + 3.5} className={styles.axisLabel} textAnchor="end">
              {Math.round(v)}
            </text>
          </g>
        )
      })}

      <path d={areaPath} fill="url(#progArea)" />
      <path d={linePath} className={styles.line} fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Vanliga punkter */}
      {points.map((p, i) => {
        if (i === prIdx || i === lastIdx) return null
        return <circle key={i} cx={toX(i)} cy={toY(p.value)} r="2.5" className={styles.dot} />
      })}

      {/* Sista punkten - betonad */}
      <circle cx={toX(lastIdx)} cy={toY(points[lastIdx].value)} r="4.5" className={styles.dotLast} />

      {/* PR-markering */}
      {prIdx !== lastIdx && (
        <>
          <circle cx={toX(prIdx)} cy={toY(maxV)} r="4" className={styles.dotPr} />
          <text x={toX(prIdx)} y={toY(maxV) - 9} className={styles.prLabel} textAnchor="middle">PR</text>
        </>
      )}
      {prIdx === lastIdx && (
        <text x={toX(lastIdx)} y={toY(maxV) - 11} className={styles.prLabel} textAnchor="middle">PR</text>
      )}

      {/* Datumetiketter */}
      <text x={PAD.left} y={H - 6} className={styles.dateLabel} textAnchor="start">{fmtDate(points[0].date)}</text>
      <text x={W - PAD.right} y={H - 6} className={styles.dateLabel} textAnchor="end">{fmtDate(points[lastIdx].date)}</text>
    </svg>
  )
}

export default function ProgressView({ open, onClose, workouts, equipmentMap = {} }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (open) { setSelected(null); setQuery('') }
  }, [open])

  // Ovningar med data, sorterade efter mest tranade forst
  const exercises = useMemo(() => {
    const counts = new Map()
    for (const w of workouts) {
      for (const ex of w.exercises ?? []) {
        if ((ex.sets ?? []).some(s => s.type === 'work' && s.done && s.weight)) {
          counts.set(ex.name, (counts.get(ex.name) ?? 0) + 1)
        }
      }
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'sv'))
  }, [workouts])

  const filtered = query.trim()
    ? exercises.filter(e => e.name.toLowerCase().includes(query.toLowerCase()))
    : exercises

  // Datapunkter for vald ovning
  const data = useMemo(() => {
    if (!selected) return null
    const equipment = equipmentMap[selected]
    const sorted = [...workouts].sort((a, b) => new Date(a.finished_at) - new Date(b.finished_at))
    const points = []
    for (const w of sorted) {
      const ex = (w.exercises ?? []).find(e => e.name === selected)
      if (!ex) continue
      const rm = bestRM(ex.sets, equipment)
      if (rm > 0) points.push({ date: w.finished_at, value: rm })
    }
    const trimmed = points.slice(-20)
    if (trimmed.length === 0) return { points: [], isDouble: equipment === 'Hantel' }

    const current = trimmed[trimmed.length - 1].value
    const start = trimmed[0].value
    const change = current - start
    const pct = start > 0 ? (change / start) * 100 : 0
    const pr = Math.max(...trimmed.map(p => p.value))
    const prPoint = trimmed.find(p => p.value === pr)
    return {
      points: trimmed,
      isDouble: equipment === 'Hantel',
      current, start, change, pct, pr,
      prDate: prPoint?.date,
    }
  }, [selected, workouts, equipmentMap])

  if (!open) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        {selected ? (
          <button className={styles.backBtn} onClick={() => setSelected(null)} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {selected}
          </button>
        ) : (
          <span className={styles.title}>Min styrkeutveckling</span>
        )}
        <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Stäng">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {selected && data ? (
        <div className={styles.scrollArea}>
          {data.points.length >= 2 ? (
            <>
              <div className={styles.statHero}>
                <div className={styles.heroMain}>
                  <span className={styles.heroValue}>{fmtKg(Math.round(data.current))}</span>
                  <span className={styles.heroUnit}>kg</span>
                </div>
                <span className={styles.heroLabel}>estimerat 1RM nu</span>
                <div className={`${styles.changePill} ${data.change >= 0 ? styles.up : styles.down}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    {data.change >= 0
                      ? <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      : <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
                  </svg>
                  {data.change >= 0 ? '+' : ''}{fmtKg(Math.round(data.change))} kg ({data.change >= 0 ? '+' : ''}{Math.round(data.pct)}%) sedan start
                </div>
              </div>

              <div className={styles.chartCard}>
                <ProgressChart points={data.points} />
              </div>

              <div className={styles.prRow}>
                <span className={styles.prStar}>★</span>
                <span>PR: <strong>{fmtKg(Math.round(data.pr))} kg</strong>{data.prDate ? ` · ${fmtDate(data.prDate)}` : ''}</span>
              </div>

              <p className={styles.explainer}>
                Estimerat 1RM beräknas från vikt och reps (Epley) – ett mått på din maxstyrka även när du inte kör singlar.
                {data.isDouble && ' Hantelvikt visas som total (×2).'}
              </p>
            </>
          ) : (
            <div className={styles.chartCard}>
              <ProgressChart points={data.points} />
            </div>
          )}
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
            {filtered.map(e => (
              <button key={e.name} className={styles.listItem} onClick={() => setSelected(e.name)} type="button">
                <span className={styles.listItemName}>{e.name}</span>
                <span className={styles.listItemMeta}>{e.count} pass</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className={styles.noResults}>
                {query ? 'Ingen övning hittades' : 'Träna några pass med vikter för att se din utveckling här.'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
