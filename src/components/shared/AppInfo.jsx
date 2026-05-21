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
          RIR betyder "Reps In Reserve" – hur många reps du hade kvar i tanken när
          du la av setet. RIR 2 = du hade orkat 2 till, RIR 0 = totalt slut. Du
          loggar RIR på varje set, och det är så appen vet om du är redo att
          progrediera: ligger du på lågt RIR (0–1) på toppen av ditt rep-intervall
          har du maxat vikten och appen föreslår en höjning nästa pass. Ligger du
          på högt RIR (3+) finns det mer att ge innan vikten ökar. På så vis styr
          RIR tillsammans med rep-intervallet exakt när och hur mycket du går upp.
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
