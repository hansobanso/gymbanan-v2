# Gymbanan – handbok för nya sessioner

Läs den här filen först. Den ersätter att läsa gamla chattar. Kör sedan
`git log --oneline -20` för att se exakt var arbetet står: commit-meddelandena
är den mest pålitliga "var slutade vi"-källan.

Senast uppdaterad: 2026-11-12.

## Vad det är

Svensk gym-app (PWA) för styrketräning med automatisk progression och en
AI-PT. Hannes är ensam utvecklare och i praktiken enda användare. Han testar
i den riktiga appen på sin iPhone och ger feedback på svenska, ofta mitt i
ett pass.

- Live: gymbanan.se (Cloudflare Pages, branch `main`)
- Dev: dev.gymbanan.pages.dev (branch `dev`)
- Repo: github.com/hansobanso/gymbanan-v2 (privat)
- Databas: Supabase, projekt-id `txwszpetcouyfoyhimmr`
- Stack: React 19 + Vite, Supabase, framer-motion, vitest

## Så jobbar vi

- Claude skriver, testar och pushar all kod. Hannes granskar i appen.
- Var rak men uppmuntrande. Leta aktivt efter buggar och förbättringar.
- Normalflöde: commit på `dev`, push, `main` snabbspolas fram till `dev`
  och pushas. Hannes har sagt att direkt till produktion är okej.
- UNDANTAG: tränar Hannes just nu rör vi inte `main`. Lägg ändringen på
  `dev` och släpp den när passet är sparat (kolla `workouts.finished_at`).
- En logisk ändring per commit. Commit-meddelanden på svenska med ASCII
  (å→a, ä→a, ö→o).
- Hannes ber ofta om något mitt i ett pass. Bygg det, men det påverkar
  bara framtida pass eftersom appen han kör redan är laddad.

## Deploy-grinden

Varje push till `main` eller `dev` kör `.github/workflows/deploy.yml`:
krasch-lint → tester → bygge → deploy (ca 1 minut).

Kör samma sak lokalt före varje push:

```
npm run crash-lint   # TDZ + dubblerade nycklar (ger vit skärm i prod)
npm test             # vitest, progressionsmotorn
npm run build
```

Full ESLint är inte en grind. Den larmar om `motion` som oanvänd (falskt)
och om setState i effekter (befintligt mönster). Titta bara på nya fel.

## Viktigaste filerna

| Fil | Ansvar |
|---|---|
| `src/hooks/useWorkout.js` | Passets hela tillstånd: set, förifyllning, PB, lokal sparning, avslut |
| `src/lib/progression.js` | Ren progressionslogik utan React. Har tester |
| `src/screens/Workout.jsx` | Passvyn: timer, anpassa passet, avsluta, spara till program |
| `src/components/workout/ExerciseBlock.jsx` | Övningsblock: klar/kommande som en rad, öppen med settabell (Set/Förra/Idag) |
| `src/components/workout/SetHero.jsx` | Det öppna setet: stora siffror, +/−, RIR-knapp, "Set klart" |
| `src/components/workout/RestDock.jsx` | Vilotimern som docka längst ner |
| `src/components/home/HomeScreen.jsx`, `src/lib/homeStats.js` | Startsidan + ren logik (veckoremsa, muskelläge). Har tester |
| `src/lib/db.js` | Alla Supabase-anrop + liten cache |
| `src/App.jsx` | Routing, "Pågående pass"-dialogen, programlista |
| `src/lib/ai.js`, `src/hooks/useAI.js` | PT-intro och PT-chatt via `opta-proxy.gymbanan.workers.dev` |
| `src/components/shared/MuscleMap.jsx` | Muskelgubben (grön veckovy hemma, röd i passet) |
| `src/lib/restSound.js` | Pling när vilan är slut (bara Web Audio) |
| `scripts/crash-lint.mjs` | Krasch-grinden |

Övningar identifieras med NAMN, inte id, genom hela appen.
`src/lib/exerciseAliases.js` lappar ihop omdöpta övningar.

## Regler som Hannes har bestämt

Ändra inte dessa utan att fråga.

**Progression** (`computeProgression`)
- Double progression: behåll vikten och fyll på reps inom intervallet,
  höj vikten när alla set nått taket.
- Rep-ökningen läggs på SISTA setet först: 7+7+7 → 7+7+8 → 7+8+8 → 8+8+8.
- Snitt-RIR 3 eller mer ger +2 reps. Annars +1.
- 0 RIR: befäst samma mål (eller upprepa vikten på taket) EN gång, sedan
  vidare. Får aldrig låsa sig.
- Ändrat antal set skalar om repmålet.

**Nästa set i passet** (`suggestNextSetReps`, körs i `completeSet`)
- 0 RIR → ett rep mindre än nyss. 1 RIR → högst samma. Missad plan →
  förvänta inte mer. Annars behålls planens mål.
- Set som användaren själv fyllt i rörs inte.

**Uppehåll** (`detectGapAdjustment`)
- 8–14 dagar: samma vikter och reps som sist.
- 15–28 dagar: −10 %. Över 28 dagar: −20 %.
- Alla pass räknas som träning, även deload- och sjukpass.

**Anpassa passet** (reglage-ikonen i passets header)
- Lätt dag −10 %, sjuk −25 %, deload-vecka −25 % i 7 dagar.
- Sänker vikten, eller reps på kroppsviktsövningar.
- Passet flaggas `adjusted` och räknas inte in i progressionen.
- "Ingen anpassning" återställer till de vanliga förslagen.
- Under en aktiv deload-vecka sänks varje nytt pass automatiskt.

