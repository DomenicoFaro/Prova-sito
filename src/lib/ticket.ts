// Ticket e chat (tabelle e funzioni in supabase/clienti_recensioni.sql).
import { useEffect, useRef, useState } from 'react'
import { pushAttivoQui } from './push'
import { supabase } from './supabase'
import type { Ruolo, Ticket } from './types'

/** Ogni quanto si ricontrolla la chat aperta e l'elenco dei ticket */
export const ATTESA_CHAT = 5_000
export const ATTESA_ELENCO = 20_000

/** Richiama `fn` a intervalli finché la pagina è in primo piano (e quando ci si torna). */
export function useAggiornamento(fn: () => void, ogni: number, attivo = true) {
  const ultima = useRef(fn)
  ultima.current = fn
  useEffect(() => {
    if (!attivo) return
    const giro = () => ultima.current()
    const t = setInterval(giro, ogni)
    window.addEventListener('focus', giro)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', giro)
    }
  }, [ogni, attivo])
}

/** C'è un messaggio che questa persona non ha ancora visto? */
export function daLeggere(t: Ticket, ruolo: Ruolo, utente: string) {
  const dopo = (letto: string | null) => !letto || new Date(letto) < new Date(t.ultimo_messaggio_il)
  if (ruolo === 'cliente') return t.ultimo_autore === 'staff' && dopo(t.letto_richiedente_il)
  if (t.ultimo_autore !== 'richiedente') return false
  if (ruolo === 'admin') return dopo(t.letto_admin_il)
  return t.collaboratore_id === utente && dopo(t.letto_collaboratore_il)
}

/** Avviso di sistema mentre l'area è aperta, solo se non ci sono già le notifiche push. */
export function avvisa(titolo: string, testo: string) {
  try {
    if (!pushAttivoQui() && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(titolo, { body: testo, icon: '/favicon-192.png', tag: 'ticket' })
    }
  } catch {
    /* alcuni telefoni non permettono le notifiche da una pagina: resta il numero nel menu */
  }
}

/** Ticket visibili a chi è collegato (filtrati dal database), con quelli da leggere. */
export function useTicket(utente: string | undefined, ruolo: Ruolo | undefined) {
  const [ticket, setTicket] = useState<Ticket[] | null>(null)
  const [errore, setErrore] = useState(false)
  const visti = useRef<Set<string> | null>(null)

  async function carica() {
    if (!utente || !ruolo) return
    const { data, error } = await supabase.from('tickets').select('*').order('ultimo_messaggio_il', { ascending: false }).limit(200)
    if (error || !Array.isArray(data)) return setErrore(true)
    setErrore(false)
    const elenco = data as Ticket[]
    setTicket(elenco)
    // Un avviso per ogni messaggio non ancora segnalato (non al primo caricamento)
    const nuovi = elenco.filter((t) => daLeggere(t, ruolo, utente))
    const chiavi = nuovi.map((t) => `${t.id}:${t.ultimo_messaggio_il}`)
    if (visti.current) {
      nuovi.forEach((t, i) => {
        if (!visti.current!.has(chiavi[i])) avvisa(ruolo === 'cliente' ? 'Forma Web ti ha risposto' : `Ticket #${t.numero} – ${t.nome}`, t.oggetto)
      })
    }
    visti.current = new Set([...(visti.current ?? []), ...chiavi])
  }

  useEffect(() => {
    visti.current = null
    carica()
  }, [utente, ruolo])
  useAggiornamento(carica, ATTESA_ELENCO, !!utente)
  useEffect(() => {
    const aggiorna = () => carica()
    window.addEventListener('ticket-aggiornati', aggiorna)
    return () => window.removeEventListener('ticket-aggiornati', aggiorna)
  }, [utente, ruolo])

  const nonLetti = utente && ruolo ? (ticket ?? []).filter((t) => daLeggere(t, ruolo, utente)).length : 0
  return { ticket, errore, nonLetti, ricarica: carica }
}

/** Dice a menu ed elenco che qualcosa è cambiato. */
export const ticketCambiati = () => window.dispatchEvent(new Event('ticket-aggiornati'))

/* ---------- Ticket dei visitatori salvati su questo dispositivo ---------- */

export interface TicketSalvato {
  token: string
  numero: number
}
const CHIAVE = 'formaweb:ticket'

export function ticketSalvati(): TicketSalvato[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function salvaTicket(t: TicketSalvato) {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify([t, ...ticketSalvati().filter((x) => x.token !== t.token)].slice(0, 5)))
  } catch {
    /* senza memoria del browser resta il link mostrato a schermo */
  }
}
