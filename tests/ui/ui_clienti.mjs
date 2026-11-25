// Percorso completo nel browser: ticket e chat, clienti, cassaforte e recensioni.
// Usa il «Supabase finto» dell'anteprima, con i permessi SQL veri. Nessun database reale.
// Facoltativo: SCATTI=<cartella> salva le schermate.
import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { avviaBackend, PASSWORD_DEMO } from '../anteprima/backend.mjs'

const EDGE = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = 'http://localhost:5201'
const radice = fileURLToPath(new URL('../..', import.meta.url))

const backend = await avviaBackend(54398)
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5201', '--strictPort'], {
  cwd: radice,
  env: { ...process.env, VITE_SUPABASE_URL: 'http://127.0.0.1:54398', VITE_SUPABASE_ANON_KEY: 'chiave-di-prova' },
  stdio: 'ignore',
})
const attendi = (ms) => new Promise((r) => setTimeout(r, ms))
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(BASE)).ok) break
  } catch {
    await attendi(500)
  }
}

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] })
let ok = 0
const falliti = []
const errori = []
async function prova(nome, fn) {
  try {
    await fn()
    ok++
    console.log(`  ok   ${nome}`)
  } catch (e) {
    falliti.push(nome)
    console.log(`  FAIL ${nome}\n       ${e.message.split('\n')[0]}`)
  }
}
const vero = (c, m) => {
  if (!c) throw new Error(m)
}

async function persona(larghezza = 1280) {
  const contesto = await browser.createBrowserContext()
  const page = await contesto.newPage()
  await page.setViewport({ width: larghezza, height: 900 })
  page.on('pageerror', (e) => errori.push(e.message))
  page.setDefaultTimeout(15000)
  return page
}
const testo = (p) => p.evaluate(() => document.body.innerText)
const vede = (p, t) =>
  p.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), { polling: 100 }, t).catch(async () => {
    throw new Error(`manca «${t}» in ${p.url()}: ${(await testo(p)).slice(0, 300).replace(/\n/g, ' | ')}`)
  })
async function clicca(p, etichetta, dentro = 'body') {
  await p.waitForFunction(
    (etichetta, dentro) => {
      const radici = [...document.querySelectorAll(dentro)]
      const el = radici.flatMap((r) => [...r.querySelectorAll('button, a')]).find((e) => (e.getAttribute('aria-label') ?? e.textContent).trim().startsWith(etichetta) && !e.disabled)
      if (!el) return false
      el.click()
      return true
    },
    { polling: 100 },
    etichetta,
    dentro,
  )
}
async function scrivi(p, selettore, valore) {
  await p.waitForSelector(selettore)
  await p.$eval(selettore, (el) => el.select?.())
  await p.type(selettore, valore)
}
async function entra(email, password = PASSWORD_DEMO, larghezza) {
  const p = await persona(larghezza)
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
  await scrivi(p, 'input[type=email]', email)
  await scrivi(p, 'input[type=password]', password)
  await p.click('button[type=submit]')
  await p.waitForFunction(() => location.pathname.startsWith('/area/'), { polling: 100 })
  return p
}
const scatto = async (p, nome, intera = false) => {
  if (!process.env.SCATTI) return
  await attendi(900)
  await p.screenshot({ path: `${process.env.SCATTI}/${nome}.png`, fullPage: intera })
}
const nessunoSbordo = async (p, dove) => {
  const n = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  vero(n <= 0, `${dove}: la pagina sborda di ${n}px`)
}
const db = async (sql, par) => (await backend.db.query(sql, par)).rows

let visitatore, admin, cliente, collab, chatUrl, codice

console.log('Recensioni sulla home')
visitatore = await persona()
await prova('La home mostra voto medio, recensioni e il collegamento', async () => {
  await visitatore.goto(BASE, { waitUntil: 'networkidle0' })
  await vede(visitatore, '4,8 su 5 · 4 recensioni')
  vero(await visitatore.$('#recensioni .nastro'), 'manca la fila che scorre')
  await scatto(visitatore, 'home-alto')
  await visitatore.$eval('#recensioni', (e) => e.scrollIntoView())
  await scatto(visitatore, 'home-recensioni')
})

