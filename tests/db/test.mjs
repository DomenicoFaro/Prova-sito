// Test del database: calcolo prezzi, permessi (RLS), allegati, prezzi manipolati, progetto dopo il pagamento.
// Esegui con:  npm run test:db
import { readFileSync } from 'node:fs'
import { creaDb } from './setup.mjs'

const { db, log } = await creaDb()
console.log(log.filter((l) => l.startsWith('ERRORE')).join('\n') || '(script caricati)')

let ok = 0
const falliti = []
async function prova(nome, fn) {
  try {
    await fn()
    ok++
    console.log(`  ok   ${nome}`)
  } catch (e) {
    falliti.push(nome)
    console.log(`  FAIL ${nome}\n       ${e.message}`)
  }
}
const eq = (a, b, msg = '') => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} atteso ${JSON.stringify(b)}, ottenuto ${JSON.stringify(a)}`)
}
async function errore(sql, params, contiene) {
  try {
    await db.query(sql, params)
  } catch (e) {
    if (contiene && !e.message.includes(contiene)) throw new Error(`errore diverso: "${e.message}" (atteso "${contiene}")`)
    return e.message
  }
  throw new Error('doveva dare errore ma è riuscito')
}
const calcola = async (p) => (await db.query('select public.calcola_preventivo($1::jsonb) as r', [JSON.stringify(p)])).rows[0].r
const comeAnon = () => db.exec(`reset role; select set_config('request.jwt.claim.sub','',false); set role anon;`)
const comeUtente = (id) => db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`)
const comeSuper = () => db.exec(`reset role;`)

// utenti di prova: un admin e un collaboratore
await comeSuper()
const ADMIN = '11111111-1111-1111-1111-111111111111'
const COLLAB = '22222222-2222-2222-2222-222222222222'
await db.exec(`insert into auth.users (id, email) values ('${ADMIN}','admin@x.it'), ('${COLLAB}','collab@x.it');
               update public.profiles set ruolo = 'admin' where id = '${ADMIN}';`)

console.log('\nCalcolo del preventivo')
await comeAnon()

