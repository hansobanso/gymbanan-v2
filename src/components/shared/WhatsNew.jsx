import { AnimatePresence, motion } from 'framer-motion'
import styles from './WhatsNew.module.css'

// Hoj denna nar nya nyheter ska visas for alla igen.
export const WHATSNEW_VERSION = '2026-06-pt-2'

const ITEMS = [
  {
    title: 'Smartare personlig tränare',
    body: 'PT:n pratar varmare och mer som en riktig coach. Den ser alla dina program, känner igen dina övningar även när du byter program, och hälsar dig välkommen tillbaka efter en paus med vikter från din historik.',
  },
  {
    title: 'PT bygger och ändrar program',
    body: 'Be PT:n lägga till, ta bort eller flytta övningar – eller skapa ett helt nytt program åt dig. Du bekräftar alltid innan något sparas.',
  },
  {
    title: 'Din styrkeutveckling samlad',
    body: 'En ny vy visar hur du blir starkare över tid – estimerat 1RM, ökning sedan start och dina PR. Funkar även för kroppsviktsövningar som dips och chins.',
  },
  {
    title: 'Skapa egna övningar i appen',
    body: 'Saknar du en övning? Lägg till den direkt från övningsbiblioteket med muskler, utrustning och instruktioner – utan att lämna appen.',
  },
  {
    title: 'Passtid och smidigare historik',
    body: 'Se hur länge ett pass tog, få en tidsuppskattning redan när du bygger programmet, och svajpa för att ta bort pass i historiken.',
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
