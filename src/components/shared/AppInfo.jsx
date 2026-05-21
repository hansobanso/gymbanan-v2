import { BananaIcon, TrendIcon, ChatIcon } from './Icons'
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
          intervallet föreslår appen automatiskt att du höjer vikten nästa pass –
          och sänker repsen till botten av intervallet igen. Så blir du starkare steg för steg.
        </p>
      </div>

      <div className={styles.feature}>
        <span className={styles.title}>
          <TrendIcon className={styles.icon} />
          RIR – hur hårt du tar i
        </span>
        <p className={styles.body}>
          RIR betyder "Reps In Reserve" – hur många reps du hade kvar innan du
          inte orkat mer. RIR 2 betyder att du kunde ha gjort 2 reps till. Lågt
          RIR (0–1) = nära utmattning, högt RIR (3–4) = mer i tanken. Logga RIR
          på dina set så förstår appen hur tungt passet kändes och kan föreslå
          rätt vikt nästa gång.
        </p>
      </div>

      <div className={styles.feature}>
        <span className={styles.title}>
          <ChatIcon className={styles.icon} />
          Prata med din PT
        </span>
        <p className={styles.body}>
          Under ett pass kan du chatta med en inbyggd PT. Fråga om teknik, be om
          ett alternativ till en övning, eller få hjälp att lägga upp passet.
        </p>
      </div>

      <div className={styles.feature}>
        <span className={styles.title}>
          <BananaIcon className={styles.icon} />
          Muskelkartan
        </span>
        <p className={styles.body}>
          Muskelgubben fylls från grönt till gult ju mer du tränat varje muskelgrupp.
          Grön = vilad, gul = nyligen tränad.
        </p>
      </div>
    </div>
  )
}
