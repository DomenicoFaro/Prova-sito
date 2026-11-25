// Test di supabase/rimuovi_soci.sql: nessun socio, un solo team, nessun dato cancellato.
// Esegui con:  npm run test:db
import { readFileSync } from 'node:fs'
import { creaDb } from './setup.mjs'

const { db } = await creaDb()
const script = readFileSync(new URL('../../supabase/rimuovi_soci.sql', import.meta.url), 'utf8')

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
const righe = async (sql) => (await db.query(sql)).rows
const comeUtente = (id) => db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`)
const comeSuper = () => db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);`)

const ADMIN = '11111111-1111-1111-1111-111111111111'
const SOCIO = '33333333-3333-3333-3333-333333333333'
const COLLAB = '22222222-2222-2222-2222-222222222222'
await db.exec(`
  insert into auth.users (id, email) values ('${ADMIN}','admin@x.it'), ('${SOCIO}','socio@x.it'), ('${COLLAB}','collab@x.it');
  update public.profiles set ruolo = 'admin' where id = '${ADMIN}';
  update public.profiles set ruolo = 'socio' where id = '${SOCIO}';
  update public.profiles set responsabile_id = '${SOCIO}' where id = '${COLLAB}';
  insert into public.progetti (nome, cliente, prezzo_totale, gestore_id) values ('Del socio', 'C', 500, '${SOCIO}');
  insert into public.opportunita (nome, maps_url, team_id, creato_da) values ('Bar', 'https://maps.example/x', '${SOCIO}', '${SOCIO}');
`)

console.log('\nRimozione del ruolo Socio (rimuovi_soci.sql)')
await prova('Prima: il socio vede il progetto del suo team', async () => {
  await comeUtente(SOCIO)
  eq((await righe('select nome from public.progetti')).length, 1)
})
await prova('Lo script si esegue, anche due volte', async () => {
  await comeSuper()
  await db.exec(script)
  await db.exec(script)
})
await prova("L'ex socio diventa collaboratore e non vede più progetti né altri profili", async () => {
  await comeUtente(SOCIO)
  eq((await righe('select ruolo::text as r from public.profiles')).map((x) => x.r), ['collaboratore'])
  eq((await righe('select id from public.progetti')).length, 0)
})
await prova('Nessun dato cancellato: account e progetto restano', async () => {
  await comeSuper()
  eq((await righe('select count(*)::int as n from public.profiles'))[0].n, 3)
  eq((await righe(`select count(*)::int as n from public.progetti where nome = 'Del socio'`))[0].n, 1)
})
await prova("Il collaboratore passa nell'unico team e vede l'opportunità", async () => {
  await comeUtente(COLLAB)
  eq((await righe('select nome from public.opportunita')).map((x) => x.nome), ['Bar'])
})
await prova('Nessuno può più diventare socio', async () => {
  await comeUtente(ADMIN)
  let errore = ''
  try {
    await db.query(`update public.profiles set ruolo = 'socio' where id = '${COLLAB}'`)
  } catch (e) {
    errore = e.message
  }
  if (!errore.includes('profiles_niente_soci')) throw new Error(`atteso il vincolo, ottenuto "${errore}"`)
})
await prova("L'admin vede ancora tutto", async () => {
  await comeUtente(ADMIN)
  eq((await righe('select count(*)::int as n from public.profiles'))[0].n, 3)
  eq((await righe('select count(*)::int as n from public.progetti'))[0].n >= 1, true)
})

console.log(`\n${ok} test superati, ${falliti.length} falliti`)
if (falliti.length) process.exit(1)