console.log('\nTicket di un visitatore')
await prova('Il modulo apre un ticket e porta alla chat privata', async () => {
  await visitatore.$eval('#contatti', (e) => e.scrollIntoView())
  await scrivi(visitatore, '#contatti [name=nome]', 'Paolo Prova')
  await scrivi(visitatore, '#contatti [name=email]', 'paolo@x.it')
  await scrivi(visitatore, '#contatti [name=messaggio]', 'Vorrei un preventivo per il sito del mio negozio.')
  await scatto(visitatore, 'contatti')
  await clicca(visitatore, 'Apri la richiesta', '#contatti')
  await vede(visitatore, 'aperto')
  await clicca(visitatore, 'Apri la chat', '#contatti')
  await vede(visitatore, 'preventivo per il sito del mio negozio')
  chatUrl = visitatore.url()
  vero(/\/assistenza\/[0-9a-f-]{36}$/.test(chatUrl), chatUrl)
})

console.log('\nAdmin')
await prova('Vede il numero dei ticket da leggere e risponde in chat', async () => {
  admin = await entra('admin@demo.it')
  await vede(admin, 'ticket con nuovi messaggi')
  await scatto(admin, 'admin-avviso')
  await clicca(admin, 'Ticket', 'aside')
  await vede(admin, 'Paolo Prova')
  await scatto(admin, 'admin-ticket')
  await clicca(admin, 'Vorrei un preventivo', 'main')
  await scrivi(admin, 'textarea[aria-label="Scrivi un messaggio"]', 'Ciao Paolo, ti preparo il preventivo oggi.')
  await admin.keyboard.press('Enter')
  await vede(admin, 'ti preparo il preventivo oggi')
  await scatto(admin, 'admin-chat')
})
await prova('Il visitatore riceve la risposta nella chat senza ricaricare', async () => {
  await vede(visitatore, 'ti preparo il preventivo oggi')
  vero((await testo(visitatore)).includes('Forma Web ·'), 'la firma deve essere Forma Web')
  await scrivi(visitatore, 'textarea[aria-label="Scrivi un messaggio"]', 'Perfetto, grazie!')
  await clicca(visitatore, 'Invia', 'main')
  await vede(visitatore, 'Perfetto, grazie!')
  await scatto(visitatore, 'visitatore-chat')
})

