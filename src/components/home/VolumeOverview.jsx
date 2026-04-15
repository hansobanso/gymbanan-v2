import { EXERCISES, MUSCLE_ALIASES } from '../../data/exercises'
import styles from './VolumeOverview.module.css'

const BASE     = '#1a1a1a'
const FRESH    = '#ef4444'
const MODERATE = '#f97316'
const RESTED   = '#22c55e'
const ZONE_OP  = '0.88'

function computeLastTrained(recentWorkouts) {
  const last = {}
  for (const w of recentWorkouts) {
    const t = new Date(w.finished_at)
    for (const ex of w.exercises ?? []) {
      const libEntry = EXERCISES[ex.name]
      const rawMuscles = libEntry
        ? [libEntry.muscle_group].filter(Boolean)
        : [ex.muscle_group || ex.muscleGroup].filter(Boolean)
      for (const mg of rawMuscles) {
        const resolved = MUSCLE_ALIASES[mg] ?? [mg]
        for (const m of resolved) {
          if (!last[m] || t > last[m]) last[m] = t
        }
      }
    }
  }
  return last
}

function muscleColor(muscle, last) {
  const d = last[muscle]
  if (!d) return null   // null = no zone shown (muscle never trained)
  const h = (Date.now() - d.getTime()) / 3_600_000
  if (h < 48) return FRESH
  if (h < 72) return MODERATE
  return RESTED
}

// Ellipse zone – only renders if muscle has been trained
function Zone({ id, cx, cy, rx, ry, rotate: rot, fill }) {
  if (!fill) return null
  const t = rot ? `rotate(${rot},${cx},${cy})` : undefined
  return (
    <ellipse
      id={id}
      cx={cx} cy={cy}
      rx={rx} ry={ry}
      fill={fill}
      fillOpacity={ZONE_OP}
      transform={t}
    />
  )
}

