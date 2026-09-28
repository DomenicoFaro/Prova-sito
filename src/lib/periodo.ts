import type { Guadagno } from './types'

export type Periodo = 'mese' | 'anno' | 'sempre'

export const ETICHETTE_PERIODO: Record<Periodo, string> = {
  mese: 'Mese corrente',
  anno: 'Anno corrente',
  sempre: 'Sempre',
}

/** Data di riferimento di un guadagno: la consegna, o la creazione del progetto se non ancora consegnato. */
export function dataRiferimento(g: Pick<Guadagno, 'data_consegna' | 'progetto_created_at'>): Date {
  return g.data_consegna ? new Date(`${g.data_consegna}T00:00:00`) : new Date(g.progetto_created_at)
}

export function nelPeriodo(d: Date, periodo: Periodo, oggi = new Date()): boolean {
  if (periodo === 'sempre') return true
  if (periodo === 'anno') return d.getFullYear() === oggi.getFullYear()
  return d.getFullYear() === oggi.getFullYear() && d.getMonth() === oggi.getMonth()
}

export function totali(righe: Guadagno[]) {
  const guadagnato = righe.reduce((s, r) => s + Number(r.guadagno), 0)
  const pagato = righe.reduce((s, r) => s + Number(r.pagato), 0)
  const daRicevere = righe.reduce((s, r) => s + Number(r.residuo), 0)
  return { guadagnato, pagato, daRicevere, progetti: new Set(righe.map((r) => r.progetto_id)).size }
}