await prova('Crea un cliente, il suo sito e il collaboratore che lo segue', async () => {
  await clicca(admin, 'Clienti', 'aside')
  await clicca(admin, 'Nuovo cliente', 'main')
  await scrivi(admin, '#cl-nome', 'Rosa Bianchi')
  await scrivi(admin, '#cl-email', 'rosa@x.it')
  await scrivi(admin, '#cl-password', 'password-rosa')
  await clicca(admin, 'Crea account', '[role=dialog]')
  await vede(admin, 'Siti acquistati')
  await clicca(admin, 'Aggiungi sito', 'main')
  await scrivi(admin, '#sn', 'Fioreria Rosa')
  await scrivi(admin, '#su', 'fioreria.example')
  await admin.select('#scoll', backend.ids.collab)
  await clicca(admin, 'Salva', '[role=dialog]')
  await vede(admin, 'Lo segue: Marco Demo')
})
await prova('Cassaforte: password principale, codice del cliente e accesso Google cifrato', async () => {
  await scrivi(admin, '#mp', 'principale-molto-lunga')
  await scrivi(admin, '#mp2', 'principale-molto-lunga')
  await clicca(admin, 'Crea la cassaforte', 'main')
  await clicca(admin, 'Attiva per questo cliente', 'main')
  await vede(admin, 'Codice del cliente')
  await clicca(admin, 'Google', 'main')
  await scrivi(admin, '#acc-nome', 'Rosa')
  await scrivi(admin, '#acc-cognome', 'Bianchi')
  await admin.$eval('#acc-data', (el) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1980-03-15')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await scrivi(admin, '#acc-email', 'fioreria.rosa@gmail.example')
  await scrivi(admin, '#acc-password', 'SegretissimaGoogle42')
  await clicca(admin, 'Salva', '[role=dialog]')
  await vede(admin, 'fioreria.rosa@gmail.example')
  vero(!(await testo(admin)).includes('SegretissimaGoogle42'), 'la password deve essere nascosta')
  await clicca(admin, 'Mostra codice del cliente', 'main')
  codice = await admin.evaluate(() => document.body.innerText.match(/[A-Z2-9]{5}(-[A-Z2-9]{5}){3}/)?.[0])
  vero(codice, 'codice non trovato')
  await scatto(admin, 'admin-cliente', true)
})
await prova('Nel database non c’è nulla in chiaro (né dati né codice né password principale)', async () => {
  const tutto = JSON.stringify([await db('select * from public.accessi_cliente'), await db('select * from public.cassaforte_clienti'), await db('select * from public.cassaforte')])
  for (const segreto of ['SegretissimaGoogle42', 'fioreria.rosa', 'Google', 'Bianchi', codice, codice.replaceAll('-', ''), 'principale-molto-lunga']) vero(!tutto.includes(segreto), `trovato in chiaro: ${segreto}`)
})
await prova('Blocca e riapri: password principale sbagliata rifiutata', async () => {
  await clicca(admin, 'Blocca', 'main')
  await scrivi(admin, '#mp', 'sbagliata-sbagliata')
  await clicca(admin, 'Apri la cassaforte', 'main')
  await vede(admin, 'Password principale errata')
  await scrivi(admin, '#mp', 'principale-molto-lunga')
  await clicca(admin, 'Apri la cassaforte', 'main')
  await vede(admin, 'fioreria.rosa@gmail.example')
})

console.log('\nCliente')
await prova('Entra nella sua area e legge gli accessi solo con il codice giusto', async () => {
  cliente = await entra('rosa@x.it', 'password-rosa')
  await vede(cliente, 'Fioreria Rosa')
  vero(!(await testo(cliente)).includes('fioreria.rosa@gmail.example'), 'accessi visibili senza codice')
  await scrivi(cliente, '#codice', 'AAAAA-AAAAA-AAAAA-AAAAA')
  await clicca(cliente, 'Mostra gli accessi', 'main')
  await vede(cliente, 'Codice errato')
  await scrivi(cliente, '#codice', codice.toLowerCase().replaceAll('-', ' '))
  await clicca(cliente, 'Mostra gli accessi', 'main')
  await vede(cliente, 'fioreria.rosa@gmail.example')
  await vede(cliente, '15/03/1980')
  await clicca(cliente, 'Mostra password', 'main')
  await vede(cliente, 'SegretissimaGoogle42')
  vero(!(await cliente.$('[aria-label="Modifica Google"]')), 'il cliente non deve poter modificare')
  await scatto(cliente, 'cliente-area', true)
})
await prova('Il cliente non entra nelle pagine interne', async () => {
  for (const rotta of ['/area/admin', '/area/prezzi', '/area/opportunita', '/area/dashboard']) {
    await cliente.goto(BASE + rotta, { waitUntil: 'networkidle0' })
    await cliente.waitForFunction(() => location.pathname === '/area/cliente', { polling: 100 })
  }
  const menu = await cliente.$eval('aside', (e) => e.innerText)
  vero(!/Prezzi|Vendite|Riepilogo/.test(menu), menu)
})
await prova('Lascia la recensione, che compare subito sulla home', async () => {
  await clicca(cliente, '5 stelle', 'main')
  await scrivi(cliente, '#rtesto', 'Rosa è felicissima del nuovo sito della fioreria.')
  await clicca(cliente, 'Pubblica recensione', 'main')
  await vede(cliente, 'è online')
  await visitatore.goto(BASE, { waitUntil: 'networkidle0' })
  await vede(visitatore, '5 recensioni')
  await vede(visitatore, 'felicissima del nuovo sito')
})
await prova('Apre un ticket: arriva la notifica ad admin e collaboratore del sito', async () => {
  collab = await entra('collab@demo.it')
  await vede(collab, 'Hai un ticket con un nuovo messaggio')
  await collab.evaluate(() => {
    window.__avvisi = []
    window.Notification = class {
      static permission = 'granted'
      constructor(t, o) {
        window.__avvisi.push(`${t} | ${o.body}`)
      }
    }
  })
  await clicca(cliente, 'Assistenza', 'aside')
  await clicca(cliente, 'Nuovo ticket', 'main')
  await scrivi(cliente, '#to', 'Foto di primavera')
  await scrivi(cliente, '#tm', 'Potete caricare le nuove foto dei bouquet?')
  await clicca(cliente, 'Invia', '[role=dialog]')
  await vede(cliente, 'Potete caricare le nuove foto')
  // Ritornando sulla scheda l'elenco si aggiorna senza aspettare
  await collab.evaluate(() => window.dispatchEvent(new Event('focus')))
  await collab.waitForFunction(() => window.__avvisi.some((a) => a.includes('Foto di primavera')), { polling: 100 })
  await admin.evaluate(() => window.dispatchEvent(new Event('focus')))
  await clicca(admin, 'Ticket', 'aside')
  await vede(admin, 'Foto di primavera')
})
await prova('Il collaboratore vede solo i ticket dei suoi siti e risponde', async () => {
  await clicca(collab, 'Ticket', 'aside')
  await vede(collab, 'Foto di primavera')
  vero(!(await testo(collab)).includes('Paolo Prova'), 'vede il ticket di un visitatore non assegnato')
  await scatto(collab, 'collab-ticket')
  await clicca(collab, 'Foto di primavera', 'main')
  await scrivi(collab, 'textarea[aria-label="Scrivi un messaggio"]', 'Certo, mandaci le foto!')
  await clicca(collab, 'Invia', 'main')
  await vede(collab, 'mandaci le foto')
  await vede(cliente, 'mandaci le foto')
  await scatto(cliente, 'cliente-chat')
})
await prova('Letti tutti i ticket, il numero nel menu sparisce', async () => {
  // Resta da leggere quello dei dati di esempio
  vero(await collab.$('aside [aria-label="1 da leggere"]'), 'doveva restarne uno')
  await clicca(collab, 'Ticket', 'aside')
  await clicca(collab, 'Cambiare gli orari', 'main')
  await collab.waitForFunction(() => !document.querySelector('aside [aria-label$="da leggere"]'), { polling: 200 })
})
await prova("L'admin assegna il ticket del visitatore: il collaboratore lo vede", async () => {
  await clicca(admin, 'Vorrei un preventivo', 'main')
  await admin.waitForSelector('main select')
  await admin.select('main select', backend.ids.collab)
  await attendi(800)
  await clicca(collab, 'Ticket', 'aside')
  await collab.evaluate(() => window.dispatchEvent(new Event('focus')))
  await vede(collab, 'Paolo Prova')
})
await prova('L’admin nasconde la recensione: sparisce dal sito', async () => {
  await clicca(admin, 'Recensioni', 'aside')
  await vede(admin, 'felicissima del nuovo sito')
  await scatto(admin, 'admin-recensioni')
  await admin.evaluate(() => {
    const scheda = [...document.querySelectorAll('main li')].find((li) => li.innerText.includes('felicissima'))
    ;[...scheda.querySelectorAll('button')].find((b) => b.innerText.includes('Nascondi')).click()
  })
  await vede(admin, 'Nascosta')
  await visitatore.goto(BASE, { waitUntil: 'networkidle0' })
  await vede(visitatore, '4 recensioni')
  vero(!(await testo(visitatore)).includes('felicissima'), 'ancora visibile')
})

console.log('\nNotifiche')
await prova('Nella pagina Ticket c’è il pulsante per attivarle', async () => {
  await admin.goto(`${BASE}/area/ticket`, { waitUntil: 'networkidle0' })
  await vede(admin, 'Notifiche sul dispositivo')
  await vede(admin, 'Attiva le notifiche')
  await scatto(admin, 'notifiche-computer')
})
await prova('Su iPhone dal browser spiega come aggiungere il sito alla schermata Home', async () => {
  const p = await entra('collab@demo.it', PASSWORD_DEMO, 390)
  await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
  await p.goto(`${BASE}/area/ticket`, { waitUntil: 'networkidle0' })
  await vede(p, 'Aggiungi alla schermata Home')
  await nessunoSbordo(p, 'ticket su iPhone')
  await scatto(p, 'notifiche-iphone')
})
await prova('Il sito si può installare: manifest e icone', async () => {
  const m = await (await fetch(`${BASE}/manifest.webmanifest`)).json()
  vero(m.display === 'standalone' && m.start_url === '/area', JSON.stringify(m))
  for (const i of m.icons) vero((await fetch(BASE + i.src)).headers.get('content-type') === 'image/png', i.src)
  vero(await admin.$('link[rel="manifest"]'), 'manca il collegamento al manifest')
})
await prova('Arrivando una notifica viene mostrata con il collegamento al ticket', async () => {
  await admin.browserContext().overridePermissions(BASE, ['notifications'])
  const cdp = await admin.createCDPSession()
  let registrazione
  cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => (registrazione = e.registrations.find((r) => r.scopeURL.startsWith(BASE) && !r.isDeleted) ?? registrazione))
  await cdp.send('ServiceWorker.enable')
  await admin.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await attendi(500)
  vero(registrazione, 'servizio non registrato')
  const invia = (dati) => cdp.send('ServiceWorker.deliverPushMessage', { origin: BASE, registrationId: registrazione.registrationId, data: JSON.stringify(dati) })
  await invia({ titolo: 'Ticket n. 9 – Prova', testo: 'Messaggio di prova', url: '/area/ticket/abc', tag: 'abc' })
  await invia({ titolo: 'Indirizzo esterno', testo: 'x', url: 'https://cattivo.example', tag: 'zzz' })
  await attendi(800)
  const n = await admin.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => [n.title, n.body, n.data.url]))
  vero(n.some((x) => x[0] === 'Ticket n. 9 – Prova' && x[1] === 'Messaggio di prova' && x[2] === '/area/ticket/abc'), JSON.stringify(n))
  vero(n.some((x) => x[0] === 'Indirizzo esterno' && x[2] === '/area/ticket'), 'un indirizzo esterno deve essere ignorato: ' + JSON.stringify(n))
})

