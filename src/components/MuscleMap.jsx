import { EXERCISES } from '../data/exercises'

const MUSCLE_MAP = {
  'Bröst':      { front: ['f-brost-l','f-brost-r'], back: [] },
  'Rygg':       { front: [], back: ['b-rygg','b-lrygg'] },
  'Traps':      { front: ['f-trap-l','f-trap-r'], back: ['b-trap-l','b-trap-r'] },
  'Axlar':      { front: ['f-ax-l','f-ax-r'], back: ['b-ax-l','b-ax-r'] },
  'Biceps':     { front: ['f-bic-l','f-bic-r'], back: [] },
  'Triceps':    { front: [], back: ['b-tri-l','b-tri-r'] },
  'Underarmar': { front: ['f-farm-l','f-farm-r'], back: ['b-farm-l','b-farm-r'] },
  'Core':       { front: ['f-mage','p1','p2','p3','p4','p5','p6'], back: ['b-lrygg'] },
  'Quads':      { front: ['f-quad-l','f-quad-r'], back: [] },
  'Hamstrings': { front: [], back: ['b-ham-l','b-ham-r'] },
  'Rumpa':      { front: [], back: ['b-rum-l','b-rum-r'] },
  'Vader':      { front: ['f-vad-l','f-vad-r'], back: ['b-vad-l','b-vad-r'] },
}

const SIXPACK = new Set(['p1','p2','p3','p4','p5','p6'])
const ID_TO_MUSCLE = {}
for (const [muscle, { front, back }] of Object.entries(MUSCLE_MAP)) {
  ;[...front, ...back].forEach(id => { ID_TO_MUSCLE[id] = muscle })
}

function computeIntensities(workouts) {
  const scores = {}
  const now = Date.now()

  for (const workout of workouts) {
    const finishedAt = workout.finished_at ? new Date(workout.finished_at).getTime() : now
    const ageDays = (now - finishedAt) / 86_400_000
    if (ageDays > 7) continue
    const decay = Math.max(0, 1 - ageDays / 7)

    for (const ex of workout.exercises ?? []) {
      const muscleGroup = ex.muscle_group ?? EXERCISES[ex.name]?.muscle_group
      if (!muscleGroup) continue
      const workSets = (ex.sets ?? []).filter(
        s => s.done && s.type !== 'warmup' && s.type !== 'backoff'
      )
      if (workSets.length === 0) continue
      scores[muscleGroup] = (scores[muscleGroup] ?? 0) + workSets.length * decay
    }
  }

  const intensities = {}
  for (const [muscle, score] of Object.entries(scores)) {
    intensities[muscle] = Math.min(1, score / 8)
  }
  return intensities
}

function muscleColor(muscle, intensities) {
  const intensity = intensities[muscle] ?? 0
  if (intensity === 0) return '#1e1e1e'
  return `hsl(48, ${Math.round(intensity * 100)}%, ${Math.round(5 + intensity * 45)}%)`
}

function muscleStroke(muscle, intensities) {
  const intensity = intensities[muscle] ?? 0
  if (intensity === 0) return '#2a2a2a'
  return `hsl(48, ${Math.round(intensity * 100)}%, ${Math.round(10 + intensity * 50)}%)`
}

function fill(id, intensities) {
  const muscle = ID_TO_MUSCLE[id]
  if (!muscle) return SIXPACK.has(id) ? '#141414' : '#1e1e1e'
  // sixpack plates: only color if Core is active
  if (SIXPACK.has(id)) {
    const intensity = intensities['Core'] ?? 0
    return intensity === 0 ? '#141414' : muscleColor('Core', intensities)
  }
  return muscleColor(muscle, intensities)
}

function stroke(id, intensities) {
  const muscle = ID_TO_MUSCLE[id]
  if (!muscle) return '#2a2a2a'
  return muscleStroke(muscle, intensities)
}

