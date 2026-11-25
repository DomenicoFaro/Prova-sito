// Anteprima sul computer con dati inventati:  npm run anteprima
// Non tocca il database vero. Chiudendo si perde tutto quello che hai provato.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { avviaBackend, PASSWORD_DEMO } from './backend.mjs'

const radice = fileURLToPath(new URL('../..', import.meta.url))
const PORTA_SITO = 5200
const PORTA_DATI = 54399

await avviaBackend(PORTA_DATI)
const env = { ...process.env, VITE_SUPABASE_URL: `http://127.0.0.1:${PORTA_DATI}`, VITE_SUPABASE_ANON_KEY: 'chiave-di-anteprima' }
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORTA_SITO), '--strictPort'], { cwd: radice, env, stdio: 'inherit' })
vite.on('exit', (c) => process.exit(c ?? 0))

console.log(`
ANTEPRIMA (dati inventati)   http://localhost:${PORTA_SITO}
  admin          admin@demo.it
  collaboratore  collab@demo.it
  cliente        cliente@demo.it
  password       ${PASSWORD_DEMO}
`)
