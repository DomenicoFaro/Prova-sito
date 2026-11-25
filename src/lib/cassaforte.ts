// Cassaforte degli accessi: tutto viene cifrato e decifrato nel browser (AES-GCM).
// Il database riceve solo testo cifrato (vedi supabase/clienti_recensioni.sql).
import { supabase } from './supabase'
import type { Accesso, DatiAccesso } from './types'

const ITERAZIONI = 600_000
/** 32 caratteri senza quelli che si confondono (0/O, 1/I) */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export interface RigaCassaforte {
  sale: string
  iterazioni: number
  verifica: string
}
export interface RigaCassaforteCliente extends RigaCassaforte {
  cliente_id: string
  codice_cifrato: string
}

const inBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const daBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const casuali = (n: number) => crypto.getRandomValues(new Uint8Array(n))
const testoInByte = (s: string) => new TextEncoder().encode(s)

async function derivaChiave(segreto: string, sale: string, iterazioni: number) {
  const base = await crypto.subtle.importKey('raw', testoInByte(segreto), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: daBase64(sale), iterations: iterazioni, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** `contesto` lega il testo cifrato al suo posto: non si può spostare da un cliente a un altro. */
async function cifra(chiave: CryptoKey, testo: string, contesto: string) {
  const iv = casuali(12)
  const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: testoInByte(contesto) }, chiave, testoInByte(testo))
  return `v1.${inBase64(iv)}.${inBase64(new Uint8Array(c))}`
}

async function decifra(chiave: CryptoKey, pacchetto: string, contesto: string) {
  const [, iv, c] = pacchetto.split('.')
  const chiaro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: daBase64(iv), additionalData: testoInByte(contesto) }, chiave, daBase64(c))
  return new TextDecoder().decode(chiaro)
}

async function apri(segreto: string, riga: RigaCassaforte, contesto: string, errore: string) {
  const chiave = await derivaChiave(segreto, riga.sale, riga.iterazioni)
  try {
    await decifra(chiave, riga.verifica, contesto)
  } catch {
    throw new Error(errore)
  }
  return chiave
}

async function nuovaSerratura(segreto: string, contesto: string) {
  const sale = inBase64(casuali(16))
  const chiave = await derivaChiave(segreto, sale, ITERAZIONI)
  return { chiave, riga: { sale, iterazioni: ITERAZIONI, verifica: await cifra(chiave, 'ok', contesto) } }
}

/* ---------- Password principale (admin) ---------- */

// La chiave resta solo in memoria: si perde ricaricando la pagina o uscendo.
let chiaveAdmin: CryptoKey | null = null
export const chiaveAdminAperta = () => chiaveAdmin
export const chiudiCassaforte = () => {
  chiaveAdmin = null
}

export async function leggiCassaforte() {
  const { data, error } = await supabase.from('cassaforte').select('sale, iterazioni, verifica').eq('id', 1).maybeSingle()
  if (error) throw error
  return data as RigaCassaforte | null
}

export async function creaCassaforte(password: string) {
  const { chiave, riga } = await nuovaSerratura(password, 'cassaforte')
  const { error } = await supabase.from('cassaforte').insert({ id: 1, ...riga })
  if (error) throw error
  return (chiaveAdmin = chiave)
}

export async function apriCassaforte(password: string, riga: RigaCassaforte) {
  return (chiaveAdmin = await apri(password, riga, 'cassaforte', 'Password principale errata.'))
}

/* ---------- Cassaforte del cliente ---------- */

const pulisciCodice = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '')

function nuovoCodice() {
  // 256 è multiplo di 32: ogni carattere ha la stessa probabilità
  const lettere = Array.from(casuali(20), (n) => ALFABETO[n % ALFABETO.length]).join('')
  return lettere.match(/.{5}/g)!.join('-')
}

export async function leggiCassaforteCliente(clienteId: string) {
  const { data, error } = await supabase.from('cassaforte_clienti').select('*').eq('cliente_id', clienteId).maybeSingle()
  if (error) throw error
  return data as RigaCassaforteCliente | null
}

export async function creaCassaforteCliente(clienteId: string, admin: CryptoKey) {
  const codice = nuovoCodice()
  const { riga } = await nuovaSerratura(pulisciCodice(codice), `verifica:${clienteId}`)
  const { error } = await supabase
    .from('cassaforte_clienti')
    .insert({ cliente_id: clienteId, ...riga, codice_cifrato: await cifra(admin, codice, `codice:${clienteId}`) })
  if (error) throw error
}

export const apriComeCliente = (codice: string, riga: RigaCassaforteCliente) =>
  apri(pulisciCodice(codice), riga, `verifica:${riga.cliente_id}`, 'Codice errato.')

/** L'admin recupera il codice del cliente con la password principale e apre la sua cassaforte. */
export async function apriComeAdmin(riga: RigaCassaforteCliente, admin: CryptoKey) {
  const codice = await decifra(admin, riga.codice_cifrato, `codice:${riga.cliente_id}`)
  return { codice, chiave: await apriComeCliente(codice, riga) }
}

/* ---------- Accessi ---------- */

export async function leggiAccessi(clienteId: string, chiave: CryptoKey): Promise<Accesso[]> {
  const { data, error } = await supabase.from('accessi_cliente').select('id, dati').eq('cliente_id', clienteId).order('created_at')
  if (error) throw error
  return Promise.all(
    (data as { id: string; dati: string }[]).map(async (r) => ({
      id: r.id,
      ...(JSON.parse(await decifra(chiave, r.dati, `accesso:${clienteId}`)) as DatiAccesso),
    })),
  )
}

export async function salvaAccesso(clienteId: string, chiave: CryptoKey, dati: DatiAccesso, id?: string) {
  const cifrati = await cifra(chiave, JSON.stringify(dati), `accesso:${clienteId}`)
  const { error } = id
    ? await supabase.from('accessi_cliente').update({ dati: cifrati, updated_at: new Date().toISOString() }).eq('id', id)
    : await supabase.from('accessi_cliente').insert({ cliente_id: clienteId, dati: cifrati })
  if (error) throw error
}

export async function eliminaAccesso(id: string) {
  const { error } = await supabase.from('accessi_cliente').delete().eq('id', id)
  if (error) throw error
}
