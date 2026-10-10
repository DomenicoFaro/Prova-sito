// Test della «Prova un mese» in un browser vero (Edge/Chrome), con backend SIMULATO.
// Somme attese (listino di partenza, prova = 100 € + 30% delle aggiuntive, resto dopo il mese):
//   Ristorante 399 + 2 pagine in più (98) = 497 → prova 100 + 98×0,3 = 129,40 € · resto 367,60 €
//   + Modulo contatti (39) + 2 lingue (198) → extra 335 → prova 200,50 € · resto 533,50 € · sito 734 €
import puppeteer from 'puppeteer-core'
import { BASE, EDGE, imp, voci as vociDb } from './dati.mjs'

const SUPA = 'abcdefghijklmnopqrst.supabase.co'
const TOKEN = '11111111-2222-3333-4444-555555555555'
const voci = vociDb.map((v) => ({ ...v }))

let ok = 0
const falliti = []
async function prova(nome, fn) {
  try { await fn(); ok++; console.log(`  ok   ${nome}`) } catch (e) { falliti.push(nome); console.log(`  FAIL ${nome}\n       ${e.message.split('\n')[0]}`) }
}
const norm = (x) => String(x).replace(/[’']/g, "'")
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} atteso ${JSON.stringify(b)}, ottenuto ${JSON.stringify(a)}`) }
const contiene = (t, s, m = '') => { if (!norm(t).includes(norm(s))) throw new Error(`${m} manca "${s}" in: ${String(t).slice(0, 200)}`) }
const nonContiene = (t, s) => { if (norm(t).includes(norm(s))) throw new Error(`non deve comparire "${s}"`) }
const attendi = (ms = 250) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1200, height: 900 })

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
let payload = null
let ordineMock = null
await page.setRequestInterception(true)
page.on('request', (req) => {
  const url = new URL(req.url())
  if (url.host !== SUPA) return req.continue()
  const rispondi = (corpo, status = 200) => req.respond({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(corpo) })
  if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS })
  if (url.pathname.endsWith('/configuratore_voci')) return rispondi(voci)
  if (url.pathname.endsWith('/configuratore_impostazioni')) return rispondi(imp)
  if (url.pathname.endsWith('/rpc/crea_richiesta_sito')) { payload = JSON.parse(req.postData()).p; return rispondi(TOKEN) }
  if (url.pathname.endsWith('/rpc/leggi_ordine')) return rispondi(ordineMock)
  return rispondi({})
})
const errori = []
page.on('pageerror', (e) => errori.push(e.message))

const testo = () => page.evaluate(() => document.body.innerText)
const cliccaTesto = async (sel, t) => {
  const trovato = await page.evaluate((sel, t) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(t))
    if (!el) return false
    el.click(); return true
  }, sel, t)
  if (!trovato) throw new Error(`non trovo ${sel} con "${t}"`)
}
const barra = () => page.evaluate(() => document.querySelector('[role="status"].fixed')?.innerText ?? '')
const scrive = async (sel, v) => { await page.$eval(sel, (el) => { el.focus(); el.select() }); await page.keyboard.press('Backspace'); await page.type(sel, v) }
const campo = async (et, v) => {
  const trovato = await page.evaluate((et) => {
    const l = [...document.querySelectorAll('label')].find((x) => x.querySelector('.label')?.textContent.trim().startsWith(et))
    const i = l?.querySelector('input,textarea')
    if (!i) return false
    i.setAttribute('data-test', 'cur'); return true
  }, et)
  if (!trovato) throw new Error(`campo "${et}" non trovato`)
  await scrive('[data-test="cur"]', v)
  await page.$eval('[data-test="cur"]', (el) => el.removeAttribute('data-test'))
}
const titoloPasso = () => page.evaluate(() => document.querySelector('h2[tabindex="-1"]')?.innerText ?? '')
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const avanti = async () => { await cliccaTesto('button', 'Avanti'); await attendi(400) }

console.log('Prova un mese: modulo')
await page.goto(`${BASE}/prova-un-mese`, { waitUntil: 'networkidle0' })
await prova('Pagina della prova: titolo, prezzo 100 € e sconto 70% presi dalle impostazioni', async () => {
  const t = await testo()
  contiene(t, 'Prova il tuo sito per un mese')
  contiene(t, '100')
  contiene(t, 'scontate del 70%')
  contiene(t, 'se no, non devi altro')
})
await prova('Il menu ha «Prova un mese» e NON ha «Prezzi»', async () => {
  const menu = await page.evaluate(() => document.querySelector('header nav')?.innerText ?? '')
  contiene(menu, 'Prova un mese')
  contiene(menu, 'Acquista il tuo sito')
  nonContiene(menu, 'Prezzi')
})
await campo('Nome e cognome', 'Luca Verdi'); await campo('Email', 'luca@test.it'); await campo('Codice fiscale', 'VRDLCU80A01H501X'); await campo('Indirizzo', 'Via Po 3, Torino')
await avanti()
await prova('Si arriva al passo 2; solo le tipologie disponibili in prova (11 su 13)', async () => {
  eq(await titoloPasso(), '2. Il tuo sito')
  eq(await page.$$eval('input[name="tipologia"]', (e) => e.length), 11)
  const t = await testo()
  nonContiene(t, 'Gestionale Personalizzato')
  nonContiene(t, 'Sito Personalizzato')
  contiene(t, 'Ristorante / Bar')
})
await prova('Scelto il Ristorante: «da pagare ora» = 100 € (nessun extra ancora), poi 299 € dopo il mese', async () => {
  await cliccaTesto('label', 'Ristorante / Bar'); await attendi()
  const b = await barra()
  contiene(b, '100,00'); contiene(b, 'Da pagare ora'); contiene(b, '299,00')
})
await prova('6 pagine: +98 € aggiuntivi scontati del 70% → 100 + 29,40 = 129,40 €; resto 367,60 €', async () => {
  await scrive('input[aria-label="Numero di pagine"]', '6'); await attendi()
  const b = await barra()
  contiene(b, '129,40'); contiene(b, '367,60')
})
await campo('Descrivi il sito', 'Sito per il mio ristorante in centro')
await avanti()
await prova('Passo 3: Chatbot AI e Gestione ordini (esclusi dalla prova) NON si vedono; il resto sì', async () => {
  eq(await titoloPasso(), '3. Personalizzazione')
  const t = await testo()
  nonContiene(t, 'Chatbot AI'); nonContiene(t, 'Gestione ordini')
  for (const s of ['Modulo contatti', 'Lingua aggiuntiva', 'SEO di base', 'Newsletter', 'Sistema prenotazioni']) contiene(t, s)
  contiene(t, 'sconto del 70%')
})
await prova('Modulo contatti (+39) → extra 137 → 100 + 41,10 = 141,10 €', async () => {
  await cliccaTesto('label', 'Modulo contatti'); await attendi()
  contiene(await barra(), '141,10')
})
await prova('2 lingue (+198) → extra 335 → 200,50 €; resto 533,50 €', async () => {
  await cliccaTesto('label', 'Lingua aggiuntiva'); await attendi()
  await page.$eval('button[aria-label="Una lingua aggiuntiva in più"]', (b) => b.click()); await attendi()
  const b = await barra()
  contiene(b, '200,50'); contiene(b, '533,50')
})
await prova('La consegna urgente NON è offerta nella prova', async () => {
  const t = await testo()
  nonContiene(t, 'Consegna urgente')
  contiene(t, 'Consegna standard'); contiene(t, 'Nessuna scadenza precisa')
})
await avanti()
await prova('Passo 4: pannello «Come funziona la prova di un mese» con tutti gli importi', async () => {
  eq(await titoloPasso(), '4. Preventivo')
  const t = await testo()
  for (const s of ['Come funziona la prova di un mese', 'Mese di prova', '100,00', 'Sconto del 70% per la prova: risparmi 234,50', '335,00', '100,50',
    'Da pagare ora', '200,50', 'solo se il sito ti è piaciuto', '533,50', 'Prezzo pieno del sito: 734,00', 'Se alla fine del mese non ti convince, non paghi il resto.',
    'Preventivo indicativo, soggetto a conferma da parte di FormaWeb.', 'Servizi esterni e costi di gestione'])
    contiene(t, s)
})
await avanti()
await prova('Passo 5: riepilogo con il pannello della prova e il passaggio «mese di prova»', async () => {
  eq(await titoloPasso(), '5. Conferma')
  const t = await testo()
  contiene(t, 'Come funziona la prova di un mese')
  contiene(t, 'paghi online in sicurezza il mese di prova')
})
await prova('Invio: manda scelte e prova=true, MAI prezzi; poi apre la pagina dell\'ordine', async () => {
  ordineMock = {
    numero_ordine: 'W-00007', stato: 'richiesto', cliente_nome: 'Luca Verdi', cliente_email: 'luca@test.it', tipo_sito: 'Ristorante / Bar', nome_attivita: '', pagine: '6 pagine',
    funzionalita: [], dominio: '', descrizione: 'x', budget: '', scadenza: 'Consegna standard', prezzo: null, acconto: null, consegna_giorni: null, nota_preventivo: '',
    pagato_il: null, importo_pagato: null, created_at: new Date().toISOString(), totale_indicativo: 734, approvazione_manuale: false, urgenza_richiesta: false, urgenza_confermata: false,
    n_allegati: 0, tipo_ordine: 'prova', metodo_pagamento: 'stripe', prova_fino_al: null, saldo_dopo_prova: null, contratto: null,
    dettaglio_preventivo: {
      tipologia: { codice: 'ristorante_bar', nome: 'Ristorante / Bar', prezzo: 399, modalita: 'fisso' }, pagine: 6, pagine_incluse: 4, pagine_extra: 2, pagine_extra_importo: 98,
      righe: [{ codice: 'lingua_aggiuntiva', nome: 'Lingua aggiuntiva', quantita: 2, importo: 198, incluso: false, modalita: 'fisso' }], subtotale: 734, urgenza_percentuale: 20, urgenza_importo: 0, urgenza_confermata: false, totale: 734, approvazione_manuale: false,
      prova: { prezzo_base: 100, sconto_percentuale: 70, extra_pieno: 335, extra_scontati: 100.5, risparmio: 234.5, da_pagare_ora: 200.5, resto_dopo: 533.5, totale_sito: 734 },
    },
  }
  await cliccaTesto('button', 'Invia la richiesta')
  await page.waitForFunction(() => location.pathname.startsWith('/ordine/'), { timeout: 5000 })
  eq(payload.prova, true)
  eq(payload.tipologia, 'ristorante_bar')
  eq(payload.pagine, 6)
  eq(Object.entries(payload.extra).sort(), [['lingua_aggiuntiva', 2], ['modulo_contatti', 1]])
  eq(payload.scadenza_tipo, 'standard')
  for (const vietata of ['prezzo', 'acconto', 'totale', 'totale_indicativo', 'da_pagare_ora', 'resto_dopo', 'stato', 'importo']) if (vietata in payload) throw new Error(`il browser invia "${vietata}"`)
})
await prova('Pagina ordine (da confermare): badge «Prova di un mese», pannello, pagamento bloccato', async () => {
  await attendi(400)
  const t = await testo()
  contiene(t, 'Prova di un mese'); contiene(t, 'Stiamo confermando il tuo preventivo'); contiene(t, 'Come funziona la prova di un mese')
  contiene(t, 'Il pagamento sarà disponibile solo dopo questa conferma')
  nonContiene(t, 'Accetta e paga')
})
await prova('Dopo la conferma di FormaWeb: «Da pagare ora (mese di prova)», resto dopo il mese, pulsante dedicato', async () => {
  ordineMock = { ...ordineMock, stato: 'preventivo_inviato', prezzo: 734, acconto: 200.5, consegna_giorni: 15, contratto: '# CONTRATTO PER LA PROVA\nTesto' }
  await page.reload({ waitUntil: 'networkidle0' })
  const t = await testo()
  for (const s of ['Prezzo pieno del sito', '734,00', 'Da pagare ora (mese di prova)', '200,50', 'Il resto di 533,50', 'alla fine del mese di prova', 'solo se decidi di tenere il sito', 'Accetta e paga la prova 200,50'])
    contiene(t, s)
})
await prova('Dopo il pagamento con carta: data fine prova e resto', async () => {
  ordineMock = { ...ordineMock, stato: 'pagato', metodo_pagamento: 'stripe', importo_pagato: 200.5, pagato_il: new Date().toISOString(), prova_fino_al: '2026-11-10', saldo_dopo_prova: 533.5 }
  await page.reload({ waitUntil: 'networkidle0' })
  const t = await testo()
  contiene(t, 'Pagamento ricevuto'); contiene(t, 'La tua prova di un mese'); contiene(t, '10/11/2026'); contiene(t, '533,50'); contiene(t, 'non devi altro')
})
await prova('Pagato in contanti: messaggio diverso (nessuna email), contratto da scaricare', async () => {
  ordineMock = { ...ordineMock, metodo_pagamento: 'contanti' }
  await page.reload({ waitUntil: 'networkidle0' })
  const t = await testo()
  contiene(t, 'Pagamento in contanti registrato'); contiene(t, 'puoi scaricarlo o stamparlo')
  nonContiene(t, 'te lo abbiamo inviato anche via email')
})

console.log('\nSeparazione tra acquisto normale e prova')
await page.evaluate(() => sessionStorage.clear())
await prova('Le bozze dei due moduli sono separate', async () => {
  await page.goto(`${BASE}/sito-su-misura`, { waitUntil: 'networkidle0' })
  await campo('Nome e cognome', 'Solo Normale')
  await page.goto(`${BASE}/prova-un-mese`, { waitUntil: 'networkidle0' })
  eq(await page.$eval('input[autocomplete="name"]', (e) => e.value), '')
  await page.goto(`${BASE}/sito-su-misura`, { waitUntil: 'networkidle0' })
  eq(await page.$eval('input[autocomplete="name"]', (e) => e.value), 'Solo Normale')
})
await prova('Nel modulo normale restano disponibili tutte le 13 tipologie e il Chatbot AI', async () => {
  await page.evaluate(() => sessionStorage.clear())
  await page.goto(`${BASE}/sito-su-misura`, { waitUntil: 'networkidle0' })
  await campo('Nome e cognome', 'Anna Neri'); await campo('Email', 'anna@test.it'); await campo('Codice fiscale', 'NRANNA80A41H501X'); await campo('Indirizzo', 'Via Dante 2, Roma')
  await avanti()
  eq(await page.$$eval('input[name="tipologia"]', (e) => e.length), 13)
  await cliccaTesto('label', 'Sito Vetrina'); await campo('Descrivi il sito', 'Un sito vetrina per il mio studio')
  await avanti()
  contiene(await testo(), 'Chatbot AI')
  nonContiene(await testo(), 'sconto del 70%')
})
await prova('Se l\'admin esclude un servizio dalla prova (SEO di base), sparisce solo dalla prova', async () => {
  voci.find((v) => v.codice === 'seo_base').in_prova = false
  await page.evaluate(() => sessionStorage.clear())
  await page.goto(`${BASE}/prova-un-mese`, { waitUntil: 'networkidle0' })
  await campo('Nome e cognome', 'Anna Neri'); await campo('Email', 'anna@test.it'); await campo('Codice fiscale', 'NRANNA80A41H501X'); await campo('Indirizzo', 'Via Dante 2, Roma')
  await avanti()
  await cliccaTesto('label', 'Sito Vetrina'); await campo('Descrivi il sito', 'Un sito vetrina per il mio studio'); await avanti()
  nonContiene(await testo(), 'SEO di base')
  contiene(await testo(), 'Newsletter')
  await page.evaluate(() => sessionStorage.clear())
  await page.goto(`${BASE}/sito-su-misura`, { waitUntil: 'networkidle0' })
  await campo('Nome e cognome', 'Anna Neri'); await campo('Email', 'anna@test.it'); await campo('Codice fiscale', 'NRANNA80A41H501X'); await campo('Indirizzo', 'Via Dante 2, Roma')
  await avanti()
  await cliccaTesto('label', 'Sito Vetrina'); await campo('Descrivi il sito', 'Un sito vetrina per il mio studio'); await avanti()
  contiene(await testo(), 'SEO di base')
  voci.find((v) => v.codice === 'seo_base').in_prova = true
})

console.log('\nResponsive (telefono 375 px)')
await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true })
await prova('Prova su telefono: nessuno scorrimento orizzontale in tutti i passi', async () => {
  await page.evaluate(() => sessionStorage.clear())
  await page.goto(`${BASE}/prova-un-mese`, { waitUntil: 'networkidle0' })
  const o = [await overflow()]
  await campo('Nome e cognome', 'Anna Neri'); await campo('Email', 'anna@test.it'); await campo('Codice fiscale', 'NRANNA80A41H501X'); await campo('Indirizzo', 'Via Dante 2, Roma')
  await avanti(); o.push(await overflow())
  await cliccaTesto('label', 'E-commerce'); await campo('Descrivi il sito', 'Negozio online di prodotti artigianali')
  await avanti(); o.push(await overflow())
  await avanti(); o.push(await overflow())
  await page.screenshot({ path: process.env.TEMP + '/prova-passo4-mobile.png', fullPage: true })
  await avanti(); o.push(await overflow())
  eq(o.map((x) => x <= 0), [true, true, true, true, true], `overflow ${o.join('/')}px`)
})

if (errori.length) console.log('\nErrori JavaScript nella pagina:\n - ' + errori.join('\n - '))
await browser.close()
console.log(`\n${ok} controlli superati, ${falliti.length} falliti${errori.length ? `, ${errori.length} errori JS` : ''}`)
if (falliti.length) console.log('Falliti:\n - ' + falliti.join('\n - '))
process.exit(falliti.length || errori.length ? 1 : 0)
