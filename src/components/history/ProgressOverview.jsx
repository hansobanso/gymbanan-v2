import { useMemo, useState } from 'react'
import { progressOverview, fmtTonnage, fmtRough } from '../../lib/progressStats'
import { displayWeightStr } from '../../lib/weightUtils'
import { BananaIcon } from '../shared/Icons'
import styles from './ProgressOverview.module.css'

const PERIODS = [
  { key: '3m', label: '3 mån', days: 90, text: 'på tre månader' },
  { key: '1y', label: '1 år', days: 365, text: 'på ett år' },
  { key: 'all', label: 'Allt', days: null, text: 'sedan start' },
]
const MONTHS_SHORT = ['jan', 'feb', 'mars', 'april', 'maj', 'juni', 'juli', 'aug', 'sep', 'okt', 'nov', 'dec']
const fmtDate = iso => { const d = new Date(iso); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` }
const fmtNum = v => String(Math.round(v * 10) / 10).replace('.', ',')
const signed = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtNum(Math.abs(v))}`

/** Liten kurva utan axlar. Sista punkten markeras. */
function Spark({ points, up, width = 72, height = 26 }) {
  if (points.length < 2) return <svg width={width} height={height} aria-hidden="true" />
  const vals = points.map(p => p.value)
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = max - min || 1
  const x = i => 3 + (i / (points.length - 1)) * (width - 6)
  const y = v => height - 4 - ((v - min) / span) * (height - 8)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const color = up ? 'var(--d-ok)' : '#8A8A8A'
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className={styles.spark}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(vals[vals.length - 1])} r="3" fill={color} />
    </svg>
  )
}

function Change({ lift }) {
  if (lift.pct == null) return <span className={styles.flat}>1 pass</span>
  const unit = lift.mode === 'weight' ? 'kg' : 'reps'
  // Sma svangningar ar brus, inte ett tapp
  if (Math.abs(lift.pct) < 1) return <span className={styles.flat}>stabil</span>
  return (
    <span className={lift.pct > 0 ? styles.up : styles.flat}>
      {signed(lift.change)} {unit}
    </span>
  )
}

