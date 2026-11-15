import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/shared/ErrorBoundary'
import { installEdgeGuard } from './lib/edgeGuard'

// Registrera INTE service worker pa admin-sidan. SW har root-scope (/),
// vilket far iOS att knyta admin-PWA:n till huvudappen istallet for att
// anvanda admin-manifestets egen scope. Utan SW pa /admin kan iOS skapa
// en separat admin-app pa hemskarmen.
if ('serviceWorker' in navigator) {
  if (window.location.pathname.startsWith('/admin')) {
    // Avregistrera ev. befintlig root-SW sa den inte kontrollerar /admin
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister())
    }).catch(() => {})
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    })
  }
}

installEdgeGuard()

function renderApp() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary><App /></ErrorBoundary>
    </StrictMode>,
  )
}

// Lat startskarmens logga ritas klart (ca 0,75 s fran sidstart) innan React
// startar, annars hackar ritningen. Startskarmen visas anda minst 1,3 s, sa
// det kostar i praktiken ingen tid. Utan startskarm (admin) eller med
// reducerad rorelse: direkt.
const LOGO_DRAWN_MS = 700
const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const wait = document.getElementById('boot-splash') && !reduced
  ? Math.max(0, LOGO_DRAWN_MS - performance.now())
  : 0
if (wait > 0) setTimeout(renderApp, wait)
else renderApp()
