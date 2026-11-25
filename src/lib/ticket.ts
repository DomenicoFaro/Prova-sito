// Ticket e chat (tabelle e funzioni in supabase/clienti_recensioni.sql).
import { useEffect, useRef, useState } from 'react'
import { pushAttivoQui } from './push'
import { supabase } from './supabase'
import type { Profilo, Ticket } from './types'

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

/** C'è un messaggio che questa persona non ha ancora visto? `letture` serve a chi vede tutti i ticket. */
export function daLeggere(t: Ticket, persona: Profilo, letture: Map<string, string>) {
  const dopo = (letto: string | null | undefined) => !letto || new Date(letto) < new Date(t.ultimo_messaggio_il)
  if (persona.ruolo === 'cliente') return t.ultimo_autore === 'staff' && dopo(t.letto_richiedente_il)
  if (t.ultimo_autore !== 'richiedente') return false
  if (persona.ruolo === 'admin') return dopo(t.letto_admin_il)
  if (t.collaboratore_id === persona.id) return dopo(t.letto_collaboratore_il)
  return !!persona.vede_tutti_ticket && dopo(letture.get(t.id))
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
export function useTicket(persona: Profilo | null) {
  const [ticket, setTicket] = useState<Ticket[] | null>(null)
  const [letture, setLetture] = useState<Map<string, string>>(() => new Map())
  const [errore, setErrore] = useState(false)
  const visti = useRef<Set<string> | null>(null)
  const ultima = useRef<() => void>(() => {})
  const utente = persona?.id
  const tutti = !!persona?.vede_tutti_ticket

  async function carica() {
    if (!persona) return
    const [elencoR, lettureR] = await Promise.all([
      supabase.from('tickets').select('*').order('ultimo_messaggio_il', { ascending: false }).limit(200),
      tutti ? supabase.from('ticket_letture').select('ticket_id, letto_il').eq('utente_id', persona.id) : Promise.resolve({ data: [] }),
    ])
    const { data, error } = elencoR
    if (error || !Array.isArray(data)) return setErrore(true)
    setErrore(false)
    const elenco = data as Ticket[]
    const lette = new Map(((lettureR.data ?? []) as { ticket_id: string; letto_il: string }[]).map((l) => [l.ticket_id, l.letto_il]))
    setTicket(elenco)
    setLetture(lette)
    // Un avviso per ogni messaggio non ancora segnalato (non al primo caricamento)
    const nuovi = elenco.filter((t) => daLeggere(t, persona, lette))
    const chiavi = nuovi.map((t) => `${t.id}:${t.ultimo_messaggio_il}`)
    if (visti.current) {
      nuovi.forEach((t, i) => {
        if (!visti.current!.has(chiavi[i])) avvisa(persona.ruolo === 'cliente' ? 'Forma Web ti ha risposto' : `Ticket #${t.numero} – ${t.nome}`, t.oggetto)
      })
    }
    visti.current = new Set([...(visti.current ?? []), ...chiavi])
  }

  useEffect(() => {
    visti.current = null
    carica()
  }, [utente, persona?.ruolo, tutti])
  useAggiornamento(carica, ATTESA_ELENCO, !!utente)
  useEffect(() => {
    const aggiorna = () => ultima.current()
    window.addEventListener('ticket-aggiornati', aggiorna)
    return () => window.removeEventListener('ticket-aggiornati', aggiorna)
  }, [])
  ultima.current = carica

  const nuovo = (t: Ticket) => !!persona && daLeggere(t, persona, letture)
  return { ticket, errore, nuovo, nonLetti: (ticket ?? []).filter(nuovo).length, ricarica: carica }
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
