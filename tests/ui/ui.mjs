// Test del modulo «Acquista il tuo sito» in un browser vero (Edge), con il backend SIMULATO:
// le risposte di Supabase sono finte (ma con i dati veri del listino). Verifica solo il lato schermo.
import puppeteer from 'puppeteer-core'
import { writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BASE, EDGE, imp, voci } from './dati.mjs'

const SUPA = 'abcdefghijklmnopqrst.supabase.co'
const TOKEN = '11111111-2222-3333-4444-555555555555'
const TMP = join(tmpdir(), 'formaweb-test-ui')
mkdirSync(TMP, { recursive: true })

let ok = 0
const falliti = []
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
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} atteso ${JSON.stringify(b)}, ottenuto ${JSON.stringify(a)}`) }
const norm = (x) => String(x).replace(/[’']/g, "'")
const contiene = (t, s, m = '') => { if (!norm(t).includes(norm(s))) throw new Error(`${m} manca "${s}" in: ${String(t).slice(0, 200)}`) }

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1200, height: 900 })

// ---- backend finto
let payloadInvio = null
let richiesteRpc = []
let uploads = []
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
let ordineMock = null
await page.setRequestInterception(true)
page.on('request', async (req) => {
  const url = new URL(req.url())
  if (url.host !== SUPA) return req.continue()
  const rispondi = (corpo, status = 200) => req.respond({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(corpo) })
  if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS })
  if (url.pathname.endsWith('/configuratore_voci')) return rispondi(voci)
  if (url.pathname.endsWith('/configuratore_impostazioni')) return rispondi(imp)
  if (url.pathname.endsWith('/rpc/crea_richiesta_sito')) {
    payloadInvio = JSON.parse(req.postData()).p
    richiesteRpc.push(payloadInvio)
    return rispondi(TOKEN)
  }
  if (url.pathname.endsWith('/rpc/leggi_ordine')) return rispondi(ordineMock)
  if (url.pathname.includes('/storage/v1/object/richieste-allegati/')) {
    uploads.push(decodeURIComponent(url.pathname.split('/richieste-allegati/')[1]))
    return rispondi({ Key: 'ok', Id: 'x' })
  }
  if (url.pathname.endsWith('/rest/v1/prezzi')) return rispondi([
    { id: '1', tipo: 'sito', nome: 'Sito vetrina', descrizione: '', prezzo: 300, prezzo_max: null, valuta: '€', a_partire_da: false, periodicita: '', caratteristiche: [], in_evidenza: false, ordine: 0, attivo: true },
    { id: '2', tipo: 'servizio', nome: 'Logo', descrizione: '', prezzo: 80, prezzo_max: null, valuta: '€', a_partire_da: false, periodicita: '', caratteristiche: [], in_evidenza: false, ordine: 0, attivo: true },
    { id: '3', tipo: 'abbonamento', nome: 'Assistenza', descrizione: '', prezzo: 30, prezzo_max: null, valuta: '€', a_partire_da: false, periodicita: 'al mese', caratteristiche: [], in_evidenza: false, ordine: 0, attivo: true },
  ])
  return rispondi({})
})
const errori = []
page.on('pageerror', (e) => errori.push(e.message))

const testo = () => page.evaluate(() => document.body.innerText)
const cliccaTesto = async (sel, t) => {
  const ok = await page.evaluate((sel, t) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(t))
    if (!el) return false
    el.click()
    return true
  }, sel, t)
  if (!ok) throw new Error(`non trovo ${sel} con "${t}"`)
}
const totaleBarra = () => page.evaluate(() => document.querySelector('[role="status"].fixed')?.innerText ?? '')
const scrive = async (selettore, valore) => {
  await page.$eval(selettore, (el) => { el.focus(); el.select() })
  await page.keyboard.press('Backspace')
  await page.type(selettore, valore)
}
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const attendi = (ms = 250) => new Promise((r) => setTimeout(r, ms))
const titoloPasso = () => page.evaluate(() => document.querySelector('h2[tabindex="-1"]')?.innerText ?? '')

// campo per etichetta
const campo = async (etichetta, valore) => {
  const id = await page.evaluate((et) => {
    const l = [...document.querySelectorAll('label')].find((x) => x.querySelector('.label')?.textContent.trim().startsWith(et))
    const i = l?.querySelector('input,textarea')
    if (!i) return null
    i.setAttribute('data-test', 'cur')
    return true
  }, etichetta)
  if (!id) throw new Error(`campo "${etichetta}" non trovato`)
  await scrive('[data-test="cur"]', valore)
  await page.evaluate(() => document.querySelector('[data-test="cur"]')?.removeAttribute('data-test'))
}

console.log('Modulo a 5 passaggi')
await page.goto(`${BASE}/sito-su-misura`, { waitUntil: 'networkidle0' })

await prova('La pagina si apre, mostra i 5 passaggi e il primo', async () => {
  const t = await testo()
  contiene(t, 'Il tuo sito, su misura')
  eq(await titoloPasso(), '1. I tuoi dati')
  for (const p of ['I tuoi dati', 'Il tuo sito', 'Personalizzazione', 'Preventivo', 'Conferma']) contiene(await page.evaluate(() => document.querySelector('nav[aria-label="Avanzamento"]').innerHTML), p)
})
await prova('/acquista-sito-su-misura porta alla pagina del modulo', async () => {
  const p2 = await browser.newPage()
  await p2.setRequestInterception(true)
  p2.on('request', (r) => (new URL(r.url()).host === SUPA ? r.respond({ status: 200, headers: CORS, contentType: 'application/json', body: '[]' }) : r.continue()))
  await p2.goto(`${BASE}/acquista-sito-su-misura`, { waitUntil: 'networkidle0' })
  eq(new URL(p2.url()).pathname, '/sito-su-misura')
  await p2.close()
})
await prova('Avanti con dati mancanti → messaggio di errore chiaro, resta sul passo 1', async () => {
  await cliccaTesto('button', 'Avanti')
  await attendi()
  contiene(await testo(), 'Inserisci il tuo nome')
  eq(await titoloPasso(), '1. I tuoi dati')
})
await prova('Email non valida → errore', async () => {
  await campo('Nome e cognome', 'Mario Rossi')
  await campo('Email', 'non-una-email')
  await cliccaTesto('button', 'Avanti')
  await attendi()
  contiene(await testo(), 'indirizzo email valido')
})
await prova('Dati completi → passo 2', async () => {
  await campo('Email', 'mario@test.it')
  await campo('Codice fiscale', 'RSSMRA80A01H501U')
  await campo('Indirizzo', 'Via Roma 1, Milano')
  await cliccaTesto('button', 'Avanti')
  await attendi(400)
  eq(await titoloPasso(), '2. Il tuo sito')
})
await prova('Tutte le 13 tipologie sono mostrate con prezzo di partenza', async () => {
  const t = await testo()
  for (const s of ['Landing Page', '199', 'Sito Vetrina', 'Ristorante / Bar', 'Barbiere / Centro Estetico', 'Hotel / B&B', 'Agenzia Immobiliare', 'E-commerce', 'da 1.199', 'Su preventivo']) contiene(t, s)
  eq(await page.$$eval('input[name="tipologia"]', (e) => e.length), 13)
})
await prova('Avanti senza scegliere il tipo di sito → errore', async () => {
  await cliccaTesto('button', 'Avanti')
  await attendi()
  contiene(await testo(), 'Scegli il tipo di sito')
})
await prova('Scegliere "Ristorante / Bar" mostra il totale in tempo reale (399 €)', async () => {
  await cliccaTesto('label', 'Ristorante / Bar')
  await attendi()
  contiene(await totaleBarra(), '399,00')
})
await prova('Contatore pagine: 6 pagine → 399 + 2×49 = 497 €', async () => {
  await scrive('input[aria-label="Numero di pagine"]', '6')
  await attendi()
  contiene(await totaleBarra(), '497,00')
  contiene(await testo(), '4 incluse')
})
await prova('I pulsanti − e + del contatore pagine funzionano', async () => {
  await page.$eval('button[aria-label="Una pagina in più"]', (b) => b.click())
  await attendi()
  contiene(await totaleBarra(), '546,00')
  await page.$eval('button[aria-label="Una pagina in meno"]', (b) => b.click())
  await attendi()
  contiene(await totaleBarra(), '497,00')
})
await prova('Descrizione troppo corta → errore; poi passo 3', async () => {
  await cliccaTesto('button', 'Avanti')
  await attendi()
  contiene(await testo(), 'Descrivi brevemente')
  await campo('Descrivi il sito', 'Un sito per il mio ristorante in centro')
  await cliccaTesto('button', 'Avanti')
  await attendi(400)
  eq(await titoloPasso(), '3. Personalizzazione')
})
await prova('Extra: Modulo contatti +39 → 536 €', async () => {
  await cliccaTesto('label', 'Modulo contatti')
  await attendi()
  contiene(await totaleBarra(), '536,00')
})
await prova('Lingua aggiuntiva con contatore: 2 lingue → +198 → 734 €', async () => {
  await cliccaTesto('label', 'Lingua aggiuntiva')
  await attendi()
  contiene(await totaleBarra(), '635,00')
  await page.$eval('button[aria-label="Una lingua aggiuntiva in più"]', (b) => b.click())
  await attendi()
  contiene(await totaleBarra(), '734,00')
})
await prova('Togliere un extra aggiorna il totale (Modulo contatti via → 695 €)', async () => {
  await cliccaTesto('label', 'Modulo contatti')
  await attendi()
  contiene(await totaleBarra(), '695,00')
  await cliccaTesto('label', 'Modulo contatti')
  await attendi()
  contiene(await totaleBarra(), '734,00')
})
await prova('Extra "da" (Chatbot AI): avviso "da confermare" e totale parziale', async () => {
  await cliccaTesto('label', 'Chatbot AI')
  await attendi()
  contiene(await testo(), 'Prezzo indicativo, da confermare')
  contiene(await totaleBarra(), 'da')
  contiene(await totaleBarra(), '933,00')
  await cliccaTesto('label', 'Chatbot AI')
  await attendi()
  contiene(await totaleBarra(), '734,00')
})
await prova('Budget: le 6 fasce ci sono e non cambiano il totale', async () => {
  for (const f of ['Meno di 300', '300–600', '600–1.000', '1.000–2.000', 'Oltre 2.000', 'Non ho un budget preciso']) contiene(await testo(), f)
  await cliccaTesto('label', '600–1.000')
  await attendi()
  contiene(await totaleBarra(), '734,00')
})
await prova('Consegna urgente: mostra il supplemento 20% (≈146,80) SENZA aggiungerlo al totale', async () => {
  await cliccaTesto('label', 'Consegna urgente')
  await attendi()
  const t = await testo()
  contiene(t, '20%')
  contiene(t, '146,80')
  contiene(t, 'solo previa conferma')
  contiene(await totaleBarra(), '734,00')
})
await prova('Allegato valido: caricato nel bucket privato nella cartella della richiesta', async () => {
  writeFileSync(join(TMP, 'prova.pdf'), '%PDF-1.4 prova')
  const input = await page.$('input[type="file"]')
  await input.uploadFile(join(TMP, 'prova.pdf'))
  await attendi(600)
  contiene(await testo(), 'prova.pdf')
  eq(uploads.length, 1)
  if (!/^richieste\/[0-9a-f-]{36}\/[0-9a-f]{8}-prova\.pdf$/.test(uploads[0])) throw new Error('percorso inatteso: ' + uploads[0])
})
await prova('Allegato non consentito (.exe) rifiutato SUBITO, senza invio', async () => {
  writeFileSync(join(TMP, 'virus.exe'), 'MZ')
  const prima = uploads.length
  await (await page.$('input[type="file"]')).uploadFile(join(TMP, 'virus.exe'))
  await attendi(400)
  contiene(await testo(), 'formato non consentito')
  eq(uploads.length, prima)
})
await prova('Allegato troppo grande (6 MB) rifiutato', async () => {
  writeFileSync(join(TMP, 'grande.pdf'), Buffer.alloc(6 * 1024 * 1024, 1))
  const prima = uploads.length
  await (await page.$('input[type="file"]')).uploadFile(join(TMP, 'grande.pdf'))
  await attendi(400)
  contiene(await testo(), 'supera i 5 MB')
  eq(uploads.length, prima)
})
await page.screenshot({ path: join(TMP, 'passo3-desktop.png') })

await prova('Indietro al passo 2: i dati e la scelta sono ancora lì', async () => {
  await cliccaTesto('button', 'Indietro')
  await attendi(400)
  eq(await titoloPasso(), '2. Il tuo sito')
  eq(await page.$eval('input[name="tipologia"]:checked', (e) => e.closest('label').innerText.includes('Ristorante')), true)
  eq(await page.$eval('input[aria-label="Numero di pagine"]', (e) => e.value), '6')
  contiene(await page.$eval('textarea', (e) => e.value), 'ristorante in centro')
  contiene(await totaleBarra(), '734,00')
})
await prova('Indietro al passo 1: i dati personali ci sono ancora', async () => {
  await cliccaTesto('button', 'Indietro')
  await attendi(400)
  eq(await page.$eval('input[autocomplete="email"]', (e) => e.value), 'mario@test.it')
})
await prova('Ricaricare la pagina NON fa perdere nulla (bozza salvata)', async () => {
  await page.reload({ waitUntil: 'networkidle0' })
  eq(await titoloPasso(), '1. I tuoi dati')
  eq(await page.$eval('input[autocomplete="email"]', (e) => e.value), 'mario@test.it')
  await cliccaTesto('button', 'Avanti')
  await attendi(400)
  eq(await page.$eval('input[name="tipologia"]:checked', (e) => e.closest('label').innerText.includes('Ristorante')), true)
  await cliccaTesto('button', 'Avanti')
  await attendi(400)
  contiene(await totaleBarra(), '734,00')
})
await prova('Passo 4: riepilogo corretto, totale, urgenza separata, avviso e servizi esterni', async () => {
  await cliccaTesto('button', 'Avanti')
  await attendi(400)
  eq(await titoloPasso(), '4. Preventivo')
  const t = await testo()
  for (const s of ['Ristorante / Bar', 'Pagine: 6', '4 incluse + 2 aggiuntive', 'Lingua aggiuntiva × 2', '734,00', 'circa 146,80', 'non incluso nel totale',
    'Preventivo indicativo, soggetto a conferma da parte di FormaWeb.',
    'Servizi esterni e costi di gestione', 'Vercel', 'Pro da $20/mese', 'Supabase', 'Resend', 'Stripe', 'Commissioni per transazione', 'Dominio', 'Sendcloud', 'Cloudflare', 'Google Workspace', 'Abbonamento per utente',
    'I costi dei servizi esterni variano in base alle funzionalità richieste e ai piani scelti. Verranno comunicati e concordati prima dell’attivazione.'])
    contiene(t, s)
  // dollari ed euro non sommati: nessun totale dei servizi
  if (/totale (dei )?servizi/i.test(t)) throw new Error('i servizi esterni non devono essere sommati')
})
await prova('Passo 5: riepilogo, "cosa succede dopo" e blocco del pagamento spiegato', async () => {
  await cliccaTesto('button', 'Avanti')
  await attendi(400)
  eq(await titoloPasso(), '5. Conferma')
  const t = await testo()
  contiene(t, 'Controlla la tua richiesta')
  contiene(t, 'Il pagamento diventa disponibile solo dopo la conferma dell’importo da parte di FormaWeb')
  contiene(t, 'Mario Rossi')
})
await page.screenshot({ path: join(TMP, 'passo5-desktop.png') })
await prova('Invio: il browser manda scelte, NON prezzi; poi va alla pagina dell\'ordine', async () => {
  ordineMock = {
    numero_ordine: 'W-00001', stato: 'richiesto', cliente_nome: 'Mario Rossi', cliente_email: 'mario@test.it', tipo_sito: 'Ristorante / Bar', nome_attivita: '',
    pagine: '6 pagine', funzionalita: ['Lingua aggiuntiva ×2'], dominio: '', descrizione: 'x', budget: '600–1.000 €', scadenza: 'Consegna urgente (da confermare)',
    prezzo: null, acconto: null, consegna_giorni: null, nota_preventivo: '', pagato_il: null, importo_pagato: null, created_at: new Date().toISOString(),
    totale_indicativo: 734, approvazione_manuale: false, urgenza_richiesta: true, urgenza_confermata: false, n_allegati: 1, contratto: null,
    dettaglio_preventivo: { tipologia: { codice: 'ristorante_bar', nome: 'Ristorante / Bar', prezzo: 399, modalita: 'fisso' }, pagine: 6, pagine_incluse: 4, pagine_extra: 2, pagine_extra_importo: 98,
      righe: [{ codice: 'lingua_aggiuntiva', nome: 'Lingua aggiuntiva', quantita: 2, importo: 198, incluso: false, modalita: 'fisso' }], subtotale: 734, urgenza_percentuale: 20, urgenza_importo: 146.8, urgenza_confermata: false, totale: 734, approvazione_manuale: false },
  }
  await cliccaTesto('button', 'Invia la richiesta')
  await page.waitForFunction(() => location.pathname.startsWith('/ordine/'), { timeout: 5000 })
  eq(richiesteRpc.length, 1)
  const p = payloadInvio
  eq(p.tipologia, 'ristorante_bar')
  eq(p.pagine, 6)
  eq(Object.entries(p.extra).sort(), [['lingua_aggiuntiva', 2], ['modulo_contatti', 1]])
  eq(p.scadenza_tipo, 'urgente')
  eq(p.budget, '600–1.000 €')
  eq(p.allegati.length, 1)
  contiene(p.allegati[0], `richieste/${p.cartella}/`)
  for (const vietata of ['prezzo', 'totale', 'totale_indicativo', 'subtotale', 'acconto', 'stato', 'importo']) if (vietata in p) throw new Error(`il browser invia "${vietata}"`)
  eq(new URL(page.url()).pathname, `/ordine/${TOKEN}`)
})
await prova('Dopo l\'invio la bozza viene cancellata', async () => {
  eq(await page.evaluate(() => sessionStorage.getItem('sito-su-misura-bozza')), null)
})
await prova('Pagina ordine: spiega che il pagamento è bloccato fino alla conferma e mostra il riepilogo', async () => {
  await attendi(400)
  const t = await testo()
  contiene(t, 'Stiamo confermando il tuo preventivo')
  contiene(t, 'Il pagamento sarà disponibile solo dopo questa conferma')
  contiene(t, 'Totale indicativo')
  contiene(t, 'Lingua aggiuntiva')
  if (/Accetta e paga/.test(t)) throw new Error('il pulsante di pagamento non deve comparire')
})
await prova('Pagina ordine "in verifica manuale" per le richieste da approvare', async () => {
  ordineMock = { ...ordineMock, approvazione_manuale: true, dettaglio_preventivo: { ...ordineMock.dettaglio_preventivo, approvazione_manuale: true } }
  await page.reload({ waitUntil: 'networkidle0' })
  const t = await testo()
  contiene(t, 'La tua richiesta è in verifica manuale')
  contiene(t, 'Il pagamento sarà disponibile solo dopo questa conferma')
  contiene(t, 'da ')
  if (/Accetta e paga/.test(t)) throw new Error('il pulsante di pagamento non deve comparire')
})
await prova('Dopo la conferma di FormaWeb compare il pagamento', async () => {
  ordineMock = { ...ordineMock, stato: 'preventivo_inviato', prezzo: 780, acconto: 780, consegna_giorni: 20, contratto: '# CONTRATTO\nTesto del contratto' }
  await page.reload({ waitUntil: 'networkidle0' })
  const t = await testo()
  contiene(t, 'Importo confermato da FormaWeb')
  contiene(t, 'Accetta e paga')
})

console.log('\nCasi particolari')
await page.evaluate(() => sessionStorage.clear())
await page.goto(`${BASE}/sito-su-misura`, { waitUntil: 'networkidle0' })
const compilaP1 = async () => {
  await campo('Nome e cognome', 'Anna Bianchi'); await campo('Email', 'anna@test.it'); await campo('Codice fiscale', 'BNCNNA80A41H501X'); await campo('Indirizzo', 'Via Dante 2, Roma')
  await cliccaTesto('button', 'Avanti'); await attendi(400)
}
await compilaP1()
await prova('Funzionalità già inclusa (Prenotazioni Online + Sistema prenotazioni): "Inclusa", disabilitata, non addebitata', async () => {
  await cliccaTesto('label', 'Prenotazioni Online')
  await campo('Descrivi il sito', 'Prenotazioni per il mio studio')
  await scrive('input[aria-label="Numero di pagine"]', '5')
  await cliccaTesto('button', 'Avanti'); await attendi(400)
  const inclusa = await page.evaluate(() => {
    const l = [...document.querySelectorAll('label')].find((x) => x.textContent.includes('Sistema prenotazioni'))
    const i = l.querySelector('input')
    return { checked: i.checked, disabled: i.disabled, testo: l.innerText }
  })
  eq(inclusa.checked, true); eq(inclusa.disabled, true); contiene(inclusa.testo, 'Inclusa')
  contiene(await totaleBarra(), '599,00')
  await cliccaTesto('label', 'SEO di base'); await attendi()
  contiene(await totaleBarra(), '698,00')
})
await prova('Sito Personalizzato: richiede approvazione manuale, avviso e nessun prezzo inventato', async () => {
  await cliccaTesto('button', 'Indietro'); await attendi(400)
  await cliccaTesto('label', 'Sito Personalizzato'); await attendi()
  await cliccaTesto('button', 'Avanti'); await attendi(400)
  await cliccaTesto('button', 'Avanti'); await attendi(400)
  const t = await testo()
  contiene(t, 'Richiede approvazione manuale')
  contiene(t, 'il pagamento non sarà disponibile')
  contiene(t, 'Totale indicativo (parziale)')
})

console.log('\nIl listino prezzi NON è più pubblico')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await prova('Home: niente pulsante né voce di menu «Prezzi»; c\'è «Prova un mese»', async () => {
  const t = await testo()
  if (/\bPrezzi\b/.test(t)) throw new Error('compare ancora "Prezzi" nella home')
  contiene(t, 'Prova un mese')
  contiene(t, 'Acquista il tuo sito')
})
await prova('/prezzi non mostra nulla ai visitatori: porta al login', async () => {
  await page.goto(`${BASE}/prezzi`, { waitUntil: 'networkidle0' })
  eq(new URL(page.url()).pathname, '/login')
  if (/Siti web|Abbonamenti/.test(await testo())) throw new Error('il listino è visibile')
})

console.log('\nResponsive (telefono 375 px)')
await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true })
await page.evaluate(() => sessionStorage.clear())
await page.goto(`${BASE}/sito-su-misura`, { waitUntil: 'networkidle0' })
await compilaP1()
await prova('Nessuno scorrimento orizzontale nei passi 1 e 2', async () => {
  await page.screenshot({ path: join(TMP, 'passo2-mobile.png') })
  eq(await overflow() <= 0, true, `overflow ${await overflow()}px`)
})
await prova('Su telefono: scelta tipologia, passo 3, 4 e 5 senza sbordare', async () => {
  await cliccaTesto('label', 'E-commerce'); await campo('Descrivi il sito', 'Negozio online di prodotti artigianali')
  await cliccaTesto('button', 'Avanti'); await attendi(400)
  await page.screenshot({ path: join(TMP, 'passo3-mobile.png') })
  const o3 = await overflow()
  await cliccaTesto('button', 'Avanti'); await attendi(400)
  await page.screenshot({ path: join(TMP, 'passo4-mobile.png'), fullPage: true })
  const o4 = await overflow()
  await cliccaTesto('button', 'Avanti'); await attendi(400)
  const o5 = await overflow()
  eq([o3 <= 0, o4 <= 0, o5 <= 0], [true, true, true], `overflow ${o3}/${o4}/${o5}px`)
})
await prova('La barra del totale non copre il pulsante Avanti su telefono', async () => {
  await cliccaTesto('button', 'Indietro'); await cliccaTesto('button', 'Indietro'); await attendi(400)
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, document.documentElement.scrollHeight) })
  await attendi(500)
  const r = await page.evaluate(() => {
    const barra = document.querySelector('[role="status"].fixed')?.getBoundingClientRect()
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Avanti'))
    const b = btn.getBoundingClientRect()
    return { barraTop: barra?.top ?? 9999, btnBottom: b.bottom }
  })
  if (r.btnBottom > r.barraTop + 1) throw new Error(`il pulsante (${r.btnBottom}) finisce sotto la barra (${r.barraTop})`)
})

if (errori.length) console.log('\nErrori JavaScript nella pagina:\n - ' + errori.join('\n - '))
await browser.close()
console.log(`\n${ok} controlli superati, ${falliti.length} falliti${errori.length ? `, ${errori.length} errori JS` : ''}`)
if (falliti.length) console.log('Falliti:\n - ' + falliti.join('\n - '))
process.exit(falliti.length || errori.length ? 1 : 0)
