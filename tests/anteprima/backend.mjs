// «Supabase finto» sul computer: database in memoria con gli script SQL VERI (permessi compresi)
// e il minimo di API che serve al sito. Dati inventati, nessun collegamento al database reale.
// Serve all'anteprima (npm run anteprima) e ai test nel browser.
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { creaDb } from '../db/setup.mjs'

const sql = (f) => readFileSync(new URL(`../../supabase/${f}`, import.meta.url), 'utf8')

// Parti di Supabase che gli script degli account si aspettano
const STUB_ACCOUNT = `
alter table auth.users
  add column instance_id uuid, add column aud text, add column role text, add column email_confirmed_at timestamptz,
  add column raw_app_meta_data jsonb, add column created_at timestamptz default now(), add column updated_at timestamptz,
  add column confirmation_token text, add column recovery_token text, add column email_change text,
  add column email_change_token_new text, add column email_change_token_current text, add column phone_change text,
  add column phone_change_token text, add column reauthentication_token text;
create table auth.identities (id uuid primary key, user_id uuid, provider_id text, identity_data jsonb, provider text,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
create schema if not exists extensions;
create or replace function extensions.gen_salt(text) returns text language sql as $$ select 'sale' $$;
create or replace function extensions.crypt(p text, s text) returns text language sql immutable as $$ select 'demo:' || p $$;
`

export async function preparaDb() {
  const { db } = await creaDb()
  await db.exec(STUB_ACCOUNT)
  await db.exec(sql('rimuovi_soci.sql'))
  await db.exec(sql('clienti_recensioni.sql'))
  await db.exec(sql('notifiche_push.sql'))
  return db
}

export const PASSWORD_DEMO = 'demo1234'

/** Esegue `fn` come visitatore (sub vuoto), come server ('service') o come utente collegato. */
export function come(db, sub, fn) {
  return db.transaction(async (tx) => {
    const server = sub === 'service'
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [server ? '' : (sub ?? '')])
    await tx.exec(`set local role ${server ? 'service_role' : sub ? 'authenticated' : 'anon'}`)
    return fn(tx)
  })
}

export async function datiDemo(db) {
  const crea = async (email, nome, ruolo) => {
    const id = (await db.query(`select public._crea_utente_auth($1, $2, $3) as id`, [email, PASSWORD_DEMO, nome])).rows[0].id
    await db.query(`update public.profiles set nome = $2, ruolo = $3, attivo = true where id = $1`, [id, nome, ruolo])
    return id
  }
  const admin = await crea('admin@demo.it', 'Titolare Demo', 'admin')
  const collab = await crea('collab@demo.it', 'Marco Demo', 'collaboratore')
  const cliente = await crea('cliente@demo.it', 'Giulia Demo', 'cliente')

  for (const [nome, url, categoria] of [
    ['VogliaDiParrucchieri', 'https://vogliadiparrucchieri.shop', 'Beauty'],
    ['Café Sauvage', 'https://cafésauvage.com', 'Ristorazione'],
    ['Il Sogno della Bellezza', 'https://ilsognodellabellezza.vercel.app', 'Beauty'],
    ['Pizzeria 3D', 'https://pizzeria3d.vercel.app', 'Ristorazione'],
  ]) {
    await db.query(`insert into public.progetti (nome, cliente, url, categoria, pubblico) values ($1, $1, $2, $3, true)`, [nome, url, categoria])
  }

  const sito = async (id, nome, url) =>
    db.query(`insert into public.siti_cliente (cliente_id, nome, url, collaboratore_id) values ($1, $2, $3, $4)`, [id, nome, url, collab])
  await sito(cliente, 'Pizzeria Demo', 'https://pizzeria3d.vercel.app')

  const recensioni = [
    ['uno@demo.it', 'Cliente demo A', 'Salone Demo', 5, 'Testo di esempio: il sito è pronto in pochi giorni e i clienti prenotano dal telefono.'],
    ['due@demo.it', 'Cliente demo B', 'Caffè Demo', 5, 'Testo di esempio: molto più chiaro di prima, il menù lo aggiorno da solo.'],
    ['tre@demo.it', 'Cliente demo C', 'Negozio Demo', 4, 'Testo di esempio: assistenza veloce, le risposte arrivano in chat.'],
    ['quattro@demo.it', 'Cliente demo D', 'Barbiere Demo', 5, 'Testo di esempio: prenotazioni ordinate e niente più telefonate durante il lavoro.'],
  ]
  for (const [email, nome, attivita, stelle, testo] of recensioni) {
    const id = await crea(email, nome, 'cliente')
    await sito(id, attivita, '')
    await come(db, id, (tx) => tx.query(`select public.lascia_recensione($1, $2, $3)`, [stelle, testo, nome]))
  }

  await come(db, null, (tx) =>
    tx.query(`select public.apri_ticket($1::jsonb)`, [
      JSON.stringify({ nome: 'Visitatore Demo', email: 'visitatore@demo.it', messaggio: 'Buongiorno, vorrei un sito per la mia officina. Quanto tempo serve?' }),
    ]),
  )
  await come(db, cliente, (tx) =>
    tx.query(`select public.apri_ticket($1::jsonb)`, [JSON.stringify({ oggetto: 'Cambiare gli orari', messaggio: 'Da lunedì chiudiamo alle 23: potete aggiornare il sito?' })]),
  )
  return { admin, collab, cliente }
}

