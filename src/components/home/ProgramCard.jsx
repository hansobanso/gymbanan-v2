import { useState } from 'react'
import styles from './ProgramCard.module.css'

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8L6.5 11.5L13 5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ProgramCard({ program, programs, onSelectProgram, onStartSession }) {
  const [showPicker, setShowPicker] = useState(false)
  const sessions = program.sessions ?? []
  const hasMultiple = programs.length > 1

  return (
    <div className={styles.card}>
      {/* Program rubrik – klickbar om det finns flera program */}
      <button
        className={styles.header}
        onClick={() => hasMultiple && setShowPicker(v => !v)}
        disabled={!hasMultiple}
        aria-expanded={showPicker}
      >
        <span className={styles.programName}>{program.name}</span>
        {hasMultiple && (
          <span className={`${styles.chevron} ${showPicker ? styles.chevronUp : ''}`}>
            <ChevronIcon />
          </span>
        )}
      </button>

      {/* Program-picker */}
      {showPicker && (
        <div className={styles.picker}>
          {programs.map(p => (
            <button
              key={p.id}
              className={`${styles.pickerItem} ${p.id === program.id ? styles.pickerItemActive : ''}`}
              onClick={() => {
                onSelectProgram(p)
                setShowPicker(false)
              }}
            >
              <span>{p.name}</span>
              {p.id === program.id && <CheckIcon />}
            </button>
          ))}
        </div>
      )}

      {/* Sessions */}
      <div className={styles.sessions}>
        {sessions.length === 0 ? (
          <p className={styles.empty}>Inga pass i programmet ännu</p>
        ) : (
          sessions.map((s, i) => (
            <div key={s.id ?? i} className={styles.row}>
              <div className={styles.rowInfo}>
                <span className={styles.rowLabel}>Pass {i + 1}</span>
                <span className={styles.rowName}>{s.name}</span>
                {(s.exercises?.length ?? 0) > 0 && (
                  <span className={styles.rowMeta}>{s.exercises.length} övningar</span>
                )}
              </div>
              <button
                className={styles.startBtn}
                onClick={() => onStartSession(s)}
              >
                Starta
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