await prova('Ristorante, 6 pagine, modulo contatti + 2 lingue = 734 €', async () => {
  const r = await calcola({ tipologia: 'ristorante_bar', pagine: 6, extra: { modulo_contatti: 1, lingua_aggiuntiva: 2 } })
  eq(Number(r.subtotale), 734, 'subtotale')
  eq(Number(r.pagine_extra), 2)
  eq(Number(r.pagine_extra_importo), 98)
  eq(Number(r.totale), 734, 'totale senza urgenza')
  eq(Number(r.urgenza_importo), 146.8, 'urgenza stimata 20%')
  eq(r.approvazione_manuale, false)
})
await prova('Urgenza confermata: +20% del subtotale = 880,80 €', async () => {
  const r = await calcola({ tipologia: 'ristorante_bar', pagine: 6, extra: { modulo_contatti: 1, lingua_aggiuntiva: 2 }, urgenza_confermata: true })
  eq(Number(r.totale), 880.8)
})
await prova('Nessun doppio conteggio: sistema prenotazioni già incluso in Prenotazioni Online', async () => {
  const r = await calcola({ tipologia: 'prenotazioni_online', pagine: 5, extra: { sistema_prenotazioni: 1 } })
  eq(Number(r.totale), 599)
  eq(r.righe[0].incluso, true)
  eq(Number(r.righe[0].importo), 0)
})
await prova('Extra non incluso viene addebitato (Prenotazioni Online + SEO)', async () => {
  const r = await calcola({ tipologia: 'prenotazioni_online', pagine: 5, extra: { sistema_prenotazioni: 1, seo_base: 1 } })
  eq(Number(r.totale), 698)
})
await prova('Pagine incluse non si pagano (Landing, 1 pagina = 199 €)', async () => {
  eq(Number((await calcola({ tipologia: 'landing_page', pagine: 1 })).totale), 199)
})
await prova('Una pagina in più sulla Landing = 199 + 49', async () => {
  eq(Number((await calcola({ tipologia: 'landing_page', pagine: 2 })).totale), 248)
})
await prova('Pagine non indicate: usa quelle incluse, nessun costo', async () => {
  eq(Number((await calcola({ tipologia: 'sito_vetrina' })).totale), 299)
})
await prova('E-commerce + Gestione ordini ("da"): 1.198 € e richiede approvazione', async () => {
  const r = await calcola({ tipologia: 'ecommerce', pagine: 6, extra: { pagamenti_online: 1, gestione_ordini: 1 } })
  eq(Number(r.totale), 1198)
  eq(r.approvazione_manuale, true)
})
await prova('Gestionale ("da 1.199"): richiede approvazione', async () => {
  const r = await calcola({ tipologia: 'gestionale', pagine: 1 })
  eq(Number(r.totale), 1199)
  eq(r.approvazione_manuale, true)
})
await prova('Sito personalizzato: nessun prezzo automatico, richiede approvazione, pagine non addebitate', async () => {
  const r = await calcola({ tipologia: 'sito_personalizzato', pagine: 20 })
  eq(Number(r.totale), 0)
  eq(r.approvazione_manuale, true)
  eq(Number(r.pagine_extra_importo), 0)
})
await prova('Extra senza quantità (WhatsApp ×5) vale una volta sola', async () => {
  eq(Number((await calcola({ tipologia: 'sito_vetrina', pagine: 3, extra: { pulsante_whatsapp: 5 } })).totale), 318)
})
await prova('Lingue limitate a 20 (anti abuso)', async () => {
  eq(Number((await calcola({ tipologia: 'sito_vetrina', pagine: 3, extra: { lingua_aggiuntiva: 99 } })).subtotale), 299 + 20 * 99)
})
await prova('Quantità 0 e valori non numerici sono ignorati', async () => {
  eq(Number((await calcola({ tipologia: 'sito_vetrina', pagine: 3, extra: { modulo_contatti: 0, newsletter: 'x', seo_base: true } })).totale), 299)
})
await prova('Tipologia inesistente → errore', () => errore(`select public.calcola_preventivo('{"tipologia":"nope"}')`, [], 'Scegli il tipo di sito'))
await prova('Extra inesistente → errore', () => errore(`select public.calcola_preventivo('{"tipologia":"sito_vetrina","extra":{"inventato":1}}')`, [], 'non valida'))
await prova('"pagina_aggiuntiva" non è selezionabile come extra', () => errore(`select public.calcola_preventivo('{"tipologia":"sito_vetrina","extra":{"pagina_aggiuntiva":3}}')`, [], 'non valida'))
await prova('Pagine non numeriche → errore', () => errore(`select public.calcola_preventivo('{"tipologia":"sito_vetrina","pagine":"abc"}')`, [], 'Numero di pagine non valido'))
await prova('Pagine 0 e 101 → errore', async () => {
  await errore(`select public.calcola_preventivo('{"tipologia":"sito_vetrina","pagine":0}')`, [], 'tra 1 e 100')
  await errore(`select public.calcola_preventivo('{"tipologia":"sito_vetrina","pagine":101}')`, [], 'tra 1 e 100')
})

