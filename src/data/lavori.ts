import { hostname } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { ProgettoPortfolio } from '../lib/types'
import { esegui, useQuery } from '../lib/useQuery'

export type Lavoro = ProgettoPortfolio & {
  /** Schermata da smartphone, se disponibile */
  telefono_url: string | null
}

interface Extra {
  /** Nome dei file in public/lavori: <file>.jpg (computer) e <file>-m.jpg (telefono) */
  file: string
  categoria: string
  descrizione: string
}

const CAFE: Extra = {
  file: 'cafe',
  categoria: 'Ristorazione',
  descrizione: 'Pasticceria a Catania: menù consultabile da smartphone, storia del locale e prenotazione dei banchetti.',
}

/**
 * Immagini e testi di riserva per i siti già realizzati, abbinati per dominio.
 * Valgono solo per i campi lasciati vuoti in Admin → Progetti: quello che inserisci lì ha la precedenza.
 */
const EXTRA: Record<string, Extra> = {
  'ilsognodellabellezza.vercel.app': {
    file: 'sogno',
    categoria: 'Beauty',
    descrizione: 'Centro estetico a Catania: trattamenti, promozioni, prenotazione online e gestionale per agenda e clienti.',
  },
  'prova-red-ten.vercel.app': {
    file: 'shophouse',
    categoria: 'E-commerce',
    descrizione: 'Negozio online di casa, intimo e cura persona, con spedizione in tutta Italia o ritiro in negozio.',
  },
  'vogliadiparrucchieri.shop': {
    file: 'voglia',
    categoria: 'Beauty',
    descrizione: 'Parrucchieri ed estetica a Catania: servizi, team, galleria, prenotazione online e pannello per lo staff.',
  },
  'cafésauvage.com': CAFE,
  'xn--cafsauvage-d7a.com': CAFE,
  'pizzeria3d.vercel.app': {
    file: 'pizza',
    categoria: 'Ristorazione',
    descrizione: 'Pizzeria e hamburgheria a Catania: menù online e ordini per asporto o consegna a domicilio.',
  },
  'bozza-barbiere.vercel.app': {
    file: 'barbiere',
    categoria: 'Beauty',
    descrizione: 'Parrucchiere uomo a Catania: listino servizi, galleria e prenotazione online degli appuntamenti.',
  },
}

export const dominio = (url: string | null | undefined) => hostname(url).toLowerCase()

function completa(p: ProgettoPortfolio): Lavoro {
  const extra = EXTRA[dominio(p.url)]
  return {
    ...p,
    categoria: p.categoria || extra?.categoria || '',
    descrizione: p.descrizione || extra?.descrizione || '',
    screenshot_url: p.screenshot_url || (extra ? `/lavori/${extra.file}.jpg` : null),
    telefono_url: extra ? `/lavori/${extra.file}-m.jpg` : null,
  }
}

/** Tutti i progetti pubblici, dal più recente. */
export function useLavori() {
  return useQuery(async () => {
    const righe = await esegui<ProgettoPortfolio[]>(
      supabase.from('portfolio').select('*').order('data_consegna', { ascending: false, nullsFirst: false }),
    )
    return righe.map(completa)
  })
}

/** Un singolo progetto pubblico. */
export async function caricaLavoro(id: string): Promise<Lavoro | null> {
  const riga = await esegui<ProgettoPortfolio | null>(supabase.from('portfolio').select('*').eq('id', id).maybeSingle())
  return riga ? completa(riga) : null
}