**Startsidan**
- Inget veckomål. Veckoremsan visar bara gjorda pass, aldrig "missat".
- Muskelläge: Redo / Vilar / Inte tränad på länge. Vila 72 h för bröst,
  rygg och ben, 48 h för övriga, +24 h efter 10 set eller fler. "På länge"
  är 14 dagar.

**Designspråk** (nov 2026): svart bakgrund, kort `--d-card`, gul accent,
grönt för klart, blå `--d-hint` för PT-besked, stora siffror i
`--font-num` (Barlow Condensed). Variablerna `--d-*` ligger i
`src/index.css`. Skisser: https://claude.ai/artifact/4S251Xb86AV2poTdM2m4hM

**PB**: guldcirkel med "PB" när ett set slår tyngsta vikten någonsin (även
1 rep) eller ger fler reps än någonsin på exakt den vikten. Första gången en
övning körs flaggas inget.

**Viktknapparna** följer övningens `weight_increment`, annars hantel 2,
maskin 5, övrigt 2,5.

**AI**: behåll PT-intro och PT-chatt i passet. PT-fliken och AI-feedback
efter passet är borttagna med flit. Kostnaden är några dollar per år.

**Musik får aldrig pausas.** Använd inte `<audio>`-element för ljud. Priset
är att plinget kan utebli med helt släckt skärm.

## Fällor vi redan gått i

- **TDZ**: en `const` eller hook som används före sin definition bygger
  fint men ger vit skärm. Krasch-linten fångar det. Kör den alltid.
- **Tysta databasfel**: `createWorkout` och `updateWorkout` kastar numera.
  Den lokala kopian (`localStorage: gymbanan_active_workout`) raderas först
  när sparningen bekräftats. Bryt aldrig den ordningen.
- **Omladdning mitt i pass**: pass-skärmen får inte monteras medan
  "Pågående pass"-dialogen är obesvarad (se `App.jsx`).
- **`useState` initieras en gång**: härled från props eller synka på
  namn/id när en komponent återanvänds.
- **Grep-verifiera skriptade ändringar**. Flera incidenter kom av
  ersättningar som inte träffade. Använd `assert old in s` i Python-patchar.
- **Kod-fix lagar inte gammal data**. Kolla om databasen också behöver
  repareras, och kör alltid en SELECT före DELETE/UPDATE.
- `workouts` har `started_at`, inte `created_at`.
- `exercises.tertiary_muscles` (text[]) lades till 2026-11-13. Ifylld
  för 213 av 236 övningar med regler per muskelgrupp och övningstyp (högst
  tre per övning, aldrig dubblett av primär/sekundär). Redigeras på
  övningens sida i biblioteket. Räknas inte in i muskelvolymen.
- Supabase gratisnivå pausar efter 7 dagars inaktivitet → svart app.
  Bara Hannes kan väcka den i Supabase-panelen.

## Så testar man utan iPhone

Tester och bygge räcker inte för passflödet. Två metoder som fungerat:

1. **Hook-test**: `npm i --no-save @testing-library/react jsdom`, mocka
   `../lib/db` med `vi.mock` och kör `useWorkout` med `renderHook`. Bra för
   offline, sparfel, PB och återupptagning. Checka inte in beroendena.
2. **Webbläsartest**: starta `VITE_SUPABASE_URL=https://test.supabase.co
   VITE_SUPABASE_ANON_KEY=anon npx vite --port 5199`, kör Playwright med
   `page.route` som fejkar Supabase, lägg en session i localStorage under
   `sb-test-auth-token` och starta ett pass genom att sätta
   `history.pushState({usr: {...}})` på `/workout` och ladda om.
   Mobilvy 390×844. Klicka på knappar via `getByRole`, inte `text=`.
   Startsidan ligger kvar dold under passvyn, så `text=`-väljare kan
   träffa den. `index.css` tvingar `font-size: 16px !important` på alla
   input; större siffror kräver egen `!important`.

## Utanför repot

- **Träningsarkivet**: privat artifact med muskelbalans, övningstabell och
  frågeruta. Uppdateras av en schemalagd uppgift varje söndag 07:23.
  Länk: https://claude.ai/artifact/WbyvCMLRJhUTBRZ4U8AwXb
- **Keep-alive-worker** (`keepalive/`): pingar Supabase dagligen så den
  inte pausas. Ligger i repot men är inte kopplad i Cloudflare ännu
  (Workers & Pages → Create → importera repot → rotkatalog `keepalive`).

## Att göra

- Koppla in keep-alive-workern (Hannes gör det i Cloudflare).
- Flera sekundära muskler per övning + flytta inbyggda övningar till
  databasen. Görs tillsammans, i egen session, med backup först.
- GitHub Actions kör Node 20. Fungerar, men bör uppdateras någon gång.
- Admin-sidan (`src/screens/Admin.jsx`, 2 400 rader) och PT-chattens
  tolkning av svar (`ai.js`) är inte genomlysta på buggar.
- Ungefär hälften av övningarna saknar eget `weight_increment`.

## Hemligheter

Skriv aldrig tokens eller lösenord i den här filen, i projektinstruktioner
eller i en chatt. Git-åtkomst ges per session via repo-kopplingen, inte via
en token i text.