/* ---------- API ---------- */

const nome = (v) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(v)) throw Object.assign(new Error(`nome non valido: ${v}`), { code: '42601' })
  return `"${v}"`
}
const OPERATORI = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }
const RISERVATI = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

function filtri(query, parametri) {
  const parti = []
  for (const [col, valore] of query) {
    if (RISERVATI.has(col)) continue
    const punto = valore.indexOf('.')
    const op = valore.slice(0, punto)
    const v = valore.slice(punto + 1)
    if (OPERATORI[op]) parti.push(`t.${nome(col)} ${OPERATORI[op]} $${parametri.push(v)}`)
    else if (op === 'is') parti.push(`t.${nome(col)} is ${v === 'null' ? 'null' : v === 'true' ? 'true' : 'false'}`)
    else if (op === 'in') {
      const valori = v.slice(1, -1).split(',').map((x) => x.replace(/^"|"$/g, ''))
      parti.push(`t.${nome(col)}::text in (${valori.map((x) => `$${parametri.push(x)}`).join(',')})`)
    } else throw Object.assign(new Error(`filtro non gestito: ${op}`), { code: '42601' })
  }
  return parti.length ? ` where ${parti.join(' and ')}` : ''
}

async function tabella(tx, metodo, tab, query, corpo, preferenze) {
  const t = `public.${nome(tab)}`
  const p = []
  const ritorna = /return=representation/.test(preferenze)
  if (metodo === 'GET' || metodo === 'HEAD') {
    const colonne = (query.get('select') ?? '*').replace(/\w+\([^)]*\),?/g, '').split(',').map((c) => c.trim()).filter(Boolean)
    const scelte = colonne.map((c) => (c === '*' ? 't.*' : `t.${nome(c)}`)).join(', ')
    const dove = filtri(query, p)
    const ordine = (query.get('order') ?? '').split(',').filter(Boolean).map((o) => {
      const [col, verso] = o.split('.')
      return `t.${nome(col)} ${verso === 'desc' ? 'desc' : 'asc'}`
    })
    const limite = Number(query.get('limit')) || 1000
    const r = await tx.query(
      `select coalesce(json_agg(r), '[]') as j from (select ${scelte} from ${t} t${dove}${ordine.length ? ` order by ${ordine.join(', ')}` : ''} limit ${limite}) r`,
      p,
    )
    return r.rows[0].j
  }
  const esegui = async (comando) => {
    if (!ritorna) return (await tx.query(comando, p), null)
    return (await tx.query(`with r as (${comando} returning t.*) select coalesce(json_agg(r), '[]') as j from r`, p)).rows[0].j
  }
  if (metodo === 'POST') {
    const righe = Array.isArray(corpo) ? corpo : [corpo]
    const colonne = [...new Set(righe.flatMap((r) => Object.keys(r)))]
    const elenco = colonne.map(nome).join(', ')
    p.push(JSON.stringify(righe))
    let conflitto = ''
    if (/merge-duplicates/.test(preferenze)) {
      const chiavi = (
        await tx.query(`select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) where i.indrelid = '${t}'::regclass and i.indisprimary`)
      ).rows.map((r) => r.attname)
      conflitto = ` on conflict (${(query.get('on_conflict')?.split(',') ?? chiavi).map(nome).join(', ')}) do update set ${colonne.map((c) => `${nome(c)} = excluded.${nome(c)}`).join(', ')}`
    }
    return esegui(`insert into ${t} as t (${elenco}) select ${elenco} from json_populate_recordset(null::${t}, $1::json)${conflitto}`)
  }
  if (metodo === 'PATCH') {
    const colonne = Object.keys(corpo)
    p.push(JSON.stringify(corpo))
    const assegna = colonne.map((c) => `${nome(c)} = (json_populate_record(null::${t}, $1::json)).${nome(c)}`).join(', ')
    const dove = filtri(query, p)
    if (!dove) throw Object.assign(new Error('UPDATE senza filtro'), { code: '21000' })
    return esegui(`update ${t} as t set ${assegna}${dove}`)
  }
  if (metodo === 'DELETE') {
    const dove = filtri(query, p)
    if (!dove) throw Object.assign(new Error('DELETE senza filtro'), { code: '21000' })
    return esegui(`delete from ${t} as t${dove}`)
  }
  throw new Error('metodo non gestito')
}

