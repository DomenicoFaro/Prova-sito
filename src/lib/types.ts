export type Ruolo = 'admin' | 'collaboratore'
export type StatoProgetto = 'in_lavorazione' | 'consegnato' | 'manutenzione'
export type StatoPagamento = 'pagato' | 'parziale' | 'da_pagare'
export type StatoRichiesta = 'nuova' | 'letta' | 'gestita'
export type StatoVendita = 'in_attesa' | 'approvata' | 'rifiutata'
export type EsitoOpportunita = 'venduto' | 'interessato' | 'non_interessato'

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

/** Riga della tabella `vendite` (supabase/vendite.sql). */
export interface Vendita {
  id: string
  collaboratore_id: string
  cliente_nome: string
  cliente_codice: string
  cliente_email: string
  cliente_telefono: string
  cliente_indirizzo: string
  sito_nome: string
  tipo_sito: string
  dominio: string
  prezzo: number
  acconto: number
  data_firma: string
  consegna_prevista: string | null
  note: string
  allegati: string[]
  stato: StatoVendita
  progetto_id: string | null
  created_at: string
}

/** Riga della tabella `opportunita` (supabase/opportunita.sql). */
export interface Opportunita {
  id: string
  nome: string
  maps_url: string
  categoria: string
  indirizzo: string
  dettagli: string
  attiva: boolean
  /** null = creata dall'admin (per tutti); altrimenti link privato di quel collaboratore. */
  owner_id: string | null
  created_at: string
}

/** Riga della tabella `opportunita_esiti`: l'esito di un collaboratore su un'opportunità. */
export interface EsitoOpportunitaRiga {
  opportunita_id: string
  collaboratore_id: string
  esito: EsitoOpportunita
  updated_at: string
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

/** Riga della tabella `opportunita_prese`: la presa in carico (12 ore) di un'opportunità. */
export interface OpportunitaPresa {
  opportunita_id: string
  collaboratore_id: string
  preso_il: string
  scade_il: string
}
