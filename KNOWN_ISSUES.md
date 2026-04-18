# Kända Issues - Gymbanan v2

## iOS Safari PWA Safe-Area Rendering Bug

**Status:** Väntar på Apple-fix  
**Påverkar:** iPhone X och senare (enheter med hemindikator)  
**Datum identifierat:** 2026-04-18  

### Beskrivning
På iOS-enheter med hemindikator (iPhone X, 11, 12, 13, 14, 15 etc.) visas ibland en "svart död zon" under BottomNav-menyn när appen körs som PWA från hemskärmen. Zonen gör att appen känns "avhuggen" och inte utnyttjar hela skärmens höjd.

### Teknisk orsak
iOS Safari WebKit har en känd rendering-bug där `env(safe-area-inset-bottom)` returnerar felaktiga värden (ofta 0) vid första laddning av PWA:er med `viewport-fit=cover`. Buggen korrigerar sig själv vid:
- Enhetsrotation (landscape → portrait)
- Force-refresh av appen
- Viss DOM-manipulation

### Bevis för att det är Apple-bug
1. ✅ **Endast iOS** - fungerar korrekt på desktop och Android
2. ✅ **Försvinner vid rotation** - typiskt för rendering-buggar
3. ✅ **PWA-specifik** - olika beteende än vanlig Safari
4. ✅ **CSS-fixar har ingen effekt** - antyder WebKit-problem

### Tested fixar (fungerar inte)
- [x] CSS fallbacks med dubbla padding-bottom deklarationer
- [x] JavaScript force-reflow via DOM-manipulation
- [x] position: fixed på #root istället för height: 100dvh
- [x] Explicit safe-area CSS variabler

### Safari DevTools-diagnostik
När buggen uppträder visar Safari DevTools:
```
.nav {
  padding-bottom: 0px; // Ska vara 34px på iPhone 12 Pro
}
```

CSS-variabeln `--safe-bottom` returnerar korrekt värde (34px) men `env(safe-area-inset-bottom)` returnerar 0, vilket gör alla safe-area CSS-regler ineffektiva.

### Workaround för användare
Om problemet stör: rotera enheten horisontellt, sedan tillbaka till vertikalt läge. Buggen försvinner tillfälligt tills nästa app-omstart.

### Framtida lösning
Apple brukar åtgärda dessa typer av rendering-buggar i iOS-uppdateringar. Ingen action krävs från vår sida - vänta på framtida iOS/Safari-uppdateringar.

### Relaterade webbutvecklar-diskussioner
- WebKit Bugzilla: safe-area-inset bugs med PWA
- Stack Overflow: "viewport-fit=cover not working on iOS Safari PWA"
- Apple Developer Forums: Safe Area layout issues

---

*Dokumenterat av: Claude & Hannes*  
*Senast uppdaterat: 2026-04-18*
