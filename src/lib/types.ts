export type Ruolo = 'admin' | 'collaboratore'
export type StatoProgetto = 'in_lavorazione' | 'consegnato' | 'manutenzione'
export type StatoPagamento = 'pagato' | 'parziale' | 'da_pagare'
export type StatoRichiesta = 'nuova' | 'letta' | 'gestita'

export interface Profilo {
  id: string
  nome: string
  email: string
  avatar_url: string | null
  ruolo: Ruolo
  percentuale_default: number
  attivo: boolean
  created_at: string
}

export interface Progetto {
  id: string
  nome: string
  cliente: string
  url: string | null
  categoria: string
  descrizione: string
  funzionalita: string[]
  tecnologie: string[]
  screenshot_url: string | null
  galleria: string[]
  prezzo_totale: number
  data_consegna: string | null
  stato: StatoProgetto
  pubblico: boolean
  created_at: string
}

/** Riga della view pubblica `portfolio` (niente dati economici). */
export type ProgettoPortfolio = Pick<
  Progetto,
  | 'id'
  | 'nome'
  | 'cliente'
  | 'url'
  | 'categoria'
  | 'descrizione'
  | 'funzionalita'
  | 'tecnologie'
  | 'screenshot_url'
  | 'galleria'
  | 'data_consegna'
  | 'created_at'
>

export interface Assegnazione {
  id: string
  progetto_id: string
  collaboratore_id: string
  percentuale: number
  ruolo_nel_progetto: string
  created_at: string
}

export interface Pagamento {
  id: string
  assegnazione_id: string
  importo: number
  data: string
  nota: string
  created_at: string
}

/** Riga della view `v_guadagni`. */
export interface Guadagno {
  assegnazione_id: string
  progetto_id: string
  collaboratore_id: string
  percentuale: number
  ruolo_nel_progetto: string
  progetto_nome: string
  cliente: string
  url: string | null
  categoria: string
  stato_progetto: StatoProgetto
  data_consegna: string | null
  progetto_created_at: string
  prezzo_totale: number
  guadagno: number
  pagato: number
  residuo: number
  stato_pagamento: StatoPagamento
}

export interface RichiestaContatto {
  id: string
  nome: string
  email: string
  telefono: string
  messaggio: string
  stato: StatoRichiesta
  created_at: string
}
