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
          intervallet föreslår appen automatiskt att du höjer vikten nästa pass –
          och sänker repsen till botten av intervallet igen. Så blir du starkare steg för steg.
        </p>
      </div>

      <div className={styles.feature}>
        <span className={styles.title}>
          <GaugeIcon className={styles.icon} />
          RIR – hur hårt du tar i
        </span>
        <p className={styles.body}>
          RIR betyder "Reps In Reserve" – hur många reps du hade kvar i tanken
          när du la av setet. RIR 2 = du hade orkat 2 till, RIR 0 = totalt slut.
          Du loggar RIR på dina set, och appen använder det för att avgöra när
          det är dags att höja vikten.
        </p>
      </div>

      <div className={styles.feature}>
        <span className={styles.title}>
          <ChatIcon className={styles.icon} />
          Prata med din PT
        </span>
        <p className={styles.body}>
          Starta ett fritt pass och be PT sätta ihop ett helt pass åt dig –
          t.ex. "ett benpass" eller "helkropp med bara kroppsvikt". Under passet
          kan du fråga om teknik, be om ett övningsalternativ, eller låta PT
          justera vikterna om du t.ex. varit sjuk eller känner dig stark.
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
