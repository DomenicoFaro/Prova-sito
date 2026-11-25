// Notifiche push su questo dispositivo (vedi public/sw.js e supabase/functions/notifica-ticket).
import { supabase } from './supabase'

const SEGNO = 'formaweb:push'

export const pushPossibile = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const suIPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
/** Il sito è aperto dall'icona sulla schermata Home */
export const comeApp = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

/** Le notifiche push sono attive qui: la pagina non deve mostrarne una seconda */
export function pushAttivoQui() {
  try {
    return localStorage.getItem(SEGNO) === '1'
  } catch {
    return false
  }
}
function segna(attivo: boolean) {
  try {
    if (attivo) localStorage.setItem(SEGNO, '1')
    else localStorage.removeItem(SEGNO)
  } catch {
    /* senza memoria del browser va bene lo stesso */
  }
}

/** Chiede al server di spedire le notifiche dei messaggi nuovi. Non blocca mai chi scrive. */
export function notificaTicket() {
  supabase.functions.invoke('notifica-ticket', { body: { azione: 'invia' } }).catch(() => {})
}

export async function chiavePush() {
  const { data, error } = await supabase.functions.invoke('notifica-ticket', { body: { azione: 'chiave' } })
  if (error || !data?.chiave) throw new Error('Le notifiche non sono ancora attive sul server.')
  return data.chiave as string
}

const inByte = (s: string) => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b + '='.repeat((4 - (b.length % 4)) % 4)), (c) => c.charCodeAt(0))
}

export const registraServizio = () => navigator.serviceWorker.register('/sw.js')

export async function iscrizioneAttuale() {
  const r = await navigator.serviceWorker.getRegistration()
  return (await r?.pushManager.getSubscription()) ?? null
}

async function salva(s: PushSubscription) {
  const j = s.toJSON()
  const { error } = await supabase.rpc('salva_push', {
    p_endpoint: s.endpoint,
    p_p256dh: j.keys?.p256dh,
    p_auth: j.keys?.auth,
    p_dispositivo: navigator.userAgent,
  })
  if (error) throw error
  segna(true)
}

/** Ricollega il dispositivo all'utente collegato (dopo un nuovo accesso). */
export async function allineaPush() {
  const s = await iscrizioneAttuale()
  if (s && Notification.permission === 'granted') await salva(s)
  else segna(false)
  return !!s && Notification.permission === 'granted'
}

/** Va chiamata direttamente dal tocco su un pulsante: iPhone lo richiede. */
export async function attivaPush(chiave: string) {
  const permesso = await Notification.requestPermission()
  if (permesso !== 'granted') return false
  await registraServizio()
  const r = await navigator.serviceWorker.ready
  const opzioni = { userVisibleOnly: true, applicationServerKey: inByte(chiave) }
  let s: PushSubscription
  try {
    s = await r.pushManager.subscribe(opzioni)
  } catch (e) {
    // Rimasta un'iscrizione con una chiave vecchia: si rifà
    const vecchia = await r.pushManager.getSubscription()
    if (!vecchia) throw e
    await vecchia.unsubscribe()
    s = await r.pushManager.subscribe(opzioni)
  }
  await salva(s)
  return true
}

export async function disattivaPush() {
  segna(false)
  if (!pushPossibile()) return
  const s = await iscrizioneAttuale()
  if (!s) return
  await supabase.from('push_iscrizioni').delete().eq('endpoint', s.endpoint)
  await s.unsubscribe()
}

export async function provaPush() {
  const { data, error } = await supabase.functions.invoke('notifica-ticket', { body: { azione: 'prova' } })
  if (error) throw new Error('La notifica di prova non è partita.')
  return (data?.inviate ?? 0) as number
}
