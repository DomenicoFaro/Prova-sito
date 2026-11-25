// Test delle notifiche push: cifratura (esempio ufficiale RFC 8291), permessi e funzione
// notifica-ticket eseguita sul database di prova. Nessuna notifica vera viene spedita.
// Esegui con:  npm run test:db
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, randomBytes, verify } from 'node:crypto'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { avviaBackend, come, PASSWORD_DEMO } from '../anteprima/backend.mjs'
import { cifraPush, daB64u, inB64u } from '../../supabase/functions/_shared/webpush.ts'

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

console.log('\nCifratura')
await prova('Identica all’esempio ufficiale della specifica (RFC 8291)', async () => {
  const pubblica = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'
  const p = daB64u(pubblica)
  const jwk = { kty: 'EC', crv: 'P-256', x: inB64u(p.slice(1, 33)), y: inB64u(p.slice(33)) }
  const parametri = { name: 'ECDH', namedCurve: 'P-256' }
  const mittente = {
    publicKey: await crypto.subtle.importKey('jwk', jwk, parametri, true, []),
    privateKey: await crypto.subtle.importKey('jwk', { ...jwk, d: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw' }, parametri, false, ['deriveBits']),
  }
  const corpo = await cifraPush(
    new TextEncoder().encode('When I grow up, I want to be a watermelon'),
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    'BTBZMqHH6r4Tts7J_aSIgg',
    { sale: daB64u('DGv6ra1nlYgDCS1FRnbzlw'), mittente },
  )
  eq(inB64u(corpo), 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN')
})

/* ---------- Funzione vera sul database di prova ---------- */

const PORTA = 54397
const backend = await avviaBackend(PORTA)
const { admin, collab, cliente } = backend.ids
const db = backend.db
const q = (chi, sql, p) => come(db, chi, async (tx) => (await tx.query(sql, p)).rows)

/** Un telefono finto: ha le sue chiavi e sa leggere le notifiche (con un'implementazione separata). */
function dispositivo(nome) {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const auth = randomBytes(16)
  return {
    endpoint: `https://web.push.apple.com/${nome}`,
    p256dh: ecdh.getPublicKey().toString('base64url'),
    auth: auth.toString('base64url'),
    leggi(corpo) {
      const sale = corpo.subarray(0, 16)
      const mittente = corpo.subarray(21, 21 + corpo[20])
      const cifrato = corpo.subarray(21 + corpo[20])
      const h = (s, ikm, info, n) => Buffer.from(hkdfSync('sha256', ikm, s, info, n))
      const ikm = h(auth, ecdh.computeSecret(mittente), Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), mittente]), 32)
      const d = createDecipheriv('aes-128-gcm', h(sale, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16), h(sale, ikm, Buffer.from('Content-Encoding: nonce\0'), 12))
      d.setAuthTag(cifrato.subarray(-16))
      const chiaro = Buffer.concat([d.update(cifrato.subarray(0, -16)), d.final()])
      return JSON.parse(chiaro.subarray(0, -1).toString())
    },
  }
}
const tel = { admin: dispositivo('admin'), collab: dispositivo('collab'), cliente: dispositivo('cliente') }

let ricevute = []
const risposte = {}
const rete = globalThis.fetch
globalThis.fetch = async (url, opzioni) => {
  if (!String(url).startsWith('https://web.push.apple.com/')) return rete(url, opzioni)
  const chi = String(url).split('/').pop()
  ricevute.push({ chi, intestazioni: opzioni.headers, dati: tel[chi].leggi(Buffer.from(opzioni.body)) })
  return new Response('', { status: risposte[chi] ?? 201 })
}

const jwt = (o) => 'x.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.y'
const env = { SUPABASE_URL: `http://127.0.0.1:${PORTA}`, SUPABASE_SERVICE_ROLE_KEY: jwt({ role: 'service_role' }), SUPABASE_ANON_KEY: 'anon' }
let gestore
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (f) => (gestore = f) }

const cartella = mkdtempSync(join(tmpdir(), 'fw-push-'))
const funzioni = fileURLToPath(new URL('../../supabase/functions', import.meta.url))
cpSync(join(funzioni, '_shared'), join(cartella, '_shared'), { recursive: true })
cpSync(join(funzioni, 'notifica-ticket'), join(cartella, 'notifica-ticket'), { recursive: true })
writeFileSync(join(cartella, 'package.json'), '{"type":"module"}')
const file = join(cartella, 'notifica-ticket', 'index.ts')
writeFileSync(file, readFileSync(file, 'utf8').replace("'https://esm.sh/@supabase/supabase-js@2'", `'${import.meta.resolve('@supabase/supabase-js')}'`))
await import(pathToFileURL(file).href)

async function chiama(azione, token) {
  ricevute = []
  const r = await gestore(new Request('http://x/', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify({ azione }) }))
  return { stato: r.status, corpo: await r.json() }
}
const chi = () => ricevute.map((r) => r.chi).sort()
const iscrivi = (utente, d) => q(utente, `select public.salva_push($1, $2, $3, 'telefono di prova')`, [d.endpoint, d.p256dh, d.auth])
async function vietato(utente, sql, p, contiene) {
  try {
    await come(db, utente, (tx) => tx.query(sql, p))
  } catch (e) {
    if (!e.message.includes(contiene)) throw new Error(`errore diverso: "${e.message}"`)
    return
  }
  throw new Error('doveva essere vietato: ' + sql)
}

