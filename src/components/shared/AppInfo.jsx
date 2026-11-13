import { BananaIcon, TrendIcon, ChatIcon, GaugeIcon } from './Icons'
import styles from './AppInfo.module.css'

// Delad "Sa funkar appen"-info. Anvands i valkomstkortet (nya anvandare)
// och i Installningar (efter att intro stangts). Texten finns bara har.
export default function AppInfo() {
  return (
    <div className={styles.wrap}>
      <div className={styles.feature}>
        <span className={styles.title}>
          <TrendIcon className={styles.icon} />
          Smart progression
        </span>
        <p className={styles.body}>
          Varje övning har ett rep-intervall, t.ex. 8–12. Klarar du toppen av
          intervallet föreslår appen att du höjer vikten nästa pass
          och börjar om i botten av intervallet. Så blir du starkare steg för steg.
        </p>
      </div>

      <div className={styles.feature}>
        <span className={styles.title}>
          <GaugeIcon className={styles.icon} />
          RIR: hur hårt du tar i
        </span>
        <p className={styles.body}>
          RIR betyder "Reps In Reserve": hur många reps du hade kvar i tanken
          när du la av setet. RIR 2 betyder att du hade orkat 2 till, RIR 0 att det var helt slut.
          Du loggar RIR på dina set, och appen använder det för att avgöra när
          det är dags att höja vikten.
        </p>
      </div>

      <div className={styles.feature}>
        <span className={styles.title}>
          <BananaIcon className={styles.icon} />
          Muskelkartan
        </span>
        <p className={styles.body}>
          Muskelgubben lyser rött där ett pass eller en övning tar. Ju starkare färg,
          desto fler set. Muskelläget på startsidan visar vad som är redo att tränas igen.
        </p>
      </div>
    </div>
  )
}