function BodyFront({ intensities }) {
  const f = id => fill(id, intensities)
  const s = id => stroke(id, intensities)
  return (
    <svg viewBox="0 0 130 275" width="150" style={{ display: 'block' }}>
      <ellipse cx="65" cy="16" rx="14" ry="15" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
      <rect x="59" y="31" width="12" height="10" rx="4" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
      <rect x="38" y="31" width="19" height="11" rx="5" fill={f('f-trap-l')} stroke={s('f-trap-l')} strokeWidth="1"/>
      <rect x="73" y="31" width="19" height="11" rx="5" fill={f('f-trap-r')} stroke={s('f-trap-r')} strokeWidth="1"/>
      <rect x="18" y="38" width="20" height="22" rx="10" fill={f('f-ax-l')} stroke={s('f-ax-l')} strokeWidth="1"/>
      <rect x="92" y="38" width="20" height="22" rx="10" fill={f('f-ax-r')} stroke={s('f-ax-r')} strokeWidth="1"/>
      <rect x="39" y="43" width="24" height="28" rx="7" fill={f('f-brost-l')} stroke={s('f-brost-l')} strokeWidth="1"/>
      <rect x="67" y="43" width="24" height="28" rx="7" fill={f('f-brost-r')} stroke={s('f-brost-r')} strokeWidth="1"/>
      <rect x="19" y="62" width="17" height="34" rx="8" fill={f('f-bic-l')} stroke={s('f-bic-l')} strokeWidth="1"/>
      <rect x="94" y="62" width="17" height="34" rx="8" fill={f('f-bic-r')} stroke={s('f-bic-r')} strokeWidth="1"/>
      <rect x="19" y="98" width="17" height="42" rx="7" fill={f('f-farm-l')} stroke={s('f-farm-l')} strokeWidth="1"/>
      <rect x="94" y="98" width="17" height="42" rx="7" fill={f('f-farm-r')} stroke={s('f-farm-r')} strokeWidth="1"/>
      <rect x="17" y="142" width="21" height="13" rx="5" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
      <rect x="92" y="142" width="21" height="13" rx="5" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
      <rect x="44" y="73" width="42" height="52" rx="7" fill={f('f-mage')} stroke={s('f-mage')} strokeWidth="1"/>
      <rect x="46" y="75" width="17" height="14" rx="3" fill={f('p1')} stroke={s('p1')} strokeWidth="1"/>
      <rect x="67" y="75" width="17" height="14" rx="3" fill={f('p2')} stroke={s('p2')} strokeWidth="1"/>
      <rect x="46" y="92" width="17" height="14" rx="3" fill={f('p3')} stroke={s('p3')} strokeWidth="1"/>
      <rect x="67" y="92" width="17" height="14" rx="3" fill={f('p4')} stroke={s('p4')} strokeWidth="1"/>
      <rect x="46" y="109" width="17" height="13" rx="3" fill={f('p5')} stroke={s('p5')} strokeWidth="1"/>
      <rect x="67" y="109" width="17" height="13" rx="3" fill={f('p6')} stroke={s('p6')} strokeWidth="1"/>
      <rect x="40" y="127" width="50" height="16" rx="7" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
      <rect x="40" y="145" width="22" height="46" rx="9" fill={f('f-quad-l')} stroke={s('f-quad-l')} strokeWidth="1"/>
      <rect x="68" y="145" width="22" height="46" rx="9" fill={f('f-quad-r')} stroke={s('f-quad-r')} strokeWidth="1"/>
      <rect x="41" y="193" width="20" height="11" rx="5" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
      <rect x="69" y="193" width="20" height="11" rx="5" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
      <rect x="41" y="206" width="19" height="50" rx="8" fill={f('f-vad-l')} stroke={s('f-vad-l')} strokeWidth="1"/>
      <rect x="70" y="206" width="19" height="50" rx="8" fill={f('f-vad-r')} stroke={s('f-vad-r')} strokeWidth="1"/>
      <rect x="38" y="258" width="25" height="10" rx="4" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
      <rect x="68" y="258" width="25" height="10" rx="4" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
    </svg>
  )
}