/** Framsteg: det viktigaste forst, sedan alla ovningar. */
export default function ProgressOverview({ workouts, loading, onSelect }) {
  const [period, setPeriod] = useState('3m')
  const [query, setQuery] = useState('')
  const p = PERIODS.find(x => x.key === period)
  const o = useMemo(() => progressOverview(workouts, p.days), [workouts, p.days])

  const shown = query.trim()
    ? o.lifts.filter(l => l.name.toLowerCase().includes(query.toLowerCase()))
    : o.lifts

  const pct = o.headline ? Math.round(o.headline.pct) : null

  return (
    <div className={styles.wrap}>
      <div className={styles.periods} role="tablist" aria-label="Period">
        {PERIODS.map(x => (
          <button key={x.key} className={`${styles.period} ${period === x.key ? styles.periodOn : ''}`} onClick={() => setPeriod(x.key)} role="tab" aria-selected={period === x.key} type="button">
            {x.label}
          </button>
        ))}
      </div>

      {o.count === 0 ? (
        <div className={styles.empty}>
          <span className="empty-banana"><BananaIcon /></span>
          <p className={styles.emptyTitle}>{loading ? 'Räknar…' : 'Inga pass i den här perioden'}</p>
          {!loading && <p className={styles.emptyText}>Välj en längre period, eller kör ett pass så börjar kurvan här.</p>}
        </div>
      ) : (
        <>
          <section className={styles.hero}>
            {pct == null ? (
              <>
                <span className={styles.heroWord}>På gång</span>
                <span className={styles.heroLabel}>Kör samma övning två gånger, så kan vi mäta hur mycket starkare du blir.</span>
              </>
            ) : pct >= 1 ? (
              <>
                <span className={styles.heroNum}>+{pct}<span className={styles.heroPct}>%</span></span>
                <span className={styles.heroLabel}>starkare {p.text}</span>
                <span className={styles.heroSub}>Typisk ökning över {o.headline.count} övningar, räknat på estimerat 1RM.</span>
              </>
            ) : (
              <>
                <span className={styles.heroWord}>Håller nivån</span>
                <span className={styles.heroLabel}>{p.text}</span>
                <span className={styles.heroSub}>Styrkan ligger kvar över {o.headline.count} övningar. Det är också ett resultat.</span>
              </>
            )}
          </section>

          <div className={styles.stats}>
            <div className={styles.stat}><span className={styles.num}>{o.count}</span><span className={styles.unit}>pass</span></div>
            <div className={styles.stat}><span className={styles.num}>{fmtTonnage(o.tonnageKg)}</span><span className={styles.unit}>lyft totalt</span></div>
            <div className={styles.stat}><span className={`${styles.num} ${o.pbs.length ? styles.numPb : ''}`}>{o.pbs.length}</span><span className={styles.unit}>PB</span></div>
          </div>

          {o.bananas >= 1000 && (
            <p className={styles.banana}>
              <span className={styles.bananaIcon}><BananaIcon /></span>
              {fmtTonnage(o.tonnageKg)} är ungefär {fmtRough(o.bananas)} bananer.
            </p>
          )}

          {o.movers.length > 0 && (
            <section className={styles.block}>
              <span className={styles.label}>Går starkast framåt</span>
              <div className={styles.movers}>
                {o.movers.map((l, i) => (
                  <button key={l.name} className={styles.mover} onClick={() => onSelect(l.name)} type="button">
                    <span className={styles.rank}>{i + 1}</span>
                    <span className={styles.moverText}>
                      <span className={styles.moverName}>{l.name}</span>
                      <span className={styles.moverMeta}>
                        {signed(l.change)} {l.mode === 'weight' ? 'kg' : 'reps'} · nu {fmtNum(l.current)} {l.mode === 'weight' ? 'kg' : 'reps'}
                      </span>
                    </span>
                    <span className={styles.moverPct}>+{Math.round(l.pct)} %</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {o.pbs.length > 0 && (
            <section className={styles.block}>
              <span className={styles.label}>Senaste PB</span>
              <div className={styles.rows}>
                {o.pbs.slice(0, 5).map((pb, i) => (
                  <button key={`${pb.name}-${pb.date}-${i}`} className={styles.row} onClick={() => onSelect(pb.name)} type="button">
                    <span className={styles.pbBadge}>PB</span>
                    <span className={styles.rowText}>
                      <span className={styles.rowName}>{pb.name}</span>
                      <span className={styles.rowMeta}>{fmtDate(pb.date)}</span>
                    </span>
                    <span className={styles.pbValue}>
                      {pb.weight > 0 ? `${displayWeightStr(pb.weight)} kg × ${pb.reps}` : `${pb.reps} reps`}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className={styles.block}>
            <span className={styles.label}>Alla övningar</span>
            {o.lifts.length > 8 && (
              <input className={styles.search} type="text" placeholder="Sök övning…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Sök övning" />
            )}
            <div className={styles.rows}>
              {shown.map(l => (
                <button key={l.name} className={styles.row} onClick={() => onSelect(l.name)} type="button">
                  <span className={styles.rowText}>
                    <span className={styles.rowName}>{l.name}</span>
                    <span className={styles.rowMeta}>
                      {fmtNum(l.current)} {l.mode === 'weight' ? 'kg e1RM' : 'reps'} · {l.count} pass
                    </span>
                  </span>
                  <Spark points={l.points.slice(-12)} up={l.pct != null && l.pct >= 1} />
                  <span className={styles.change}><Change lift={l} /></span>
                </button>
              ))}
              {shown.length === 0 && <p className={styles.noHit}>Ingen övning hittades</p>}
            </div>
            <p className={styles.foot}>e1RM är estimerat max för ett rep, räknat från vikt och reps. Anpassade pass räknas inte med.</p>
          </section>
        </>
      )}
    </div>
  )
}
