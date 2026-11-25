// Notifiche push per browser e telefoni (Web Push), senza librerie esterne.
// Cifratura del messaggio: RFC 8291 (aes128gcm). Firma del mittente: VAPID, RFC 8292.

const testoInByte = (s: string) => new TextEncoder().encode(s)

export const inB64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const daB64u = (s: string) => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b + '='.repeat((4 - (b.length % 4)) % 4)), (c) => c.charCodeAt(0))
}

function unisci(...parti: Uint8Array[]) {
  const tutto = new Uint8Array(parti.reduce((n, p) => n + p.length, 0))
  let i = 0
  for (const p of parti) {
    tutto.set(p, i)
    i += p.length
  }
  return tutto
}

async function hkdf(sale: Uint8Array, segreto: Uint8Array, info: Uint8Array, byte: number) {
  const chiave = await crypto.subtle.importKey('raw', segreto, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sale, info }, chiave, byte * 8))
}

const ECDH = { name: 'ECDH', namedCurve: 'P-256' }

/** Cifra il messaggio per un dispositivo. `fisse` serve solo ai test (valori dell'esempio RFC). */
export async function cifraPush(
  messaggio: Uint8Array,
  p256dh: string,
  auth: string,
  fisse?: { sale: Uint8Array; mittente: CryptoKeyPair },
) {
  const destinatario = daB64u(p256dh)
  const sale = fisse?.sale ?? crypto.getRandomValues(new Uint8Array(16))
  const mittente = fisse?.mittente ?? ((await crypto.subtle.generateKey(ECDH, true, ['deriveBits'])) as CryptoKeyPair)
  const pubblicaMittente = new Uint8Array(await crypto.subtle.exportKey('raw', mittente.publicKey))
  const pubblicaDestinatario = await crypto.subtle.importKey('raw', destinatario, ECDH, false, [])
  const comune = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: pubblicaDestinatario }, mittente.privateKey, 256))

  const ikm = await hkdf(daB64u(auth), comune, unisci(testoInByte('WebPush: info\0'), destinatario, pubblicaMittente), 32)
  const chiave = await hkdf(sale, ikm, testoInByte('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(sale, ikm, testoInByte('Content-Encoding: nonce\0'), 12)

  const aes = await crypto.subtle.importKey('raw', chiave, 'AES-GCM', false, ['encrypt'])
  // Il byte 2 chiude l'unico blocco del messaggio
  const cifrato = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, unisci(messaggio, new Uint8Array([2]))))
  // Intestazione: sale, dimensione del blocco (4096), chiave pubblica del mittente
  return unisci(sale, new Uint8Array([0, 0, 16, 0, pubblicaMittente.length]), pubblicaMittente, cifrato)
}

export interface ChiaviVapid {
  pubblica: string
  privata: JsonWebKey
}

export async function generaChiaviVapid(): Promise<ChiaviVapid> {
  const k = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  return {
    pubblica: inB64u(new Uint8Array(await crypto.subtle.exportKey('raw', k.publicKey))),
    privata: await crypto.subtle.exportKey('jwk', k.privateKey),
  }
}

/** Intestazione Authorization che dice al servizio push chi sta inviando. */
async function firmaVapid(indirizzo: string, chiavi: ChiaviVapid, contatto: string) {
  const parte = (o: unknown) => inB64u(testoInByte(JSON.stringify(o)))
  const corpo = `${parte({ typ: 'JWT', alg: 'ES256' })}.${parte({
    aud: new URL(indirizzo).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: contatto,
  })}`
  const chiave = await crypto.subtle.importKey('jwk', chiavi.privata, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const firma = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, chiave, testoInByte(corpo)))
  return `vapid t=${corpo}.${inB64u(firma)}, k=${chiavi.pubblica}`
}

/** Servizi push di Apple, Google, Mozilla e Microsoft: non si inviano richieste altrove. */
export const SERVIZI_PUSH = /^https:\/\/([a-z0-9-]+\.)*(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)\//i

export interface Dispositivo {
  endpoint: string
  p256dh: string
  auth: string
}

/** Spedisce una notifica. Restituisce il codice HTTP (404/410 = dispositivo non più valido). */
export async function inviaPush(d: Dispositivo, dati: unknown, chiavi: ChiaviVapid, contatto = 'https://formaweb.shop') {
  if (!SERVIZI_PUSH.test(d.endpoint)) return 400
  const risposta = await fetch(d.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await firmaVapid(d.endpoint, chiavi, contatto),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high',
    },
    body: await cifraPush(testoInByte(JSON.stringify(dati)), d.p256dh, d.auth),
  })
  if (!risposta.ok) console.error('Push:', risposta.status, await risposta.text().catch(() => ''))
  return risposta.status
}
