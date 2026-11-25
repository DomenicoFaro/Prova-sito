// Test dell'area admin (Preventivi e ordini + Listino) in un browser vero, con backend SIMULATO.
import puppeteer from 'puppeteer-core'
import { BASE, EDGE, imp, voci } from './dati.mjs'

const SUPA = 'abcdefghijklmnopqrst.supabase.co'
const CART = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

let ok = 0
const falliti = []
async function prova(nome, fn) {
  try { await fn(); ok++; console.log(`  ok   ${nome}`) } catch (e) { falliti.push(nome); console.log(`  FAIL ${nome}\n       ${e.message.split('\n')[0]}`) }
}
const norm = (x) => String(x).replace(/[’']/g, "'")
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} atteso ${JSON.stringify(b)}, ottenuto ${JSON.stringify(a)}`) }
const contiene = (t, s, m = '') => { if (!norm(t).includes(norm(s))) throw new Error(`${m} manca "${s}" in: ${String(t).slice(0, 160)}`) }
const attendi = (ms = 300) => new Promise((r) => setTimeout(r, ms))

const dettaglioStandard = {
  tipologia: { codice: 'ristorante_bar', nome: 'Ristorante / Bar', prezzo: 399, modalita: 'fisso' }, pagine: 6, pagine_incluse: 4, pagine_extra: 2, pagine_extra_importo: 98,
  righe: [{ codice: 'lingua_aggiuntiva', nome: 'Lingua aggiuntiva', quantita: 2, importo: 198, incluso: false, modalita: 'fisso' }],
  subtotale: 734, urgenza_percentuale: 20, urgenza_importo: 146.8, urgenza_confermata: false, totale: 734, approvazione_manuale: false,
}
const ordineBase = {
  token: '11111111-2222-3333-4444-555555555555', cliente_nome: 'Mario Rossi', cliente_email: 'mario@test.it', cliente_telefono: '333', cliente_codice: 'RSSMRA80A01H501U',
  cliente_indirizzo: 'Via Roma 1', tipo_sito: 'Ristorante / Bar', nome_attivita: 'Da Mario', pagine: '6 pagine', funzionalita: ['Lingua aggiuntiva ×2'], lingue: '', dominio: '', stile: '',
  descrizione: 'Un sito per il ristorante', scadenza: 'Consegna urgente (da confermare)', budget: '600–1.000 €', prezzo: null, acconto: null, consegna_giorni: null,
  nota_preventivo: '', nota_interna: '', preventivo_il: null, firmatario: '', accettato_il: null, accettato_ip: '', importo_pagato: null, pagato_il: null, contratto_finale: null,
  created_at: new Date().toISOString(), stato: 'richiesto',
}
const ordini = [
  { ...ordineBase, id: 'o1', numero: 1, tipologia_codice: 'ristorante_bar', pagine_numero: 6, urgenza_richiesta: true, urgenza_confermata: false, totale_indicativo: 734, dettaglio_preventivo: dettaglioStandard, approvazione_manuale: false, allegati: [`richieste/${CART}/aaaa1111-logo.png`, `richieste/${CART}/bbbb2222-menu.pdf`] },
  { ...ordineBase, id: 'o2', numero: 2, token: '99999999-2222-3333-4444-555555555555', cliente_nome: 'Anna Bianchi', tipo_sito: 'Sito Personalizzato', tipologia_codice: 'sito_personalizzato', pagine_numero: 10, urgenza_richiesta: false, urgenza_confermata: false, totale_indicativo: 0,
    dettaglio_preventivo: { ...dettaglioStandard, tipologia: { codice: 'sito_personalizzato', nome: 'Sito Personalizzato', prezzo: null, modalita: 'preventivo' }, pagine: 10, pagine_incluse: 0, pagine_extra: 0, pagine_extra_importo: 0, righe: [], subtotale: 0, urgenza_importo: 0, totale: 0, approvazione_manuale: true },
    approvazione_manuale: true, allegati: [] },
]
const dettaglioProva = {
  ...dettaglioStandard,
  prova: { prezzo_base: 100, sconto_percentuale: 70, extra_pieno: 335, extra_scontati: 100.5, risparmio: 234.5, da_pagare_ora: 200.5, resto_dopo: 533.5, totale_sito: 734 },
}
ordini.push(
  { ...ordineBase, id: 'o3', numero: 3, token: '33333333-2222-3333-4444-555555555555', cliente_nome: 'Carla Gialli', tipo_ordine: 'prova', metodo_pagamento: 'stripe', tipologia_codice: 'ristorante_bar', pagine_numero: 6,
    urgenza_richiesta: false, urgenza_confermata: false, totale_indicativo: 734, dettaglio_preventivo: dettaglioProva, approvazione_manuale: false, allegati: [], scadenza: 'Consegna standard' },
  { ...ordineBase, id: 'o4', numero: 4, token: '44444444-2222-3333-4444-555555555555', cliente_nome: 'Paolo Blu', stato: 'pagato', tipo_ordine: 'prova', metodo_pagamento: 'contanti', prezzo: 734, acconto: 200.5, importo_pagato: 200.5,
    pagato_il: new Date().toISOString(), prova_fino_al: '2026-11-10', saldo_dopo_prova: 533.5, contratto_finale: '# CONTRATTO PER LA PROVA\nTesto', tipologia_codice: 'ristorante_bar', pagine_numero: 6,
    urgenza_richiesta: false, urgenza_confermata: false, totale_indicativo: 734, dettaglio_preventivo: dettaglioProva, approvazione_manuale: false, allegati: [] },
)
const progettoProva = { id: 'p1', nome: 'Da Mario', cliente: 'Mario Rossi', url: null, categoria: 'Ristorante / Bar', descrizione: '', funzionalita: [], tecnologie: [], screenshot_url: null, galleria: [],
  prezzo_totale: 1000, incassato: 300, ordine_id: 'o4', prova_fino_al: '2026-11-10', data_consegna: null, stato: 'in_lavorazione', pubblico: false, gestore_id: null, created_at: '2026-10-10T00:00:00Z' }
const vociAdmin = [...voci, { codice: 'nascosta', gruppo: 'extra', nome: 'Voce nascosta', descrizione: '', prezzo: 10, modalita: 'fisso', pagine_incluse: 0, incluse: [], a_quantita: false, costo_testo: '', ordine: 999, attivo: false }]

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1000 })

const jwt = (o) => 'x.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.y'
const utente = { id: 'u-admin', aud: 'authenticated', role: 'authenticated', email: 'admin@x.it', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const sessione = { access_token: jwt({ sub: 'u-admin', exp: 4102444800, role: 'authenticated' }), token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user: utente }
let ruolo = 'admin'
await page.evaluateOnNewDocument((k, s) => localStorage.setItem(k, JSON.stringify(s)), 'sb-abcdefghijklmnopqrst-auth-token', sessione)

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
const chiamate = []
const storage = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  const url = new URL(req.url())
  if (url.host !== SUPA) return req.continue()
  const rispondi = (corpo, status = 200) => req.respond({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(corpo) })
  if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS })
  const body = req.postData() ? (() => { try { return JSON.parse(req.postData()) } catch { return req.postData() } })() : null
  const rotta = url.pathname.replace('/rest/v1/', '')
  if (req.method() !== 'GET') chiamate.push({ metodo: req.method(), rotta, query: url.search, body })
  const singolo = (req.headers().accept ?? '').includes('pgrst.object')
  if (url.pathname.endsWith('/profiles')) {
    const p = { id: 'u-admin', nome: 'Admin', email: 'admin@x.it', avatar_url: null, ruolo, percentuale_default: 0, attivo: true, responsabile_id: null, created_at: '2026-01-01' }
    return rispondi(singolo ? p : [p])
  }
  if (url.pathname.endsWith('/ordini_siti')) return req.method() === 'GET' ? rispondi(ordini) : req.respond({ status: 204, headers: CORS })
  if (url.pathname.endsWith('/configuratore_voci')) return req.method() === 'GET' ? rispondi(vociAdmin) : req.respond({ status: 201, headers: CORS })
  if (url.pathname.endsWith('/configuratore_impostazioni')) return req.method() === 'GET' ? rispondi(imp) : req.respond({ status: 201, headers: CORS })
  if (url.pathname.includes('/storage/v1/object/sign/')) storage.push({ metodo: req.method(), percorso: decodeURIComponent(url.pathname), durata: body?.expiresIn })
  if (url.pathname.includes('/storage/v1/object/sign/')) return rispondi({ signedURL: '/object/sign/richieste-allegati/x?token=t' })
  if (url.pathname.endsWith('/ordini_contratto')) return rispondi(req.method() === 'GET' ? [{ testo: url.search.includes('id=eq.2') ? '# CONTRATTO PROVA' : '# Contratto' }] : {})
  if (url.pathname.endsWith('/rest/v1/progetti')) return req.method() === 'GET' ? rispondi(singolo ? progettoProva : [progettoProva]) : req.respond({ status: 204, headers: CORS })
  if (url.pathname.includes('/rpc/admin_segna_pagato_contanti')) return rispondi('o3')
  return rispondi(req.method() === 'GET' ? [] : {})
})
const errori = []
page.on('pageerror', (e) => errori.push(e.message))
page.on('popup', (p) => p.close().catch(() => {}))

const testo = () => page.evaluate(() => document.body.innerText)
const clicca = async (sel, t, radice = 'document') => {
  const ok = await page.evaluate((sel, t) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(t) || e.getAttribute('aria-label')?.includes(t))
    if (!el) return false
    el.click(); return true
  }, sel, t)
  if (!ok) throw new Error(`non trovo ${sel} con "${t}"`)
}
const cliccaEsatto = async (t) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === t)
    if (!el) return false
    el.click(); return true
  }, t)
  if (!ok) throw new Error('non trovo il pulsante "' + t + '"')
}
// campo dentro il dialogo per etichetta
const valoreCampo = (et) => page.evaluate((et) => {
  const l = [...document.querySelectorAll('label')].find((x) => x.querySelector('.label')?.textContent.trim().startsWith(et))
  return l?.querySelector('input,textarea,select')?.value ?? null
}, et)
const impostaCampo = async (et, valore) => {
  const trovato = await page.evaluate((et) => {
    const l = [...document.querySelectorAll('label')].find((x) => x.querySelector('.label')?.textContent.trim().startsWith(et))
    const i = l?.querySelector('input,textarea')
    if (!i) return false
    i.setAttribute('data-cur', '1'); return true
  }, et)
  if (!trovato) throw new Error(`campo "${et}" non trovato`)
  await page.$eval('[data-cur="1"]', (el) => { el.focus(); el.select() })
  await page.keyboard.press('Backspace')
  if (valore) await page.type('[data-cur="1"]', valore)
  await page.$eval('[data-cur="1"]', (el) => el.removeAttribute('data-cur'))
}
const ultimaChiamata = (metodo, rotta) => [...chiamate].reverse().find((c) => c.metodo === metodo && c.rotta === rotta)

console.log('Area admin: Preventivi e ordini')
await page.goto(`${BASE}/area/admin/preventivi`, { waitUntil: 'networkidle0' })
await prova('Si entra come admin e compaiono le tre schede', async () => {
  const t = await testo()
  contiene(t, 'Preventivi e ordini')
  for (const s of ['Ordini', 'Listino prezzi e servizi', 'Modello contratto']) contiene(t, s)
})
await prova('Elenco ordini da quotare', async () => {
  const t = await testo()
  contiene(t, 'Mario Rossi'); contiene(t, 'Anna Bianchi')
})

await prova('Ordine standard: mostra configurazione del cliente, riepilogo, allegati', async () => {
  await page.$$eval('tbody tr', (rr) => rr[0].querySelector('button').click())
  await attendi()
  const t = await testo()
  for (const s of ['Configurazione scelta dal cliente', 'Ristorante / Bar', 'Lingua aggiuntiva × 2', 'Totale indicativo', 'Materiali caricati dal cliente', 'logo.png', 'menu.pdf',
    'Il cliente paga solo l\'importo che confermi nel Preventivo'])
    contiene(t, s)
  if (/Richiede approvazione manuale/.test(t)) throw new Error('un ordine standard non deve risultare da approvare a mano')
})
await prova('Prezzo suggerito dal listino precompilato (734) con la nota del totale', async () => {
  eq(await valoreCampo('Prezzo totale'), '734')
  contiene(await testo(), 'Totale suggerito dal listino: 734,00')
})
await prova('Confermare l\'urgenza aggiorna il prezzo suggerito: 734 → 880,8 → 734', async () => {
  await clicca('label', 'Confermo la consegna urgente')
  await attendi()
  eq(await valoreCampo('Prezzo totale'), '880,8')
  await clicca('label', 'Confermo la consegna urgente')
  await attendi()
  eq(await valoreCampo('Prezzo totale'), '734')
})
await prova('Se il prezzo l\'hai scritto tu, l\'urgenza NON lo sovrascrive', async () => {
  await impostaCampo('Prezzo totale', '700')
  await clicca('label', 'Confermo la consegna urgente')
  await attendi()
  eq(await valoreCampo('Prezzo totale'), '700')
})
await prova('Allegati: il download chiede un link firmato temporaneo (scade in 2 minuti)', async () => {
  await clicca('button', 'logo.png')
  await attendi()
  const c = storage.find((x) => x.percorso.includes('richieste-allegati/richieste/' + CART + '/aaaa1111-logo.png'))
  if (!c) throw new Error('nessuna richiesta di link firmato per il file')
  eq(c.metodo, 'POST')
  eq(c.durata, 120)
})
await prova('Inviare senza giorni di consegna → errore; non invia nulla', async () => {
  const prima = chiamate.length
  await clicca('button', 'Invia preventivo al cliente')
  await attendi()
  contiene(await testo(), 'Inserisci i giorni di consegna')
  eq(chiamate.length, prima)
})
await prova('Conferma importo: invia SOLO i valori decisi dall\'admin (prezzo, acconto, giorni, stato)', async () => {
  await impostaCampo('Consegna (giorni)', '20')
  await impostaCampo('Da pagare ora', '300')
  await clicca('button', 'Invia preventivo al cliente')
  await attendi(500)
  const c = ultimaChiamata('PATCH', 'ordini_siti')
  if (!c) throw new Error('nessuna modifica inviata')
  eq(c.body.prezzo, 700)
  eq(c.body.acconto, 300)
  eq(c.body.consegna_giorni, 20)
  eq(c.body.stato, 'preventivo_inviato')
  eq(c.body.urgenza_confermata, true)
  eq(c.body.dettaglio_preventivo.urgenza_confermata, true)
  eq(c.body.dettaglio_preventivo.totale, 880.8)
  if (!c.body.preventivo_il) throw new Error('manca preventivo_il (data di conferma)')
  contiene(c.query, 'id=eq.o1')
})
await page.keyboard.press('Escape')
await attendi()

await prova('Ordine da approvare a mano: badge, prezzo VUOTO, nota esplicita', async () => {
  await page.reload({ waitUntil: 'networkidle0' })
  await page.$$eval('tbody tr', (rr) => rr[1].querySelector('button').click())
  await attendi()
  const t = await testo()
  contiene(t, 'Richiede approvazione manuale')
  contiene(t, 'finché non invii il preventivo il cliente non può pagare')
  contiene(t, 'parziale')
  eq(await valoreCampo('Prezzo totale'), '')
})
await prova('Senza prezzo non si può confermare un ordine da approvare', async () => {
  const prima = chiamate.length
  await impostaCampo('Consegna (giorni)', '30')
  await clicca('button', 'Invia preventivo al cliente')
  await attendi()
  contiene(await testo(), 'Inserisci il prezzo del sito')
  eq(chiamate.length, prima)
})
await page.keyboard.press('Escape')

console.log('\nArea admin: Listino prezzi e servizi (gestione owner)')
await page.goto(`${BASE}/area/admin/preventivi`, { waitUntil: 'networkidle0' })
await clicca('button', 'Listino prezzi e servizi')
await attendi(500)
await prova('Il listino mostra tipologie, funzionalità, servizi esterni e impostazioni', async () => {
  const t = await testo()
  for (const s of ['Tipologie di sito', 'Funzionalità aggiuntive', 'Servizi esterni e abbonamenti', 'Landing Page', 'Gestionale Personalizzato', 'da 1.199', 'Sito Personalizzato', 'Su preventivo',
    'Pagina aggiuntiva', 'Vercel', 'Pro da $20/mese', 'Google Workspace', 'Impostazioni e avvisi', 'Voce nascosta', 'Nascosta'])
    contiene(t, s)
})
await prova('Modificare il prezzo di una tipologia (Sito Vetrina 299 → 349)', async () => {
  await clicca('button', 'Modifica Sito Vetrina')
  await attendi()
  eq(await valoreCampo('Prezzo (€)'), '299')
  await impostaCampo('Prezzo (€)', '349')
  await cliccaEsatto('Salva')
  await attendi(500)
  const c = ultimaChiamata('PATCH', 'configuratore_voci')
  if (!c) throw new Error('nessuna modifica inviata')
  eq(c.body.prezzo, 349); eq(c.body.codice, 'sito_vetrina'); eq(c.body.gruppo, 'tipologia'); eq(c.body.modalita, 'fisso')
  contiene(c.query, 'codice=eq.sito_vetrina')
  contiene(await testo(), 'Voce aggiornata')
})
await prova('Prezzo non valido → errore, nessuna modifica', async () => {
  const prima = chiamate.length
  await clicca('button', 'Modifica Landing Page')
  await attendi()
  await impostaCampo('Prezzo (€)', 'abc')
  await cliccaEsatto('Salva')
  await attendi()
  contiene(await testo(), 'prezzo valido')
  eq(chiamate.length, prima)
  await page.keyboard.press('Escape')
  await attendi()
})
await prova('Una tipologia «da» avvisa che richiederà approvazione manuale', async () => {
  await clicca('button', 'Modifica Gestionale Personalizzato')
  await attendi()
  contiene(await testo(), 'da approvare a mano')
  await page.keyboard.press('Escape')
  await attendi()
})
await prova('«Pagina aggiuntiva»: si cambia il prezzo ma non si può nascondere', async () => {
  const nascondibile = await page.evaluate(() => !!document.querySelector('button[aria-label="Nascondi Pagina aggiuntiva"]'))
  eq(nascondibile, false)
  await clicca('button', 'Modifica Pagina aggiuntiva')
  await attendi()
  eq(await valoreCampo('Prezzo (€)'), '49')
  const bloccato = await page.evaluate(() => [...document.querySelectorAll('label')].find((l) => l.textContent.includes('Visibile ai clienti')).querySelector('input').disabled)
  eq(bloccato, true)
  await page.keyboard.press('Escape')
  await attendi()
})
await prova('Nascondere una voce la toglie dal modulo (attivo = false)', async () => {
  await clicca('button', 'Nascondi Newsletter')
  await attendi(400)
  const c = ultimaChiamata('PATCH', 'configuratore_voci')
  eq(c.body, { attivo: false })
  contiene(c.query, 'codice=eq.newsletter')
})
await prova('Nuovo servizio esterno: costo in testo libero, nessun prezzo numerico', async () => {
  const sezioni = await page.$$('section')
  await page.evaluate(() => {
    const sez = [...document.querySelectorAll('section')].find((s) => s.textContent.includes('Servizi esterni e abbonamenti'))
    ;[...sez.querySelectorAll('button')].find((b) => b.textContent.includes('Nuova voce')).click()
  })
  await attendi()
  await impostaCampo('Nome', 'Mailchimp')
  await impostaCampo('Costo indicativo', '$13/mese')
  await cliccaEsatto('Salva')
  await attendi(500)
  const c = ultimaChiamata('POST', 'configuratore_voci')
  if (!c) throw new Error('nessuna voce inviata')
  eq(c.body.codice, 'mailchimp'); eq(c.body.gruppo, 'servizio_esterno'); eq(c.body.costo_testo, '$13/mese'); eq(c.body.prezzo, null); eq(c.body.attivo, true)
})
await prova('Impostazioni: % urgenza 25 e avvisi salvati', async () => {
  await impostaCampo('Supplemento consegna urgente', '25')
  await clicca('button', 'Salva impostazioni')
  await attendi(500)
  const c = ultimaChiamata('POST', 'configuratore_impostazioni')
  const righe = Object.fromEntries(c.body.map((r) => [r.chiave, r.valore]))
  eq(righe.urgenza_percentuale, '25')
  contiene(righe.avviso_preventivo, 'soggetto a conferma da parte di FormaWeb')
  contiene(righe.avviso_servizi_esterni, 'concordati prima')
})
await prova('Impostazioni: % urgenza fuori range (150) rifiutata', async () => {
  const prima = chiamate.length
  await impostaCampo('Supplemento consegna urgente', '150')
  await clicca('button', 'Salva impostazioni')
  await attendi()
  contiene(await testo(), 'tra 0 e 100')
  eq(chiamate.length, prima)
})

console.log('\nProva un mese: gestione owner (listino e impostazioni)')
const riga = (nome) => page.evaluate((n) => [...document.querySelectorAll('tbody tr')].find((tr) => tr.textContent.includes(n))?.innerText ?? '', nome)
const scrive = async (sel, v) => { await page.$eval(sel, (el) => { el.focus(); el.select() }); await page.keyboard.press('Backspace'); await page.type(sel, v) }
const casella = (testoEtichetta) => page.evaluate((t) => [...document.querySelectorAll('label')].find((l) => l.textContent.includes(t))?.querySelector('input')?.checked ?? null, testoEtichetta)
await page.goto(`${BASE}/area/admin/preventivi`, { waitUntil: 'networkidle0' })
await clicca('button', 'Listino prezzi e servizi')
await attendi(500)
await prova('Il listino ha la colonna «In prova» e mostra cosa è escluso (Chatbot AI: No)', async () => {
  contiene(await testo(), 'In prova')
  if (!/No\s+Sì/.test(await riga('Chatbot AI'))) throw new Error('Chatbot AI dovrebbe essere No in prova: ' + (await riga('Chatbot AI')))
  if (!/Sì\s+Sì/.test(await riga('Newsletter'))) throw new Error('Newsletter dovrebbe essere Sì in prova')
})
await prova('Servizi esterni: nessuna colonna «In prova» (non ha senso per i costi informativi)', async () => {
  const ha = await page.evaluate(() => {
    const sez = [...document.querySelectorAll('section')].find((s) => s.textContent.includes('Servizi esterni e abbonamenti'))
    return [...sez.querySelectorAll('th')].some((th) => th.textContent.includes('In prova'))
  })
  eq(ha, false)
})
await prova("Si mette il Chatbot AI anche nella prova: casella «Disponibile anche nella Prova un mese» → salva in_prova = true", async () => {
  await clicca('button', 'Modifica Chatbot AI')
  await attendi()
  eq(await casella('Disponibile anche nella'), false)
  contiene(await testo(), 'Nella prova ha lo sconto')
  await clicca('label', 'Disponibile anche nella')
  await cliccaEsatto('Salva')
  await attendi(500)
  const c = ultimaChiamata('PATCH', 'configuratore_voci')
  eq(c.body.in_prova, true); eq(c.body.codice, 'chatbot_ai'); eq(c.body.gruppo, 'extra')
  contiene(c.query, 'codice=eq.chatbot_ai')
})
await prova('Si toglie un servizio dalla prova (Newsletter) → in_prova = false, resta acquistabile', async () => {
  await clicca('button', 'Modifica Newsletter')
  await attendi()
  eq(await casella('Disponibile anche nella'), true)
  await clicca('label', 'Disponibile anche nella')
  await cliccaEsatto('Salva')
  await attendi(500)
  const c = ultimaChiamata('PATCH', 'configuratore_voci')
  eq(c.body.in_prova, false); eq(c.body.attivo, true); eq(c.body.codice, 'newsletter')
})
await prova('Una tipologia si esclude dalla prova con lo stesso comando (testo specifico per i siti)', async () => {
  await clicca('button', 'Modifica Eventi')
  await attendi()
  contiene(await testo(), 'questo tipo di sito non si può provare per un mese')
  await page.keyboard.press('Escape')
  await attendi()
})
await prova('Una nuova funzionalità nasce disponibile anche nella prova (casella già spuntata)', async () => {
  await page.evaluate(() => {
    const sez = [...document.querySelectorAll('section')].find((s) => s.textContent.includes('Funzionalità aggiuntive') && s.querySelector('button'))
    ;[...sez.querySelectorAll('button')].find((b) => b.textContent.includes('Nuova voce')).click()
  })
  await attendi()
  eq(await casella('Disponibile anche nella'), true)
  await impostaCampo('Nome', 'Logo grafico')
  await impostaCampo('Prezzo (€)', '60')
  await cliccaEsatto('Salva')
  await attendi(500)
  const c = ultimaChiamata('POST', 'configuratore_voci')
  eq(c.body.codice, 'logo_grafico'); eq(c.body.gruppo, 'extra'); eq(c.body.prezzo, 60); eq(c.body.in_prova, true)
})
await prova('Impostazioni della prova: prezzo 120 € e sconto 60% salvati', async () => {
  eq(await valoreCampo('Prova un mese: prezzo'), '100')
  eq(await valoreCampo('Prova un mese: sconto'), '70')
  await impostaCampo('Prova un mese: prezzo', '120')
  await impostaCampo('Prova un mese: sconto', '60')
  await clicca('button', 'Salva impostazioni')
  await attendi(500)
  const righe = Object.fromEntries(ultimaChiamata('POST', 'configuratore_impostazioni').body.map((r) => [r.chiave, r.valore]))
  eq(righe.prova_prezzo, '120'); eq(righe.prova_sconto_extra, '60')
})
await prova('Sconto della prova fuori range (150%) rifiutato, nessun invio', async () => {
  const prima = chiamate.length
  await impostaCampo('Prova un mese: sconto', '150')
  await clicca('button', 'Salva impostazioni')
  await attendi()
  contiene(await testo(), 'sconto della prova deve essere tra 0 e 100')
  eq(chiamate.length, prima)
})

console.log('\nProva un mese e contanti: ordini')
await page.goto(`${BASE}/area/admin/preventivi`, { waitUntil: 'networkidle0' })
await prova('Nell\'elenco l\'ordine di prova ha l\'etichetta «Prova»', async () => {
  contiene(await riga('Carla Gialli'), 'Prova')
})
await prova('Ordine di prova: pannello della prova, prezzo pieno 734 e mese di prova 200,5 precompilati', async () => {
  await page.evaluate(() => [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('Carla Gialli')).querySelector('button').click())
  await attendi()
  const t = await testo()
  for (const s of ['Come funziona la prova di un mese', 'Da pagare ora', '200,50', '533,50', 'Prezzo pieno del sito: 734,00', 'Prova di un mese: prezzo pieno suggerito 734,00']) contiene(t, s)
  eq(await valoreCampo('Prezzo pieno del sito'), '734')
  eq(await valoreCampo('Da pagare ora: mese di prova'), '200,5')
})
await prova('Pagamento in contanti: il blocco c\'è, propone il mese di prova (200,5) e spiega il resto', async () => {
  const t = await testo()
  contiene(t, 'Pagamento in contanti'); contiene(t, 'il resto dopo il mese lo registri dal progetto')
  eq(await valoreCampo('Importo ricevuto'), '200,5')
})
await prova('Importo non valido (800 > prezzo, 0) → errore e nessun invio', async () => {
  const prima = chiamate.length
  for (const v of ['800', '0']) {
    await impostaCampo('Importo ricevuto', v)
    await cliccaEsatto('Segna come pagato in contanti'); await attendi(150)
    await cliccaEsatto('Sì, registra'); await attendi(300)
    contiene(await testo(), 'maggiore di 0 e al massimo il prezzo')
    const annulla = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Annulla'); b?.click(); return !!b })
    if (!annulla) throw new Error('manca Annulla')
  }
  eq(chiamate.length, prima)
})
await prova('Registrazione corretta: prima salva il prezzo, poi chiama la funzione sicura con importo e ordine', async () => {
  await impostaCampo('Importo ricevuto', '200,5')
  await impostaCampo('Consegna (giorni)', '15')
  await cliccaEsatto('Segna come pagato in contanti'); await attendi(150)
  contiene(await testo(), 'Confermi di aver ricevuto 200,50')
  await cliccaEsatto('Sì, registra'); await attendi(600)
  const salvataggi = chiamate.filter((c) => c.metodo === 'PATCH' && c.rotta === 'ordini_siti')
  const patch = salvataggi[salvataggi.length - 1]
  eq(patch.body.prezzo, 734); eq(patch.body.consegna_giorni, 15)
  contiene(patch.query, 'id=eq.o3')
  if ('stato' in patch.body) throw new Error('il browser non deve impostare lo stato "pagato": lo fa il server')
  const rpc = ultimaChiamata('POST', 'rpc/admin_segna_pagato_contanti')
  eq(rpc.body, { p_ordine: 'o3', p_importo: 200.5 })
  contiene(await testo(), 'Pagamento in contanti registrato')
})
await page.keyboard.press('Escape')
await prova('Ordine normale: il contante propone l\'intero prezzo (734) e non l\'acconto', async () => {
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('Mario Rossi')).querySelector('button').click())
  await attendi()
  eq(await valoreCampo('Importo ricevuto'), '734')
  contiene(await testo(), 'Se ti ha dato solo un acconto')
  await page.keyboard.press('Escape')
})
await prova('Ordine pagato in contanti (prova): mostra «in contanti», fine prova e resto da incassare', async () => {
  await page.reload({ waitUntil: 'networkidle0' })
  await clicca('button', 'Pagato (')
  await attendi()
  contiene(await riga('Paolo Blu'), 'contanti')
  await page.evaluate(() => [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('Paolo Blu')).querySelector('button').click())
  await attendi()
  const t = await testo()
  for (const s of ['Pagato in contanti', 'va stampato e fatto firmare al cliente', 'Prova di un mese fino al 10/11/2026', '533,50', 'Registra incasso'])
    contiene(t, s)
  if (/Pagamento in contanti\s*\n\s*Se il cliente ti paga di persona/.test(t)) throw new Error('un ordine già pagato non deve offrire di nuovo il contante')
  await page.keyboard.press('Escape')
})

console.log('\nContratto della prova')
await page.goto(`${BASE}/area/admin/preventivi`, { waitUntil: 'networkidle0' })
await clicca('button', 'Modello contratto')
await attendi(400)
await prova('Due modelli: standard e «Prova un mese» (con avviso di farlo controllare)', async () => {
  let t = await testo()
  contiene(t, 'Contratto standard'); contiene(t, 'Contratto «Prova un mese»')
  eq(await page.$eval('textarea', (e) => e.value), '# Contratto')
  contiene(t, '{{totale_sito}}'); contiene(t, '{{prova_fino_al}}')
  await clicca('button', 'Contratto «Prova un mese»')
  await attendi(400)
  t = await testo()
  contiene(t, 'fai controllare il testo')
  eq(await page.$eval('textarea', (e) => e.value), '# CONTRATTO PROVA')
})
await prova('Salvando il modello della prova si scrive la riga 2 (non la 1)', async () => {
  await page.$eval('textarea', (e) => { e.focus(); e.select() })
  await page.keyboard.type('# CONTRATTO PROVA MODIFICATO con testo abbastanza lungo')
  await clicca('button', 'Salva modello')
  await attendi(500)
  const c = ultimaChiamata('POST', 'ordini_contratto')
  eq(c.body.id, 2)
  contiene(c.body.testo, 'MODIFICATO')
})

console.log('\nProgetto in prova: incasso del resto')
await page.goto(`${BASE}/area/admin/progetti`, { waitUntil: 'networkidle0' })
await prova('Elenco progetti: «In prova fino al» e quanto resta da incassare', async () => {
  const t = await testo()
  contiene(t, 'In prova fino al 10/11/2026'); contiene(t, 'ancora 700,00')
})
await page.goto(`${BASE}/area/admin/progetti/p1`, { waitUntil: 'networkidle0' })
await prova('Scheda progetto: «Registra incasso» e data fine prova', async () => {
  contiene(await testo(), 'Registra incasso')
  eq(await page.$eval('#prova', (e) => e.value), '2026-11-10')
  eq(await page.$eval('#incassato', (e) => e.value), '300')
})
await prova('Incasso oltre il resto (800 > 700) → errore chiaro, nessuna modifica', async () => {
  const prima = chiamate.length
  await page.type('input[aria-label="Importo incassato in contanti"]', '800')
  await clicca('button', 'Registra incasso')
  await attendi()
  contiene(await testo(), 'restano da pagare solo 700,00')
  eq(chiamate.length, prima)
})
await prova('Incasso parziale in contanti (100): «Già incassato» passa a 400, la prova resta', async () => {
  await scrive('input[aria-label="Importo incassato in contanti"]', '100')
  await clicca('button', 'Registra incasso')
  await attendi(500)
  const c = ultimaChiamata('PATCH', 'progetti')
  eq(c.body, { incassato: 400 })
  eq(await page.$eval('#incassato', (e) => e.value), '400')
  contiene(await testo(), 'Restano da incassare 600,00')
})
await prova('Saldo finale (600): progetto interamente pagato e fine prova azzerata', async () => {
  await scrive('input[aria-label="Importo incassato in contanti"]', '600')
  await clicca('button', 'Registra incasso')
  await attendi(500)
  const c = ultimaChiamata('PATCH', 'progetti')
  eq(c.body, { incassato: 1000, prova_fino_al: null })
  eq(await page.$eval('#prova', (e) => e.value), '')
  contiene(await testo(), 'interamente pagato')
})
await prova('Riepilogo: carta «Prove in corso» con il resto da incassare e la scadenza', async () => {
  await page.goto(`${BASE}/area/admin`, { waitUntil: 'networkidle0' })
  const t = await testo()
  contiene(t, 'Prove in corso'); contiene(t, 'Resto dopo la prova: 700,00'); contiene(t, 'prima scadenza 10/11/2026')
})

console.log('\nPermessi')
await prova('Un socio (non admin) NON può gestire preventivi e listino', async () => {
  ruolo = 'socio'
  await page.goto(`${BASE}/area/admin/preventivi`, { waitUntil: 'networkidle0' })
  contiene(await testo(), "Solo l'amministratore gestisce preventivi e ordini")
  if (/Listino prezzi e servizi/.test(await testo())) throw new Error('il socio vede il listino')
})

if (errori.length) console.log('\nErrori JavaScript nella pagina:\n - ' + errori.join('\n - '))
await browser.close()
console.log(`\n${ok} controlli superati, ${falliti.length} falliti${errori.length ? `, ${errori.length} errori JS` : ''}`)
if (falliti.length) console.log('Falliti:\n - ' + falliti.join('\n - '))
process.exit(falliti.length || errori.length ? 1 : 0)