async function funzione(db, tx, fn, argomenti) {
  const info = (
    await db.query(
      `select proretset, prorettype::regtype::text as tipo, proargnames, array(select format_type(x, null) from unnest(proargtypes) x) as tipi
         from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace`,
      [fn],
    )
  ).rows
  const chiavi = Object.keys(argomenti)
  const f = info.find((i) => chiavi.every((k) => (i.proargnames ?? []).includes(k)))
  if (!f) throw Object.assign(new Error(`funzione non trovata: ${fn}`), { code: 'PGRST202' })
  const p = []
  const lista = chiavi.map((k) => {
    const tipo = f.tipi[f.proargnames.indexOf(k)]
    const v = argomenti[k]
    p.push(v === null ? null : typeof v === 'object' ? JSON.stringify(v) : String(v))
    return `${nome(k)} => ($${p.length}::text)::${tipo}`
  })
  const chiamata = `public.${nome(fn)}(${lista.join(', ')})`
  if (f.proretset) return (await tx.query(`select coalesce(json_agg(x), '[]') as j from ${chiamata} x`, p)).rows[0].j
  if (f.tipo === 'void') return (await tx.query(`select ${chiamata}`, p), null)
  return (await tx.query(`select to_json(${chiamata}) as j`, p)).rows[0].j
}

const jwt = (o) => 'x.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.y'
const idDa = (autorizzazione) => {
  try {
    const { sub, role } = JSON.parse(Buffer.from(autorizzazione.split(' ')[1].split('.')[1], 'base64url').toString())
    if (role === 'service_role') return 'service'
    return /^[0-9a-f-]{36}$/i.test(sub) ? sub : null
  } catch {
    return null
  }
}

export async function avviaBackend(porta, { demo = true } = {}) {
  const db = await preparaDb()
  const ids = demo ? await datiDemo(db) : null

  const utente = async (id) => {
    const u = (await db.query(`select id, email from auth.users where id = $1`, [id])).rows[0]
    return u && { id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  }
  const sessione = async (id) => ({
    access_token: jwt({ sub: id, exp: 4102444800, role: 'authenticated' }),
    token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: id, user: await utente(id),
  })

  const server = createServer(async (req, res) => {
    const intestazioni = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': req.headers['access-control-request-headers'] ?? 'authorization,apikey,content-type',
    }
    const rispondi = (stato, corpo) => {
      res.writeHead(stato, { ...intestazioni, 'content-type': 'application/json' })
      res.end(corpo === undefined || stato === 204 ? undefined : JSON.stringify(corpo))
    }
    try {
      if (req.method === 'OPTIONS') return rispondi(204)
      const url = new URL(req.url, 'http://localhost')
      let testo = ''
      for await (const pezzo of req) testo += pezzo
      const corpo = testo ? JSON.parse(testo) : undefined
      const chi = idDa(req.headers.authorization ?? '')

      if (url.pathname === '/auth/v1/token') {
        let id = corpo?.refresh_token
        if (url.searchParams.get('grant_type') === 'password') {
          id = (await db.query(`select id from auth.users where lower(email) = lower($1) and encrypted_password = 'demo:' || $2`, [corpo.email, corpo.password])).rows[0]?.id
        }
        if (!id) return rispondi(400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' })
        return rispondi(200, await sessione(id))
      }
      if (url.pathname === '/auth/v1/user') {
        if (!chi) return rispondi(401, { msg: 'Non collegato' })
        if (req.method === 'PUT' && corpo?.password) await db.query(`update auth.users set encrypted_password = 'demo:' || $2 where id = $1`, [chi, corpo.password])
        return rispondi(200, await utente(chi))
      }
      if (url.pathname === '/auth/v1/logout') return rispondi(204)
      // Le funzioni sul server nell'anteprima non spediscono nulla (le notifiche si provano online)
      if (url.pathname === '/functions/v1/notifica-ticket' && corpo?.azione === 'chiave') return rispondi(200, { chiave: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8' })
      if (url.pathname.startsWith('/functions/v1/')) return rispondi(200, { ok: true })

      const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/)
      if (rpc) {
        const r = await come(db, chi, (tx) => funzione(tx, tx, rpc[1], corpo ?? {}))
        return rispondi(200, r)
      }
      const tab = url.pathname.match(/^\/rest\/v1\/(\w+)$/)
      if (tab) {
        const r = await come(db, chi, (tx) => tabella(tx, req.method, tab[1], url.searchParams, corpo, req.headers.prefer ?? ''))
        if (r !== null && (req.headers.accept ?? '').includes('pgrst.object')) {
          return r.length === 1 ? rispondi(200, r[0]) : rispondi(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' })
        }
        return rispondi(r === null ? 201 : 200, r ?? undefined)
      }
      return rispondi(404, { message: 'non trovato' })
    } catch (e) {
      return rispondi(e.code === '42501' ? 403 : 400, { code: e.code ?? '', message: e.message })
    }
  })
  await new Promise((ok, no) => server.once('error', no).listen(porta, '127.0.0.1', ok))
  return { db, ids, chiudi: () => server.close() }
}