console.log('\nPermessi del listino')
await prova('Il pubblico legge il listino attivo', async () => {
  const r = await db.query(`select count(*)::int n from public.configuratore_voci`)
  eq(r.rows[0].n, 13 + 14 + 8)
})
await prova('Il pubblico NON può modificare i prezzi', async () => {
  const msg = await errore(`update public.configuratore_voci set prezzo = 1 where codice = 'sito_vetrina'`, [])
  if (!/permission denied/.test(msg)) throw new Error(msg)
})
await prova('Il pubblico NON può modificare le impostazioni (urgenza)', async () => {
  const msg = await errore(`update public.configuratore_impostazioni set valore = '0'`, [])
  if (!/permission denied/.test(msg)) throw new Error(msg)
})
await comeUtente(COLLAB)
await prova('Un collaboratore NON può modificare i prezzi (0 righe toccate)', async () => {
  const r = await db.query(`update public.configuratore_voci set prezzo = 1 where codice = 'sito_vetrina'`)
  eq(r.affectedRows, 0)
})
await prova('Un collaboratore NON può inserire voci', () => errore(`insert into public.configuratore_voci (codice, gruppo, nome, prezzo) values ('hack','extra','Hack',0)`, [], 'row-level security'))
await comeUtente(ADMIN)
await prova("L'admin modifica un prezzo e il calcolo cambia subito", async () => {
  await db.query(`update public.configuratore_voci set prezzo = 350 where codice = 'sito_vetrina'`)
  eq(Number((await calcola({ tipologia: 'sito_vetrina', pagine: 3 })).totale), 350)
})
await prova("L'admin cambia la % di urgenza (30%) e il calcolo la usa", async () => {
  await db.query(`update public.configuratore_impostazioni set valore = '30' where chiave = 'urgenza_percentuale'`)
  const r = await calcola({ tipologia: 'sito_vetrina', pagine: 3, urgenza_confermata: true })
  eq(Number(r.urgenza_importo), 105)
  eq(Number(r.totale), 455)
})
await prova("L'admin nasconde una tipologia: non è più scegliibile", async () => {
  await db.query(`update public.configuratore_voci set attivo = false where codice = 'eventi'`)
  await errore(`select public.calcola_preventivo('{"tipologia":"eventi"}')`, [], 'Scegli il tipo di sito')
})
await comeSuper()
await db.exec(`update public.configuratore_voci set prezzo = 299 where codice = 'sito_vetrina'; update public.configuratore_voci set attivo = true where codice = 'eventi'; update public.configuratore_impostazioni set valore = '20' where chiave = 'urgenza_percentuale';`)
await prova('Rieseguire configuratore.sql NON sovrascrive i prezzi modificati', async () => {
  await db.exec(`update public.configuratore_voci set prezzo = 777 where codice = 'sito_aziendale'`)
  await db.exec(readFileSync(new URL('../../supabase/configuratore.sql', import.meta.url), 'utf8'))
  const r = await db.query(`select prezzo from public.configuratore_voci where codice = 'sito_aziendale'`)
  eq(Number(r.rows[0].prezzo), 777)
  await db.exec(`update public.configuratore_voci set prezzo = 449 where codice = 'sito_aziendale'`)
})

console.log('\nInvio richiesta e prezzi manipolati')
let _n = 0
const base = {
  cliente_nome: 'Mario Rossi', get cliente_email() { return `cliente${++_n}@test.it` }, cliente_telefono: '333', cliente_codice: 'RSSMRA80A01H501U',
  cliente_indirizzo: 'Via Roma 1, Milano', descrizione: 'Un sito per il mio ristorante', nome_attivita: 'Da Mario',
}
const crea = async (p) => (await db.query('select public.crea_richiesta_sito($1::jsonb) as t', [JSON.stringify(p)])).rows[0].t
const ordine = async (t) => (await db.query('select * from public.ordini_siti where token = $1', [t])).rows[0]

