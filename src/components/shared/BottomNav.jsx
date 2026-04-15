import { NavLink } from 'react-router-dom'
import styles from './BottomNav.module.css'

function IconHome({ active }) {
  const c = active ? 'var(--accent)' : 'var(--text-3)'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 11.5L12 3L21 11.5V21H15.5V15.5H8.5V21H3V11.5Z"
        stroke={c}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? 'rgba(245,208,32,0.12)' : 'none'}
      />
    </svg>
  )
}

function IconHistory({ active }) {
  const c = active ? 'var(--accent)' : 'var(--text-3)'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.6" />
      <path d="M12 7V12L15.5 14.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconPrograms({ active }) {
  const c = active ? 'var(--accent)' : 'var(--text-3)'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="2.2" rx="1.1" fill={c} opacity={active ? 1 : 0.7} />
      <rect x="3" y="11" width="18" height="2.2" rx="1.1" fill={c} opacity={active ? 1 : 0.7} />
      <rect x="3" y="17" width="12" height="2.2" rx="1.1" fill={c} opacity={active ? 1 : 0.7} />
    </svg>
  )
}

function IconSettings({ active }) {
  const c = active ? 'var(--accent)' : 'var(--text-3)'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="2.8" stroke={c} strokeWidth="1.6" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke={c}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const TABS = [
  { path: '/', label: 'Hem', Icon: IconHome },
  { path: '/programs', label: 'Program', Icon: IconPrograms },
  { path: '/history', label: 'Historik', Icon: IconHistory },
  { path: '/settings', label: 'Inställningar', Icon: IconSettings },
]

export default function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="Huvudnavigation">
      <div className={styles.tabs}>
        {TABS.map(({ path, label, Icon }) => (
          <NavLink
            key={path}
            to={path}
            end
            className={({ isActive }) => isActive ? `${styles.tab} ${styles.active}` : styles.tab}
          >
            {({ isActive }) => (
              <>
                <span className={styles.icon}>
                  <Icon active={isActive} />
                </span>
                <span className={styles.label}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