console.log('\nPermessi')
await prova('Solo chi è collegato iscrive un dispositivo, e solo verso i veri servizi push', async () => {
  await vietato(null, `select public.salva_push($1, $2, $3)`, [tel.admin.endpoint, tel.admin.p256dh, tel.admin.auth], 'permission denied')
  await vietato(admin, `select public.salva_push('https://sito-cattivo.example/x', $1, $2)`, [tel.admin.p256dh, tel.admin.auth], 'check')
  await vietato(admin, `select public.salva_push('https://web.push.apple.com.cattivo.example/x', $1, $2)`, [tel.admin.p256dh, tel.admin.auth], 'check')
  await iscrivi(admin, tel.admin)
  await iscrivi(collab, tel.collab)
  await iscrivi(cliente, tel.cliente)
  eq((await q(collab, `select endpoint from public.push_iscrizioni`)).map((r) => r.endpoint), [tel.collab.endpoint])
})
await prova('Le chiavi del server non le legge nessuno dal sito', async () => {
  for (const u of [null, admin, collab, cliente]) await vietato(u, `select * from public.push_chiavi`, [], 'permission denied')
})

console.log('\nFunzione notifica-ticket')
await prova('La chiave si crea da sola una volta e resta la stessa', async () => {
  const a = (await chiama('chiave')).corpo.chiave
  eq((await chiama('chiave')).corpo.chiave, a)
  eq(daB64u(a).length, 65)
  eq((await db.query('select count(*)::int as n from public.push_chiavi')).rows[0].n, 1)
})
await prova('I messaggi di esempio si avvisano una volta sola', async () => {
  eq((await chiama('invia')).stato, 200)
  await chiama('invia')
  eq(chi(), [])
})
let pubblico
await prova('Ticket di un visitatore: avvisa solo l’admin, con testo e indirizzo del ticket', async () => {
  pubblico = (await q(null, `select public.apri_ticket($1::jsonb) as r`, [JSON.stringify({ nome: 'Anna', email: 'a@x.it', messaggio: 'Vorrei un sito per il mio forno.' })]))[0].r
  await chiama('invia')
  eq(chi(), ['admin'])
  eq(ricevute[0].dati, { titolo: `Ticket n. ${pubblico.numero} – Anna`, testo: 'Vorrei un sito per il mio forno.', url: `/area/ticket/${pubblico.id}`, tag: pubblico.id })
})
await prova('La firma del mittente è valida (VAPID)', async () => {
  const [, t, k] = ricevute[0].intestazioni.Authorization.match(/^vapid t=([^,]+), k=(.+)$/)
  const [testa, corpo, firma] = t.split('.')
  const p = daB64u(k)
  const chiave = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: inB64u(p.slice(1, 33)), y: inB64u(p.slice(33)) }, format: 'jwk' })
  eq(verify('sha256', Buffer.from(`${testa}.${corpo}`), { key: chiave, dsaEncoding: 'ieee-p1363' }, Buffer.from(firma, 'base64url')), true)
  const dati = JSON.parse(Buffer.from(corpo, 'base64url'))
  eq([dati.aud, dati.sub, dati.exp > Date.now() / 1000], ['https://web.push.apple.com', 'https://formaweb.shop', true])
  eq(ricevute[0].intestazioni['Content-Encoding'], 'aes128gcm')
})
let delCliente
await prova('Ticket di un cliente: avvisa admin e collaboratore del sito, non il cliente', async () => {
  delCliente = (await q(cliente, `select public.apri_ticket($1::jsonb) as r`, [JSON.stringify({ messaggio: 'Si può cambiare la foto in alto?' })]))[0].r
  await chiama('invia')
  eq(chi(), ['admin', 'collab'])
})
await prova('Risposta del collaboratore: avvisa solo il cliente', async () => {
  await q(collab, `select public.rispondi_ticket($1, 'Certo, la cambiamo oggi.')`, [delCliente.id])
  await chiama('invia')
  eq(chi(), ['cliente'])
  eq(ricevute[0].dati.titolo, 'Forma Web ti ha risposto')
})
await prova('Più messaggi di fila: una notifica sola con l’ultimo', async () => {
  await q(null, `select public.scrivi_ticket($1, 'primo')`, [pubblico.token])
  await q(null, `select public.scrivi_ticket($1, 'secondo')`, [pubblico.token])
  await chiama('invia')
  eq(ricevute.map((r) => r.dati.testo), ['secondo'])
})
await prova('Assegnando un ticket il collaboratore viene avvisato', async () => {
  await q(admin, `select public.assegna_ticket($1, $2)`, [pubblico.id, collab])
  await chiama('invia')
  eq(chi(), ['collab'])
  eq(ricevute[0].dati.titolo, `Ti hanno assegnato il ticket n. ${pubblico.numero}`)
})
await prova('Un account disattivato non riceve nulla', async () => {
  await db.query(`update public.profiles set attivo = false where id = $1`, [collab])
  await q(null, `select public.scrivi_ticket($1, 'ci siete?')`, [pubblico.token])
  await chiama('invia')
  eq(chi(), ['admin'])
  await db.query(`update public.profiles set attivo = true where id = $1`, [collab])
})
await prova('La prova arriva solo a chi la chiede; senza accesso è rifiutata', async () => {
  const sessione = await (await rete(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', body: JSON.stringify({ email: 'collab@demo.it', password: PASSWORD_DEMO }) })).json()
  const r = await chiama('prova', sessione.access_token)
  eq([r.stato, r.corpo.inviate, chi()], [200, 1, ['collab']])
  eq((await chiama('prova')).stato, 401)
})
await prova('Un dispositivo non più valido viene dimenticato', async () => {
  risposte.admin = 410
  await q(null, `select public.scrivi_ticket($1, 'ancora io')`, [pubblico.token])
  await chiama('invia')
  eq((await db.query(`select count(*)::int as n from public.push_iscrizioni where utente_id = $1`, [admin])).rows[0].n, 0)
})

backend.chiudi()
console.log(`\n${ok} test superati, ${falliti.length} falliti`)
process.exit(falliti.length ? 1 : 0)