console.log('\nTelefono')
await prova('Nessuna pagina sborda a 390 px', async () => {
  for (const p of [visitatore, cliente, admin]) await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await visitatore.goto(BASE, { waitUntil: 'networkidle0' })
  await vede(visitatore, '4 recensioni')
  await nessunoSbordo(visitatore, 'home')
  await visitatore.$eval('#recensioni', (e) => e.scrollIntoView())
  await scatto(visitatore, 'tel-recensioni')
  await visitatore.goto(chatUrl, { waitUntil: 'networkidle0' })
  await nessunoSbordo(visitatore, 'chat visitatore')
  await scatto(visitatore, 'tel-chat')
  for (const [p, rotta] of [[cliente, '/area/cliente'], [cliente, '/area/ticket'], [admin, '/area/ticket'], [admin, '/area/admin/clienti'], [admin, '/area/admin/recensioni']]) {
    await p.goto(BASE + rotta, { waitUntil: 'networkidle0' })
    await attendi(400)
    await nessunoSbordo(p, rotta)
  }
  await cliente.goto(`${BASE}/area/cliente`, { waitUntil: 'networkidle0' })
  await scatto(cliente, 'tel-cliente')
})

if (errori.length) console.log('\nErrori JavaScript nella pagina:\n - ' + errori.join('\n - '))
await browser.close()
backend.chiudi()
vite.kill()
console.log(`\n${ok} controlli superati, ${falliti.length} falliti${errori.length ? `, ${errori.length} errori JS` : ''}`)
process.exit(falliti.length || errori.length ? 1 : 0)
