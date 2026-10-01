import type { EsitoOpportunita, StatoPagamento, StatoProgetto, StatoRichiesta, StatoVendita } from './types'

const euro = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  // In it-IT il separatore delle migliaia sotto 10.000 viene omesso di default
  useGrouping: 'always',
})

/** 1250 → "1.250,00 €" */
export function formatEuro(valore: number | string | null | undefined): string {
  const testo = euro.format(Number(valore ?? 0))
  // Fallback per browser che ignorano useGrouping: 'always'
  return testo.replace(/^(-?)(\d)(\d{3}),/, '$1$2.$3,')
}

/** "1.250,50" → 1250.5 · "12,5" → 12.5 · "12.5" → 12.5 (NaN se non valido) */
export function parseNumero(testo: string | number): number {
  let s = String(testo).trim().replace(/[\s€%]/g, '')
  // Con la virgola il punto è separatore delle migliaia; senza, è il decimale
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  return s === '' ? NaN : Number(s)
}

export function formatPercentuale(valore: number | string | null | undefined): string {
  const n = Number(valore ?? 0)
  return `${n.toLocaleString('it-IT', { maximumFractionDigits: 2 })}%`
}

export function formatData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDataOra(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const ETICHETTE_STATO_PROGETTO: Record<StatoProgetto, string> = {
  in_lavorazione: 'In lavorazione',
  consegnato: 'Consegnato',
  manutenzione: 'In manutenzione',
}

export const ETICHETTE_STATO_PAGAMENTO: Record<StatoPagamento, string> = {
  pagato: 'Pagato',
  parziale: 'Parziale',
  da_pagare: 'Da pagare',
}

export const ETICHETTE_STATO_RICHIESTA: Record<StatoRichiesta, string> = {
  nuova: 'Nuova',
  letta: 'Letta',
  gestita: 'Gestita',
}

export const ETICHETTE_STATO_VENDITA: Record<StatoVendita, string> = {
  in_attesa: 'In attesa',
  approvata: 'Approvata',
  rifiutata: 'Rifiutata',
}

export const ETICHETTE_ESITO_OPPORTUNITA: Record<EsitoOpportunita, string> = {
  venduto: 'Venduto',
  interessato: 'Interessato',
  non_interessato: 'Non interessato',
}

export const TIPI_SITO = ['Sito vetrina', 'E-commerce', 'Web app', 'Prenotazioni online', 'Restyling', 'Altro'] as const

/** Data ISO (YYYY-MM-DD) di oggi nel fuso locale. */
export function oggiISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function hostname(url: string | null | undefined): string {
  if (!url) return ''
  // Dal testo originale (non da new URL) per mostrare i domini con accenti leggibili, non in punycode
  return url.replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0].replace(/^www\./, '')
}
