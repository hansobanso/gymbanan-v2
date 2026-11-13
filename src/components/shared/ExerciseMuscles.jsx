import MuscleMap from './MuscleMap'
import { colorForIntensityRed } from '../../lib/muscleColor'
import styles from './ExerciseMuscles.module.css'

// Hur starkt varje niva lyser pa muskelgubben.
const LEVELS = [
  { key: 'primary', label: 'Primär', intensity: 1 },
  { key: 'secondary', label: 'Sekundär', intensity: 0.5 },
  { key: 'tertiary', label: 'Tertiär', intensity: 0.22 },
]

/**
 * Vilka muskler en ovning tranar: gubbe + lista i tre nivaer.
 * Nivaer utan muskler visas inte.
 */
export default function ExerciseMuscles({ primary, secondary = [], tertiary = [] }) {
  const lists = {
    primary: primary ? [primary] : [],
    secondary: (secondary ?? []).filter(m => m && m !== primary),
    tertiary: (tertiary ?? []).filter(m => m && m !== primary && !(secondary ?? []).includes(m)),
  }
  if (!lists.primary.length && !lists.secondary.length && !lists.tertiary.length) return null

  const intensities = {}
  for (const lvl of [...LEVELS].reverse()) {
    for (const m of lists[lvl.key]) intensities[m] = lvl.intensity
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.figure}>
        <MuscleMap intensities={intensities} colorFn={colorForIntensityRed} size={96} />
      </div>
      <dl className={styles.list}>
        {LEVELS.filter(lvl => lists[lvl.key].length > 0).map(lvl => (
          <div key={lvl.key} className={styles.row}>
            <dt className={styles.level}>
              <span className={styles.swatch} style={{ background: colorForIntensityRed(lvl.intensity) }} />
              {lvl.label}
            </dt>
            <dd className={styles.muscles}>{lists[lvl.key].join(', ')}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
