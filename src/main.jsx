import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/shared/ErrorBoundary'

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
)
