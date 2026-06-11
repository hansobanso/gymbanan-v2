import { AnimatePresence, motion } from 'framer-motion'
import styles from './WhatsNew.module.css'

// Hoj denna nar nya nyheter ska visas for alla igen.
export const WHATSNEW_VERSION = '2026-06-pt'

const ITEMS = [
  {
    title: 'Personlig tränare – egen flik',
    body: 'Prata med PT:n när som helst, utan att starta ett pass. Fråga om träning, teknik och progression.',
  },
  {
    title: 'PT kan ändra i dina program',
    body: 'Be PT:n lägga till, ta bort, byta ut eller flytta övningar mellan pass – du bekräftar innan något sparas.',
  },
  {
    title: 'PT kan skapa nya program',
    body: 'Be PT:n bygga ett helt program med flera pass. Det sparas bland dina program så du kan aktivera det när du vill.',
  },
  {
    title: 'Swipe för att ta bort i Historik',
    body: 'Dra ett pass åt vänster för att ta bort det – enklare än den gamla papperskorgen.',
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
