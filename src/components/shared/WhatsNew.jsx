import { AnimatePresence, motion } from 'framer-motion'
import styles from './WhatsNew.module.css'

// Hoj denna nar nya nyheter ska visas for alla igen. OBS: dev och live delar
// databas, sa hoj den forst nar texten slapps till main. Annars visas rutan
// om och om igen i den miljo som har den andra versionen.
export const WHATSNEW_VERSION = '2026-07-polish'

const ITEMS = [
  {
    title: 'Ny startsida',
    body: 'Veckan överst: tryck på en tränad dag för att se passet, svep åt höger för tidigare veckor. Muskelläget visar vad som är redo, vad som vilar och vad du inte tränat på länge.',
  },
  {
    title: 'Enklare pass',
    body: 'Setet du är på står i mitten med stora siffror. Klara övningar fälls ihop till en rad och får en PB-markering om du slog rekord.',
  },
  {
    title: 'Svep mellan pass och startsida',
    body: 'Dra från vänsterkanten för att lämna passet utan att avsluta det. Dra från högerkanten för att komma tillbaka.',
  },
  {
    title: 'Se vad passet tränar',
    body: 'Passbyggaren visar en muskelgubbe som lyser upp när du lägger till övningar. Varje övning visar primära, sekundära och tertiära muskler.',
  },
]

export default function WhatsNew({ open, onClose }) {
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
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.header}>
              <span className={styles.badge}>Nytt</span>
              <h2 className={styles.title}>Nyheter i Gymbanan</h2>
            </div>

            <div className={styles.list}>
              {ITEMS.map((it, i) => (
                <div key={i} className={styles.item}>
                  <div className={styles.dot} />
                  <div>
                    <p className={styles.itemTitle}>{it.title}</p>
                    <p className={styles.itemBody}>{it.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <button className={styles.closeBtn} onClick={onClose} type="button">
              Toppen!
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
