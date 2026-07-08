import { lazy } from 'react'

// Nar appen ar oppen medan en ny version deployas pekar den gamla koden
// pa chunk-filer som inte langre finns pa servern. Dynamisk import
// misslyckas da och skarmen blir svart. Losningen: ladda om sidan EN
// gang automatiskt (da hamtas nya versionen). Flaggan i sessionStorage
// forhindrar omladdnings-loop om felet ar nagot annat.
export function lazyWithRetry(importer) {
  return lazy(() =>
    importer()
      .then((mod) => {
        sessionStorage.removeItem('gymbanan_chunk_reload')
        return mod
      })
      .catch((err) => {
        if (!sessionStorage.getItem('gymbanan_chunk_reload')) {
          sessionStorage.setItem('gymbanan_chunk_reload', '1')
          window.location.reload()
          return new Promise(() => {}) // hall Suspense tills omladdningen sker
        }
        throw err
      })
  )
}
