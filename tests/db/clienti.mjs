// Test dei permessi di supabase/clienti_recensioni.sql: clienti, cassaforte, recensioni e ticket.
// Esegui con:  npm run test:db
import { readFileSync } from 'node:fs'
import { come, datiDemo, preparaDb } from '../anteprima/backend.mjs'

const db = await preparaDb()
const { admin, collab, cliente } = await datiDemo(db)

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
const q = (chi, sql, p) => come(db, chi, async (tx) => (await tx.query(sql, p)).rows)
const conta = async (chi, tabella, dove = 'true') => (await q(chi, `select count(*)::int as n from public.${tabella} where ${dove}`))[0].n
async function vietato(chi, sql, p, contiene = '') {
  try {
    const r = await come(db, chi, (tx) => tx.query(sql, p))
    if (r.affectedRows === 0 && !contiene) return
  } catch (e) {
    if (contiene && !e.message.includes(contiene)) throw new Error(`errore diverso: "${e.message}"`)
    return
  }
  throw new Error('doveva essere vietato ma è riuscito: ' + sql)
}
const CIFRATO = 'v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB'
const altro = (await db.query(`select id from public.profiles where email = 'uno@demo.it'`)).rows[0].id

console.log('\nRegistrazioni')
await prova('Chi si registra da solo nasce disattivato e non legge nulla di interno', async () => {
  await db.exec(`insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999','intruso@x.it')`)
  eq((await db.query(`select attivo from public.profiles where email = 'intruso@x.it'`)).rows[0].attivo, false)
  await db.exec(`insert into public.prezzi (tipo, nome, prezzo) values ('sito', 'Listino interno', 500)`)
  eq(await conta('99999999-9999-9999-9999-999999999999', 'prezzi'), 0)
  eq((await conta(collab, 'prezzi')) > 0, true, 'il collaboratore vede ancora il listino')
})
await prova("Solo l'admin crea clienti, già attivi con ruolo cliente", async () => {
  await vietato(collab, `select public.admin_crea_cliente('X', 'x@x.it', 'password1')`, [], 'Solo un amministratore')
  await vietato(cliente, `select public.admin_crea_cliente('X', 'x@x.it', 'password1')`, [], 'Solo un amministratore')
  await q(admin, `select public.admin_crea_cliente('Nuovo', 'nuovo@x.it', 'password1')`)
  eq((await db.query(`select ruolo::text as r, attivo from public.profiles where email = 'nuovo@x.it'`)).rows[0], { r: 'cliente', attivo: true })
})

console.log('\nCosa vede un cliente')
await prova('Niente listino, progetti, opportunità, vendite, preventivi', async () => {
  await db.exec(`insert into public.opportunita (nome, maps_url) values ('Bar', 'https://maps.example/x')`)
  for (const t of ['prezzi', 'progetti', 'opportunita', 'vendite', 'ordini_siti', 'assegnazioni', 'pagamenti', 'richieste_contatto', 'cassaforte']) eq(await conta(cliente, t), 0, t)
})
await prova('Vede solo il proprio profilo e i propri siti', async () => {
  eq(await conta(cliente, 'profiles'), 1)
  eq((await q(cliente, `select nome from public.siti_cliente`)).map((r) => r.nome), ['Pizzeria Demo'])
})
await prova('Non può modificare ruolo, siti o aggiungere vendite', async () => {
  await vietato(cliente, `update public.profiles set ruolo = 'admin' where id = $1`, [cliente])
  await vietato(cliente, `insert into public.siti_cliente (cliente_id, nome) values ($1, 'Falso')`, [cliente])
  await vietato(cliente, `insert into public.opportunita (nome, maps_url) values ('x', 'https://x.it')`, [])
})

console.log('\nCassaforte')
await prova('Il database rifiuta dati in chiaro', async () => {
  await q(admin, `insert into public.cassaforte_clienti (cliente_id, sale, iterazioni, verifica, codice_cifrato) values ($1, 's', 600000, $2, $2)`, [cliente, CIFRATO])
  await vietato(admin, `insert into public.accessi_cliente (cliente_id, dati) values ($1, '{"password":"in chiaro"}')`, [cliente], 'accessi_cliente_dati_check')
  await q(admin, `insert into public.accessi_cliente (cliente_id, dati) values ($1, $2)`, [cliente, CIFRATO])
})
await prova('Il cliente legge i propri accessi ma non li modifica; altri non vedono nulla', async () => {
  eq(await conta(cliente, 'accessi_cliente'), 1)
  for (const chi of [altro, collab]) {
    eq(await conta(chi, 'accessi_cliente'), 0)
    eq(await conta(chi, 'cassaforte_clienti'), 0)
  }
  await vietato(null, `select * from public.accessi_cliente`, [], 'permission denied')
  await vietato(cliente, `update public.accessi_cliente set dati = $1`, [CIFRATO])
  await vietato(cliente, `delete from public.accessi_cliente`, [])
})