await comeAnon()
let tokenOk
await prova('Richiesta valida: prezzo ricalcolato dal server, ordine SENZA prezzo definitivo', async () => {
  tokenOk = await crea({ ...base, tipologia: 'ristorante_bar', pagine: 6, extra: { modulo_contatti: 1, lingua_aggiuntiva: 2 }, scadenza_tipo: 'urgente', budget: '600–1.000 €' })
  await comeSuper()
  const o = await ordine(tokenOk)
  eq(Number(o.totale_indicativo), 734)
  eq(o.prezzo, null, 'prezzo definitivo')
  eq(o.stato, 'richiesto')
  eq(o.tipo_sito, 'Ristorante / Bar')
  eq(o.pagine, '6 pagine')
  eq(o.urgenza_richiesta, true)
  eq(o.urgenza_confermata, false)
  eq(o.scadenza, 'Consegna urgente (da confermare)')
  eq(o.budget, '600–1.000 €')
  eq(o.funzionalita.sort(), ['Lingua aggiuntiva ×2', 'Modulo contatti'])
  await comeAnon()
})
await prova('Prezzi/totali/urgenza inviati dal browser vengono IGNORATI', async () => {
  const t = await crea({ ...base, tipologia: 'ecommerce', pagine: 6, prezzo: 1, totale_indicativo: 1, totale: 1, subtotale: 1,
                         acconto: 1, urgenza_confermata: true, stato: 'pagato', approvazione_manuale: false, dettaglio_preventivo: { totale: 1 } })
  await comeSuper()
  const o = await ordine(t)
  eq(Number(o.totale_indicativo), 899)
  eq(o.prezzo, null)
  eq(o.acconto, null)
  eq(o.stato, 'richiesto')
  eq(o.urgenza_confermata, false)
  eq(o.approvazione_manuale, false)
  eq(Number(o.dettaglio_preventivo.totale), 899)
  await comeAnon()
})
await prova('Sito personalizzato → approvazione manuale richiesta e nessun prezzo', async () => {
  const t = await crea({ ...base, tipologia: 'sito_personalizzato', pagine: 10 })
  await comeSuper()
  const o = await ordine(t)
  eq(o.approvazione_manuale, true)
  eq(o.prezzo, null)
  await comeAnon()
})
await prova('Tipologia inventata → richiesta rifiutata', () => errore(`select public.crea_richiesta_sito($1::jsonb)`, [JSON.stringify({ ...base, tipologia: 'gratis' })], 'Scegli il tipo di sito'))
await prova('Dati cliente mancanti → rifiutata (nome, email, CF, indirizzo, descrizione)', async () => {
  await errore(`select public.crea_richiesta_sito($1::jsonb)`, [JSON.stringify({ ...base, tipologia: 'sito_vetrina', cliente_nome: '' })], 'nome')
  await errore(`select public.crea_richiesta_sito($1::jsonb)`, [JSON.stringify({ ...base, tipologia: 'sito_vetrina', cliente_email: 'no' })], 'email')
  await errore(`select public.crea_richiesta_sito($1::jsonb)`, [JSON.stringify({ ...base, tipologia: 'sito_vetrina', cliente_codice: '1' })], 'codice fiscale')
  await errore(`select public.crea_richiesta_sito($1::jsonb)`, [JSON.stringify({ ...base, tipologia: 'sito_vetrina', descrizione: 'corta' })], 'Descrivi')
})
await prova('Il vecchio modulo (senza tipologia) funziona ancora', async () => {
  const t = await crea({ ...base, tipo_sito: 'Sito vetrina', pagine: '2–5 pagine', funzionalita: ['SEO di base'], budget: '500' })
  await comeSuper()
  const o = await ordine(t)
  eq(o.tipo_sito, 'Sito vetrina')
  eq(o.totale_indicativo, null)
  await comeAnon()
})

console.log('\nAllegati')
const CART = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
await prova('Allegati con percorso corretto accettati', async () => {
  const t = await crea({ ...base, tipologia: 'sito_vetrina', cartella: CART, allegati: [`richieste/${CART}/logo.png`, `richieste/${CART}/testi-v2.pdf`] })
  await comeSuper()
  eq((await ordine(t)).allegati.length, 2)
  await comeAnon()
})
await prova('Allegato fuori dalla propria cartella → rifiutato', () =>
  errore(`select public.crea_richiesta_sito($1::jsonb)`, [JSON.stringify({ ...base, tipologia: 'sito_vetrina', cartella: CART, allegati: ['richieste/altra-cartella-0000-0000-0000-000000000000/x.png'] })], 'Allegato non valido'))
