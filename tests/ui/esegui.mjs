// Avvia il sito con un Supabase FINTO, esegue i test nel browser (Edge/Chrome) e chiude tutto.
// Esegui con:  npm run test:ui     (serve Edge o Chrome; altrimenti imposta la variabile EDGE_PATH)
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const radice = fileURLToPath(new URL('../..', import.meta.url))
const env = { ...process.env, VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', VITE_SUPABASE_ANON_KEY: 'chiave-di-prova' }
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5199', '--strictPort'], { cwd: radice, env, stdio: 'ignore' })

async function attendiServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch('http://localhost:5199/')).ok) return
    } catch {
      /* non ancora pronto */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('Il sito di prova non si avvia.')
}
const esegui = (file) =>
  new Promise((ok) => spawn(process.execPath, [fileURLToPath(new URL(file, import.meta.url))], { stdio: 'inherit' }).on('exit', (c) => ok(c)))

let codice = 0
try {
  await attendiServer()
  for (const f of ['./ui.mjs', './ui_prova.mjs', './ui_admin.mjs', './smoke.mjs']) {
    console.log('\n=== ' + f + ' ===')
    if (await esegui(f)) codice = 1
  }
} finally {
  vite.kill()
}
process.exit(codice)