console.log('\nRecensioni')
const recensisci = `select public.lascia_recensione($1, $2, $3)`
await prova('Solo i clienti con un sito registrato', async () => {
  const senza = (await db.query(`select id from public.profiles where email = 'nuovo@x.it'`)).rows[0].id
  await vietato(senza, recensisci, [5, 'Ottimo lavoro davvero', 'Nuovo'], 'quando il tuo sito')
  await vietato(collab, recensisci, [5, 'Ottimo lavoro davvero', 'Marco'], 'Solo i clienti')
  await vietato(admin, recensisci, [5, 'Ottimo lavoro davvero', 'Io'], 'Solo i clienti')
  await vietato(null, recensisci, [5, 'Ottimo lavoro davvero', 'Anonimo'], 'permission denied')
})
await prova('Voto e testo controllati; una sola recensione per cliente (modificabile)', async () => {
  await vietato(cliente, recensisci, [6, 'Ottimo lavoro davvero', 'Giulia'], 'stelle')
  await vietato(cliente, recensisci, [5, 'corto', 'Giulia'], 'caratteri')
  await q(cliente, recensisci, [4, 'Buon lavoro, consiglio.', 'Giulia'])
  await q(cliente, recensisci, [5, 'Ottimo lavoro davvero.', 'Giulia R.'])
  eq((await q(cliente, `select stelle, firma, attivita from public.recensioni`)), [{ stelle: 5, firma: 'Giulia R.', attivita: 'Pizzeria Demo' }])
})
await prova("Nessuno scrive o corregge recensioni a mano, nemmeno l'admin", async () => {
  await vietato(cliente, `update public.recensioni set visibile = true`, [])
  await vietato(admin, `insert into public.recensioni (cliente_id, stelle, testo, firma) values ($1, 5, 'Recensione inventata', 'Finto')`, [altro], 'permission denied')
  await vietato(admin, `update public.recensioni set testo = 'testo cambiato'`, [], 'permission denied')
})
await prova('Una recensione nascosta resta nascosta anche se il cliente la modifica', async () => {
  const prima = await conta(null, 'recensioni_pubbliche')
  await q(admin, `update public.recensioni set visibile = false where cliente_id = $1`, [cliente])
  await q(cliente, recensisci, [5, 'Riprovo a pubblicarla.', 'Giulia'])
  eq(await conta(null, 'recensioni_pubbliche'), prima - 1)
})
await prova('I visitatori vedono solo i campi pubblici', async () => {
  await vietato(null, `select * from public.recensioni`, [], 'permission denied')
  eq(Object.keys((await q(null, `select * from public.recensioni_pubbliche limit 1`))[0]).sort(), ['attivita', 'created_at', 'firma', 'id', 'stelle', 'testo'])
})