await prova('Percorsi con ".." o di altri bucket → rifiutati', async () => {
  await errore(`select public.crea_richiesta_sito($1::jsonb)`, [JSON.stringify({ ...base, tipologia: 'sito_vetrina', cartella: CART, allegati: [`richieste/${CART}/../../x.png`] })], 'Allegato non valido')
  await errore(`select public.crea_richiesta_sito($1::jsonb)`, [JSON.stringify({ ...base, tipologia: 'sito_vetrina', cartella: CART, allegati: [`contratti/firmati/x.pdf`] })], 'Allegato non valido')
})
await prova('Più di 10 allegati → rifiutato', () =>
  errore(`select public.crea_richiesta_sito($1::jsonb)`, [JSON.stringify({ ...base, tipologia: 'sito_vetrina', cartella: CART, allegati: Array.from({ length: 11 }, (_, i) => `richieste/${CART}/f${i}.png`) })], 'massimo 10'))
await prova('Cartella non valida → rifiutato', () =>
  errore(`select public.crea_richiesta_sito($1::jsonb)`, [JSON.stringify({ ...base, tipologia: 'sito_vetrina', cartella: 'x', allegati: ['richieste/x/a.png'] })], 'Allegati non validi'))

console.log('\nStorage (bucket privato)')
await prova('Il bucket è privato, con limite 5 MB e tipi consentiti', async () => {
  await comeSuper()
  const b = (await db.query(`select * from storage.buckets where id = 'richieste-allegati'`)).rows[0]
  eq(b.public, false)
  eq(Number(b.file_size_limit), 5242880)
  if (!b.allowed_mime_types.includes('application/pdf') || b.allowed_mime_types.some((m) => m.includes('svg') || m.includes('html') || m.includes('javascript'))) throw new Error('mime non corretti')
  await comeAnon()
})
await prova('Il cliente può caricare nel percorso corretto', async () => {
  await db.query(`insert into storage.objects (bucket_id, name) values ('richieste-allegati', 'richieste/${CART}/logo.png')`)
})
await prova('Il cliente NON può caricare in percorsi strani', async () => {
  for (const nome of ['logo.png', `richieste/${CART}/sub/x.png`, `richieste/${CART}/../x.png`, 'richieste/zzz/x.png', `richieste/${CART}/a b.png`])
    await errore(`insert into storage.objects (bucket_id, name) values ('richieste-allegati', $1)`, [nome], 'row-level security')
})
await prova('Il cliente NON può caricare in altri bucket', () => errore(`insert into storage.objects (bucket_id, name) values ('contratti', 'richieste/${CART}/x.png')`, [], 'row-level security'))
await prova('Il cliente NON può leggere i file caricati', async () => {
  eq((await db.query(`select count(*)::int n from storage.objects where bucket_id='richieste-allegati'`)).rows[0].n, 0)
})
await comeUtente(COLLAB)
await prova('Un collaboratore NON legge i file dei clienti', async () => {
  eq((await db.query(`select count(*)::int n from storage.objects where bucket_id='richieste-allegati'`)).rows[0].n, 0)
})
await comeUtente(ADMIN)
await prova("L'admin legge i file dei clienti", async () => {
  eq((await db.query(`select count(*)::int n from storage.objects where bucket_id='richieste-allegati'`)).rows[0].n, 1)
})

console.log('\nLettura ordine e privacy dei dati')
await comeAnon()
await prova('Il pubblico NON legge direttamente gli ordini', async () => {
  const msg = await errore(`select * from public.ordini_siti`, [])
  if (!/permission denied/.test(msg)) throw new Error(msg)
})
await prova('leggi_ordine mostra riepilogo e approvazione, ma non le note interne', async () => {
  const r = (await db.query(`select public.leggi_ordine($1) as o`, [tokenOk])).rows[0].o
  eq(Number(r.totale_indicativo), 734)
  eq(r.approvazione_manuale, false)
  eq(r.urgenza_richiesta, true)
  eq(r.prezzo, null)
  eq(r.stato, 'richiesto')
  eq('nota_interna' in r, false)
  eq('cliente_codice' in r, false)
  eq('allegati' in r, false)
  eq(r.n_allegati, 0)
})

