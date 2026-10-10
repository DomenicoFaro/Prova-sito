// Controllo "nessuna regressione": ogni pagina si apre senza errori JavaScript e mostra qualcosa.
import puppeteer from 'puppeteer-core'
import { BASE, EDGE, imp, voci } from './dati.mjs'

const SUPA = 'abcdefghijklmnopqrst.supabase.co'
const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] })

const jwt = (o) => 'x.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.y'
const sessione = (id) => ({ access_token: jwt({ sub: id, exp: 4102444800, role: 'authenticated' }), token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user: { id, aud: 'authenticated', role: 'authenticated', email: 'u@x.it', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } })
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
const progetto = { id: 'p1', nome: 'Café Sauvage', cliente: 'Cafè', url: null, categoria: 'Ristorazione', descrizione: 'd', funzionalita: [], tecnologie: [], screenshot_url: null, galleria: [], prezzo_totale: 1000, incassato: 300, ordine_id: null, data_consegna: null, stato: 'in_lavorazione', pubblico: true, gestore_id: null, created_at: '2026-01-01' }
const dati = {
  progetti: [progetto], portfolio: [progetto], v_guadagni: [], assegnazioni: [], pagamenti: [], vendite: [], opportunita: [], richieste_contatto: [], ordini_siti: [],
  prezzi: [{ id: '1', tipo: 'sito', nome: 'Vetrina', descrizione: '', prezzo: 300, prezzo_max: null, valuta: '€', a_partire_da: false, periodicita: '', caratteristiche: [], in_evidenza: false, ordine: 0, attivo: true }],
  configuratore_voci: voci, configuratore_impostazioni: imp,
}

async function pagina(ruolo, id) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  if (ruolo) await page.evaluateOnNewDocument((k, s) => localStorage.setItem(k, JSON.stringify(s)), 'sb-abcdefghijklmnopqrst-auth-token', sessione(id))
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (url.host !== SUPA) return req.continue()
    const r = (c, st = 200) => req.respond({ status: st, headers: CORS, contentType: 'application/json', body: JSON.stringify(c) })
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS })
    const tab = url.pathname.split('/').pop()
    const singolo = (req.headers().accept ?? '').includes('pgrst.object')
    if (tab === 'profiles') { const p = { id, nome: 'Utente', email: 'u@x.it', avatar_url: null, ruolo, percentuale_default: 20, attivo: true, responsabile_id: null, created_at: '2026-01-01' }; return r(singolo ? p : [p]) }
    if (tab === 'riepilogo_azienda') return r([])
    if (tab === 'leggi_ordine') return r(null)
    if (req.method() !== 'GET') return req.respond({ status: 201, headers: CORS })
    return r(dati[tab] ?? [])
  })
  const errori = []
  page.on('pageerror', (e) => errori.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errori.push('console: ' + m.text().slice(0, 150)) })
  return { page, errori }
}

const gruppi = [
  [null, 'u0', ['/', '/portfolio', '/prezzi', '/sito-su-misura', '/acquista-sito-su-misura', '/prova-un-mese', '/ordine/11111111-2222-3333-4444-555555555555', '/login', '/password-dimenticata', '/pagina-inesistente']],
  ['admin', 'ua', ['/area', '/area/admin', '/area/admin/progetti', '/area/admin/progetti/nuovo', '/area/admin/progetti/p1', '/area/admin/preventivi', '/area/admin/pagamenti', '/area/admin/vendite', '/area/admin/opportunita', '/area/admin/collaboratori', '/area/prezzi', '/area/profilo']],
  ['collaboratore', 'uc', ['/area', '/area/dashboard', '/area/vendite', '/area/vendite/nuova', '/area/opportunita', '/area/prezzi', '/area/profilo']],
]

let totale = 0, problemi = 0
for (const [ruolo, id, rotte] of gruppi) {
  console.log(`\n${ruolo ? 'Utente: ' + ruolo : 'Visitatore'}`)
  const { page, errori } = await pagina(ruolo, id)
  for (const rotta of rotte) {
    errori.length = 0
    await page.goto(BASE + rotta, { waitUntil: 'networkidle0' })
    await new Promise((r) => setTimeout(r, 250))
    const info = await page.evaluate(() => ({ testo: document.body.innerText.trim().length, path: location.pathname, errore: /Si è verificato un errore|Something went wrong|Unexpected Application Error/i.test(document.body.innerText) }))
    totale++
    const male = errori.length > 0 || info.testo < 20 || info.errore
    if (male) problemi++
    console.log(`  ${male ? 'FAIL' : 'ok  '} ${rotta}${info.path !== rotta ? '  →  ' + info.path : ''}${male ? `   [${info.testo} car.${errori.length ? ', errori: ' + errori.join(' | ') : ''}${info.errore ? ', schermata di errore' : ''}]` : ''}`)
  }
  await page.close()
}
await browser.close()
console.log(`\n${totale} pagine controllate, ${problemi} con problemi`)
process.exit(problemi ? 1 : 0)
