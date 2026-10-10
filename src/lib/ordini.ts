import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type StatoOrdine = 'richiesto' | 'preventivo_inviato' | 'pagato' | 'annullato'

export const ETICHETTE_STATO_ORDINE: Record<StatoOrdine, string> = {
  richiesto: 'Da quotare',
  preventivo_inviato: 'Preventivo inviato',
  pagato: 'Pagato',
  annullato: 'Annullato',
}

/** Riga della tabella `ordini_siti` (supabase/ordini.sql), vista dall'admin. */
export interface OrdineSito {
  id: string
  numero: number
  token: string
  stato: StatoOrdine
  cliente_nome: string
  cliente_email: string
  cliente_telefono: string
  cliente_codice: string
  cliente_indirizzo: string
  tipo_sito: string
  nome_attivita: string
  pagine: string
  funzionalita: string[]
  lingue: string
  dominio: string
  stile: string
  descrizione: string
  scadenza: string
  budget: string
  prezzo: number | null
  acconto: number | null
  consegna_giorni: number | null
  nota_preventivo: string
  nota_interna: string
  preventivo_il: string | null
  firmatario: string
  accettato_il: string | null
  accettato_ip: string
  importo_pagato: number | null
  pagato_il: string | null
  contratto_finale: string | null
  created_at: string
}

/** Cosa vede il cliente del proprio ordine (risposta di `leggi_ordine`). */
export interface OrdineCliente {
  numero_ordine: string
  stato: StatoOrdine
  cliente_nome: string
  cliente_email: string
  tipo_sito: string
  nome_attivita: string
  pagine: string
  funzionalita: string[]
  dominio: string
  descrizione: string
  prezzo: number | null
  acconto: number | null
  consegna_giorni: number | null
  nota_preventivo: string
  pagato_il: string | null
  importo_pagato: number | null
  created_at: string
  contratto: string | null
}

export const FUNZIONALITA_SITO = [
  'Modulo di contatto',
  'Galleria immagini',
  'Blog / notizie',
  'Prenotazioni online',
  'Negozio online (e-commerce)',
  'Area clienti con login',
  'Newsletter',
  'Mappa e orari',
  'Collegamento ai social',
  'Chat WhatsApp',
  'Sito multilingua',
  'SEO di base',
] as const

export const PAGINE_SITO = ['1 pagina', '2–5 pagine', '6–10 pagine', '11–20 pagine', 'Più di 20 pagine'] as const

/** Memoria locale dei link agli ordini, così il cliente li ritrova dallo stesso dispositivo. */
const CHIAVE_ORDINI = 'ordini-cliente'
export interface OrdineSalvato {
  token: string
  nome: string
  data: string
}
export function ordiniSalvati(): OrdineSalvato[] {
  try {
    return JSON.parse(localStorage.getItem(CHIAVE_ORDINI) ?? '[]')
  } catch {
    return []
  }
}
export function salvaOrdine(o: OrdineSalvato) {
  try {
    const altri = ordiniSalvati().filter((x) => x.token !== o.token)
    localStorage.setItem(CHIAVE_ORDINI, JSON.stringify([o, ...altri].slice(0, 10)))
  } catch {
    /* localStorage non disponibile: il link resta comunque mostrato a schermo */
  }
}

export function linkOrdine(token: string) {
  return `${window.location.origin}/ordine/${token}`
}

/** Legge il messaggio d'errore restituito da una Edge Function. */
export async function erroreFunzione(e: unknown): Promise<string> {
  if (e instanceof FunctionsHttpError) {
    try {
      const corpo = await e.context.json()
      if (corpo?.error) return String(corpo.error)
    } catch {
      /* risposta non JSON */
    }
  }
  return 'Impossibile contattare il server dei pagamenti. Riprova tra poco.'
}

export async function avviaPagamento(token: string, firmatario: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('crea-checkout', { body: { token, firmatario } })
  if (error) throw new Error(await erroreFunzione(error))
  if (!data?.url) throw new Error('Risposta dei pagamenti non valida.')
  return data.url as string
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Blocchi del contratto: "# Titolo" è un titolo, le altre righe sono paragrafi. */
export function blocchiContratto(testo: string): { titolo: boolean; testo: string }[] {
  return testo
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => (r.startsWith('# ') ? { titolo: true, testo: r.slice(2) } : { titolo: false, testo: r }))
}

/** Documento HTML autonomo del contratto, da scaricare o stampare in PDF. */
export function contrattoHtml(testo: string, titolo: string) {
  const corpo = blocchiContratto(testo)
    .map((b) => (b.titolo ? `<h2>${esc(b.testo)}</h2>` : `<p>${esc(b.testo)}</p>`))
    .join('')
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(titolo)}</title>
<style>body{font:15px/1.6 Georgia,serif;max-width:760px;margin:40px auto;padding:0 20px;color:#111}h2{font:700 16px/1.4 Arial,sans-serif;margin:1.6em 0 .3em}p{margin:.3em 0}</style>
</head><body>${corpo}</body></html>`
}

export function scaricaContratto(testo: string, nomeFile: string) {
  const blob = new Blob([contrattoHtml(testo, nomeFile)], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nomeFile}.html`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function stampaContratto(testo: string, titolo: string) {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(contrattoHtml(testo, titolo))
  w.document.close()
  w.focus()
  w.print()
}