console.log('\nPagamento bloccato finché FormaWeb non conferma (stato letto da crea-checkout)')
await prova('Ordine appena creato: stato "richiesto" e prezzo nullo → crea-checkout lo rifiuta', async () => {
  await comeSuper()
  const o = await ordine(tokenOk)
  // crea-checkout accetta solo: stato = preventivo_inviato E prezzo valorizzato
  eq(o.stato !== 'preventivo_inviato' || !o.prezzo, true)
  await comeAnon()
})
await prova('Il cliente NON può portare lui l\'ordine a "preventivo_inviato" o impostare il prezzo', async () => {
  const msg = await errore(`update public.ordini_siti set stato='preventivo_inviato', prezzo=1 where token = $1`, [tokenOk])
  if (!/permission denied/.test(msg)) throw new Error(msg)
})
await comeUtente(COLLAB)
await prova('Nemmeno un collaboratore può confermare un importo', async () => {
  const r = await db.query(`update public.ordini_siti set stato='preventivo_inviato', prezzo=1 where token = $1`, [tokenOk])
  eq(r.affectedRows, 0)
})

console.log('\nProgetto automatico dopo il pagamento (modifica precedente, incassi.sql)')
await comeSuper()
await prova('Pagato solo l\'acconto: progetto "in lavorazione", prezzo pieno, incassato = acconto', async () => {
  await db.exec(`update public.ordini_siti set stato='preventivo_inviato', prezzo=1000, acconto=300, consegna_giorni=20, stripe_session_id='cs_test_1' where token='${tokenOk}'`)
  const id = (await db.query(`select public._ordine_segna_pagato('cs_test_1', 300) as id`)).rows[0].id
  const o = await ordine(tokenOk)
  eq(o.stato, 'pagato')
  eq(Number(o.importo_pagato), 300)
  const p = (await db.query(`select * from public.progetti where ordine_id = $1`, [id])).rows
  eq(p.length, 1)
  eq(Number(p[0].prezzo_totale), 1000)
  eq(Number(p[0].incassato), 300)
  eq(p[0].stato, 'in_lavorazione')
  eq(p[0].gestore_id, null)
  eq(p[0].pubblico, false)
  eq(p[0].nome, 'Da Mario')
})
await prova('Webhook ripetuto: nessun progetto duplicato', async () => {
  await db.query(`select public._ordine_segna_pagato('cs_test_1', 300)`)
  eq((await db.query(`select count(*)::int n from public.progetti where ordine_id is not null`)).rows[0].n, 1)
})
await prova('Contratto compilato include i dati del configuratore (tipo, pagine, funzioni)', async () => {
  const c = (await ordine(tokenOk)).contratto_finale
  for (const s of ['Ristorante / Bar', '6 pagine', 'Modulo contatti', 'Lingua aggiuntiva ×2'])
    if (!c.includes(s)) throw new Error(`manca "${s}" nel contratto`)
})

console.log('\nPrezzi pubblici (modifica precedente, prezzi_pubblici.sql)')
await db.exec(`insert into public.prezzi (tipo, nome, prezzo, periodicita, attivo) values ('abbonamento','Assistenza',30,'al mese',true), ('servizio','Nascosto',10,'',false), ('sito','Vetrina',300,'',true);`)
await comeAnon()
await prova('Il pubblico vede solo le voci attive, anche gli abbonamenti', async () => {
  const r = (await db.query(`select tipo from public.prezzi order by tipo`)).rows.map((x) => x.tipo)
  eq(r, ['abbonamento', 'sito'])
})
await prova('Il pubblico non può modificare il listino pubblico', async () => {
  const msg = await errore(`update public.prezzi set prezzo = 1`, [])
  if (!/permission denied/.test(msg)) throw new Error(msg)
})

console.log(`\n${ok} test superati, ${falliti.length} falliti`)
if (falliti.length) {
  console.log('Falliti:\n - ' + falliti.join('\n - '))
  process.exit(1)
}