console.log('\nTicket')
const apri = `select public.apri_ticket($1::jsonb) as r`
const dati = (x) => JSON.stringify({ nome: 'Anna', email: 'anna@x.it', messaggio: 'Vorrei informazioni sul sito.', ...x })
let pubblico
await prova('Un visitatore apre un ticket e lo legge solo con il link segreto', async () => {
  pubblico = (await q(null, apri, [dati({})]))[0].r
  const letto = (await q(null, `select public.leggi_ticket($1) as r`, [pubblico.token]))[0].r
  eq(letto.messaggi.length, 1)
  eq((await q(null, `select public.leggi_ticket(gen_random_uuid()) as r`))[0].r, null)
  await vietato(null, `select * from public.tickets`, [], 'permission denied')
  await vietato(null, `select * from public.ticket_messaggi`, [], 'permission denied')
})
await prova('Un visitatore non può collegarsi al sito di un cliente', async () => {
  const sito = (await db.query(`select id from public.siti_cliente where cliente_id = $1`, [cliente])).rows[0].id
  const t = (await q(null, apri, [dati({ email: 'b@x.it', sito_id: sito })]))[0].r
  eq((await db.query(`select cliente_id, collaboratore_id from public.tickets where id = $1`, [t.id])).rows[0], { cliente_id: null, collaboratore_id: null })
  await vietato(altro, apri, [dati({ sito_id: sito })], 'Sito non trovato')
})
await prova('Il ticket del cliente va al collaboratore del sito', async () => {
  const t = (await db.query(`select cliente_id, collaboratore_id, sito_nome from public.tickets where cliente_id = $1`, [cliente])).rows[0]
  eq(t, { cliente_id: cliente, collaboratore_id: collab, sito_nome: 'Pizzeria Demo' })
})
await prova('Admin vede tutti; collaboratore i suoi; cliente i propri; altri nulla', async () => {
  const tutti = (await db.query(`select count(*)::int as n from public.tickets`)).rows[0].n
  eq(await conta(admin, 'tickets'), tutti)
  eq(await conta(collab, 'tickets'), 1)
  eq(await conta(cliente, 'tickets'), 1)
  eq(await conta(altro, 'tickets'), 0)
  eq(await conta(altro, 'ticket_messaggi'), 0)
  eq((await conta(cliente, 'ticket_messaggi')) >= 1, true)
  await vietato(collab, `select public.rispondi_ticket($1, 'ciao')`, [pubblico.id], 'Ticket non trovato')
  await vietato(altro, `select public.rispondi_ticket($1, 'ciao')`, [pubblico.id], 'Ticket non trovato')
  await vietato(collab, `select public.imposta_stato_ticket($1, 'chiuso')`, [pubblico.id], 'permessi')
  await vietato(collab, `select public.assegna_ticket($1, $2)`, [pubblico.id, collab], 'Solo l')
})
await prova('Risposta dello staff: il visitatore vede «Forma Web», non il nome', async () => {
  await q(admin, `select public.rispondi_ticket($1, 'Buongiorno Anna!')`, [pubblico.id])
  const t = (await db.query(`select ultimo_autore, letto_richiedente_il < ultimo_messaggio_il as nuovo from public.tickets where id = $1`, [pubblico.id])).rows[0]
  eq(t, { ultimo_autore: 'staff', nuovo: true })
  eq((await q(null, `select public.leggi_ticket($1) as r`, [pubblico.token]))[0].r.messaggi.at(-1).autore_nome, 'Forma Web')
})
await prova('Rispondendo a un ticket chiuso si riapre; segna letto e assegnazione funzionano', async () => {
  await q(admin, `select public.imposta_stato_ticket($1, 'chiuso')`, [pubblico.id])
  await q(null, `select public.scrivi_ticket($1, 'Grazie, ho un dubbio')`, [pubblico.token])
  await q(admin, `select public.assegna_ticket($1, $2)`, [pubblico.id, collab])
  eq(await conta(collab, 'tickets'), 2)
  await q(collab, `select public.segna_letto_ticket($1)`, [pubblico.id])
  const t = (await db.query(`select stato, letto_collaboratore_il >= ultimo_messaggio_il as letto, letto_admin_il >= ultimo_messaggio_il as admin from public.tickets where id = $1`, [pubblico.id])).rows[0]
  eq(t, { stato: 'aperto', letto: true, admin: false })
})
await prova('Limiti: trappola anti-robot, troppi ticket, testi non validi', async () => {
  const prima = await conta(admin, 'tickets')
  await q(null, apri, [dati({ controllo: 'spam' })])
  eq(await conta(admin, 'tickets'), prima)
  await vietato(null, apri, [dati({ email: 'no' })], 'email valido')
  await vietato(null, apri, [dati({ messaggio: 'ciao' })], 'caratteri')
  for (let i = 0; i < 3; i++) await q(null, apri, [dati({ email: 'tanti@x.it' })])
  await vietato(null, apri, [dati({ email: 'tanti@x.it' })], 'Troppe richieste')
  await vietato(null, `select public._ticket_scrivi($1, 'staff', 'Finto', 'ciao')`, [pubblico.id], 'permission denied')
})
await prova('Lo script si può rieseguire', async () => {
  const prima = await conta(admin, 'tickets')
  await db.exec(readFileSync(new URL('../../supabase/clienti_recensioni.sql', import.meta.url), 'utf8'))
  eq(await conta(admin, 'tickets'), prima)
})

console.log(`\n${ok} test superati, ${falliti.length} falliti`)
if (falliti.length) process.exit(1)