export default function VolumeOverview({ recentWorkouts = [] }) {
  const last = computeLastTrained(recentWorkouts)
  const c = (m) => muscleColor(m, last)

  // Silhouette shape helper
  const S = (props) => <ellipse fill={BASE} {...props}/>

  return (
    <div className={styles.card}>
      <svg
        viewBox="0 0 200 210"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto', maxWidth: 300, display: 'block' }}
        aria-label="Muskelkarta"
      >
        {/* ═══════════════ FRONT SILHOUETTE (cx=50) ═══════════════ */}

        {/* Legs – drawn first so torso/hips sit on top */}
        <S cx="40" cy="152" rx="8"  ry="18"/>   {/* left calf */}
        <S cx="60" cy="152" rx="8"  ry="18"/>
        <S cx="37" cy="173" rx="9"  ry="5" />   {/* left foot */}
        <S cx="63" cy="173" rx="9"  ry="5" />
        <S cx="40" cy="131" rx="10" ry="9" />   {/* left knee */}
        <S cx="60" cy="131" rx="10" ry="9" />
        <S cx="40" cy="108" rx="12" ry="24"/>   {/* left thigh */}
        <S cx="60" cy="108" rx="12" ry="24"/>

        {/* Hips + waist + chest */}
        <S cx="50" cy="88"  rx="21" ry="12"/>   {/* hips */}
        <S cx="50" cy="68"  rx="17" ry="14"/>   {/* waist */}
        <S cx="50" cy="44"  rx="26" ry="18"/>   {/* chest/shoulders */}

        {/* Arms */}
        <S cx="17" cy="108" rx="5"  ry="18"/>   {/* left forearm */}
        <S cx="15" cy="122" rx="5"  ry="6" />   {/* left hand */}
        <S cx="83" cy="108" rx="5"  ry="18"/>
        <S cx="85" cy="122" rx="5"  ry="6" />
        <S cx="21" cy="60"  rx="6"  ry="22" transform="rotate(-6,21,60)"/>  {/* left upper arm */}
        <S cx="79" cy="60"  rx="6"  ry="22" transform="rotate(6,79,60)"/>

        {/* Neck + head (always on top) */}
        <S cx="50" cy="27"  rx="5"  ry="4" />
        <S cx="50" cy="14"  rx="10" ry="12"/>

        {/* ═══════════════ FRONT MUSCLE ZONES ═══════════════ */}

        {/* Bröst – two angled pec lobes */}
        <Zone id="front-chest-l"    cx="42" cy="44" rx="11" ry="9"  rotate="-9"  fill={c('Bröst')}/>
        <Zone id="front-chest-r"    cx="58" cy="44" rx="11" ry="9"  rotate="9"   fill={c('Bröst')}/>

        {/* Axlar – deltoid bulges bridging arm and shoulder */}
        <Zone id="front-shoulder-l" cx="25" cy="40" rx="9"  ry="7"  rotate="-22" fill={c('Axlar')}/>
        <Zone id="front-shoulder-r" cx="75" cy="40" rx="9"  ry="7"  rotate="22"  fill={c('Axlar')}/>

        {/* Biceps – slim front-of-arm shapes */}
        <Zone id="front-biceps-l"   cx="21" cy="60" rx="4"  ry="15" rotate="-6"  fill={c('Biceps')}/>
        <Zone id="front-biceps-r"   cx="79" cy="60" rx="4"  ry="15" rotate="6"   fill={c('Biceps')}/>

        {/* Core – narrow vertical oval */}
        <Zone id="front-core"       cx="50" cy="67" rx="8"  ry="13"              fill={c('Core')}/>

        {/* Quads – large rounded thigh shapes */}
        <Zone id="front-quads-l"    cx="40" cy="108" rx="10" ry="20"             fill={c('Quads')}/>
        <Zone id="front-quads-r"    cx="60" cy="108" rx="10" ry="20"             fill={c('Quads')}/>

        {/* Vader – tapered calf shapes */}
        <Zone id="front-vader-l"    cx="40" cy="153" rx="6"  ry="14"             fill={c('Vader')}/>
        <Zone id="front-vader-r"    cx="60" cy="153" rx="6"  ry="14"             fill={c('Vader')}/>


        {/* ═══════════════ BACK SILHOUETTE (cx=150) ═══════════════ */}

        <S cx="140" cy="152" rx="8"  ry="18"/>
        <S cx="160" cy="152" rx="8"  ry="18"/>
        <S cx="137" cy="173" rx="9"  ry="5" />
        <S cx="163" cy="173" rx="9"  ry="5" />
        <S cx="140" cy="131" rx="10" ry="9" />
        <S cx="160" cy="131" rx="10" ry="9" />
        <S cx="140" cy="108" rx="12" ry="24"/>
        <S cx="160" cy="108" rx="12" ry="24"/>

        <S cx="150" cy="88"  rx="21" ry="12"/>
        <S cx="150" cy="68"  rx="17" ry="14"/>
        <S cx="150" cy="44"  rx="26" ry="18"/>

        <S cx="117" cy="108" rx="5"  ry="18"/>
        <S cx="115" cy="122" rx="5"  ry="6" />
        <S cx="183" cy="108" rx="5"  ry="18"/>
        <S cx="185" cy="122" rx="5"  ry="6" />
        <S cx="121" cy="60"  rx="6"  ry="22" transform="rotate(-6,121,60)"/>
        <S cx="179" cy="60"  rx="6"  ry="22" transform="rotate(6,179,60)"/>

        <S cx="150" cy="27"  rx="5"  ry="4" />
        <S cx="150" cy="14"  rx="10" ry="12"/>

        {/* ═══════════════ BACK MUSCLE ZONES ═══════════════ */}

        {/* Rygg – broad upper back + lower back */}
        <Zone id="back-rygg-upper"   cx="150" cy="44" rx="19" ry="20"             fill={c('Rygg')}/>
        <Zone id="back-rygg-lower"   cx="150" cy="70" rx="12" ry="9"              fill={c('Rygg')}/>

        {/* Axlar rear – rear deltoid bulges */}
        <Zone id="back-shoulder-l"   cx="125" cy="40" rx="9"  ry="7"  rotate="22"  fill={c('Axlar')}/>
        <Zone id="back-shoulder-r"   cx="175" cy="40" rx="9"  ry="7"  rotate="-22" fill={c('Axlar')}/>

        {/* Triceps – back-of-arm shapes */}
        <Zone id="back-triceps-l"    cx="121" cy="60" rx="4"  ry="15" rotate="-6"  fill={c('Triceps')}/>
        <Zone id="back-triceps-r"    cx="179" cy="60" rx="4"  ry="15" rotate="6"   fill={c('Triceps')}/>

        {/* Rumpa – two rounded glute forms */}
        <Zone id="back-rumpa-l"      cx="143" cy="89" rx="12" ry="12"             fill={c('Rumpa')}/>
        <Zone id="back-rumpa-r"      cx="157" cy="89" rx="12" ry="12"             fill={c('Rumpa')}/>

        {/* Hamstrings – back thigh shapes */}
        <Zone id="back-hamstrings-l" cx="140" cy="108" rx="10" ry="20"            fill={c('Hamstrings')}/>
        <Zone id="back-hamstrings-r" cx="160" cy="108" rx="10" ry="20"            fill={c('Hamstrings')}/>

        {/* Vader back */}
        <Zone id="back-vader-l"      cx="140" cy="153" rx="6"  ry="14"            fill={c('Vader')}/>
        <Zone id="back-vader-r"      cx="160" cy="153" rx="6"  ry="14"            fill={c('Vader')}/>

        {/* Labels */}
        <text x="50"  y="207" textAnchor="middle" fontSize="8" fill="var(--text-3)">Framsida</text>
        <text x="150" y="207" textAnchor="middle" fontSize="8" fill="var(--text-3)">Baksida</text>
      </svg>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.dot} style={{ background: FRESH }}/>
          {'<48h'}
        </span>
        <span className={styles.legendItem}>
          <span className={styles.dot} style={{ background: MODERATE }}/>
          {'48–72h'}
        </span>
        <span className={styles.legendItem}>
          <span className={styles.dot} style={{ background: RESTED }}/>
          {'>72h'}
        </span>
      </div>
    </div>
  )
}
