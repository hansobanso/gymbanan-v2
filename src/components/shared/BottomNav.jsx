import { NavLink } from 'react-router-dom'
import styles from './BottomNav.module.css'

function IconHome({ active }) {
  const c = active ? 'var(--accent)' : 'var(--text-3)'
  // Lucide: house
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    </svg>
  )
}

function IconHistory({ active }) {
  const c = active ? 'var(--accent)' : 'var(--text-3)'
  // Lucide: clock
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 6v6l4 2"/>
      <circle cx="12" cy="12" r="10"/>
    </svg>
  )
}

function IconPrograms({ active }) {
  const c = active ? 'var(--accent)' : 'var(--text-3)'
  // Lucide: list
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h.01"/>
      <path d="M3 18h.01"/>
      <path d="M3 6h.01"/>
      <path d="M8 12h13"/>
      <path d="M8 18h13"/>
      <path d="M8 6h13"/>
    </svg>
  )
}

function IconSettings({ active }) {
  const c = active ? 'var(--accent)' : 'var(--text-3)'
  // Lucide: settings
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
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