function BodyBack({ intensities }) {
  const f = id => fill(id, intensities)
  const s = id => stroke(id, intensities)
  return (
    <svg viewBox="0 0 130 275" width="150" style={{ display: 'block' }}>
      <ellipse cx="65" cy="16" rx="14" ry="15" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
      <rect x="59" y="31" width="12" height="10" rx="4" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
      <rect x="38" y="31" width="19" height="11" rx="5" fill={f('b-trap-l')} stroke={s('b-trap-l')} strokeWidth="1"/>
      <rect x="73" y="31" width="19" height="11" rx="5" fill={f('b-trap-r')} stroke={s('b-trap-r')} strokeWidth="1"/>
      <rect x="18" y="38" width="20" height="22" rx="10" fill={f('b-ax-l')} stroke={s('b-ax-l')} strokeWidth="1"/>
      <rect x="92" y="38" width="20" height="22" rx="10" fill={f('b-ax-r')} stroke={s('b-ax-r')} strokeWidth="1"/>
      <rect x="39" y="43" width="52" height="38" rx="9" fill={f('b-rygg')} stroke={s('b-rygg')} strokeWidth="1"/>
      <rect x="19" y="62" width="17" height="34" rx="8" fill={f('b-tri-l')} stroke={s('b-tri-l')} strokeWidth="1"/>
      <rect x="94" y="62" width="17" height="34" rx="8" fill={f('b-tri-r')} stroke={s('b-tri-r')} strokeWidth="1"/>
      <rect x="19" y="98" width="17" height="42" rx="7" fill={f('b-farm-l')} stroke={s('b-farm-l')} strokeWidth="1"/>
      <rect x="94" y="98" width="17" height="42" rx="7" fill={f('b-farm-r')} stroke={s('b-farm-r')} strokeWidth="1"/>
      <rect x="17" y="142" width="21" height="13" rx="5" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
      <rect x="92" y="142" width="21" height="13" rx="5" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
      <rect x="44" y="83" width="42" height="30" rx="7" fill={f('b-lrygg')} stroke={s('b-lrygg')} strokeWidth="1"/>
      <rect x="39" y="115" width="24" height="28" rx="7" fill={f('b-rum-l')} stroke={s('b-rum-l')} strokeWidth="1"/>
      <rect x="67" y="115" width="24" height="28" rx="7" fill={f('b-rum-r')} stroke={s('b-rum-r')} strokeWidth="1"/>
      <rect x="40" y="145" width="22" height="44" rx="9" fill={f('b-ham-l')} stroke={s('b-ham-l')} strokeWidth="1"/>
      <rect x="68" y="145" width="22" height="44" rx="9" fill={f('b-ham-r')} stroke={s('b-ham-r')} strokeWidth="1"/>
      <rect x="41" y="191" width="20" height="11" rx="5" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
      <rect x="69" y="191" width="20" height="11" rx="5" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
      <rect x="41" y="204" width="19" height="50" rx="8" fill={f('b-vad-l')} stroke={s('b-vad-l')} strokeWidth="1"/>
      <rect x="70" y="204" width="19" height="50" rx="8" fill={f('b-vad-r')} stroke={s('b-vad-r')} strokeWidth="1"/>
      <rect x="38" y="256" width="25" height="10" rx="4" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
      <rect x="68" y="256" width="25" height="10" rx="4" fill="#1e1e1e" stroke="#2a2a2a" strokeWidth="1"/>
    </svg>
  )
}

export default function MuscleMap({ workouts = [] }) {
  const intensities = computeIntensities(workouts)
  return (
    <div style={{ display: 'flex', gap: '30px', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        <BodyFront intensities={intensities} />
        <span style={{ fontSize: '11px', color: '#555' }}>Fram</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        <BodyBack intensities={intensities} />
        <span style={{ fontSize: '11px', color: '#555' }}>Bak</span>
      </div>
    </div>
  )
}
