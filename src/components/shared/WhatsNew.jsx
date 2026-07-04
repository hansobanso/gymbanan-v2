import { AnimatePresence, motion } from 'framer-motion'
import styles from './WhatsNew.module.css'

// Hoj denna nar nya nyheter ska visas for alla igen.
export const WHATSNEW_VERSION = '2026-07-polish'

const ITEMS = [
  {
    title: 'Fira dina rekord',
    body: 'Slår du ditt bästa estimerade 1RM visas ett gyllene PR-kort direkt när passet är klart. Passtiden syns nu också på klart-skärmen och i historiken.',
  },
  {
    title: 'Kopiera och gör program till dina egna',
    body: 'Öppna ett program och tryck "Kopiera & anpassa" – du får en egen kopia att ändra fritt i. Sparar du ändringar efter ett pass blir kopian automatiskt ditt aktiva program.',
  },
  {
    title: 'Tryggare historik',
    body: 'Råkade du svajpa bort ett pass? Tryck Ångra i rutan som dyker upp så är det tillbaka.',
  },
  {
    title: 'Tydligare muskelgubbe',
    body: 'En liten förklaring visar vad färgerna betyder, och gubben räknar nu även sekundärmuskler – så hela bilden av din träning syns.',
  },
  {
    title: 'Ny chatt med PT:n',
    body: 'Börja om konversationen när du vill med nya "Ny chatt"-knappen i PT-fliken.',
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
