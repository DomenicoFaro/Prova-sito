export type Ruolo = 'admin' | 'collaboratore' | 'cliente'
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
  /** Collaboratore che vede tutti i ticket (supabase/ticket_tutti.sql; assente finché non lo esegui) */
  vede_tutti_ticket?: boolean
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
  /** Soldi già ricevuti dal cliente (acconto, saldo…): da incassare = prezzo_totale - incassato. */
  incassato: number
  /** Progetto in «Prova un mese» fino a questa data (il resto si incassa dopo). */
  prova_fino_al: string | null
  /** Ordine del sito (ordini_siti) da cui nasce il progetto, se pagato online. */
  ordine_id: string | null
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
  /** Chi l'ha caricata. */
  creato_da: string | null
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

export type TipoPrezzo = 'sito' | 'servizio' | 'abbonamento'

/** Riga della tabella `prezzi` (listino creato da supabase/soci.sql + prezzi_abbonamenti.sql): il listino interno, visibile solo a chi ha un account. */
export interface Prezzo {
  id: string
  tipo: TipoPrezzo
  nome: string
  descrizione: string
  /** Prezzo, o minimo se `prezzo_max` è valorizzato. */
  prezzo: number
  prezzo_max: number | null
  valuta: '€' | '$'
  a_partire_da: boolean
  /** es. "una tantum", "al mese", "all'anno" */
  periodicita: string
  caratteristiche: string[]
  in_evidenza: boolean
  ordine: number
  attivo: boolean
  created_at: string
}

/** Riga di `siti_cliente` (supabase/clienti_recensioni.sql): un sito acquistato. */
export interface SitoCliente {
  id: string
  cliente_id: string
  nome: string
  url: string
  data_acquisto: string
  note: string
  /** Chi segue il sito: riceve la notifica dei ticket */
  collaboratore_id: string | null
  created_at: string
}

/** Un accesso (Google, Vercel…): nel database esiste solo cifrato. */
export interface DatiAccesso {
  servizio: string
  nome: string
  cognome: string
  /** Data di nascita */
  data: string
  email: string
  password: string
  link: string
  note: string
}
export type Accesso = DatiAccesso & { id: string }

export interface RecensionePubblica {
  id: string
  stelle: number
  testo: string
  firma: string
  attivita: string
  created_at: string
}
export interface Recensione extends RecensionePubblica {
  cliente_id: string
  visibile: boolean
}

export interface Ticket {
  id: string
  numero: number
  token: string
  cliente_id: string | null
  sito_nome: string
  collaboratore_id: string | null
  nome: string
  email: string
  telefono: string
  oggetto: string
  stato: 'aperto' | 'chiuso'
  ultimo_autore: 'richiedente' | 'staff'
  ultimo_messaggio_il: string
  letto_admin_il: string | null
  letto_collaboratore_il: string | null
  letto_richiedente_il: string | null
  created_at: string
}
export interface MessaggioTicket {
  id: string
  autore: 'richiedente' | 'staff'
  autore_nome: string
  testo: string
  created_at: string
}
/** Quello che vede chi apre la chat con il link privato */
export interface TicketPubblico {
  numero: number
  oggetto: string
  stato: Ticket['stato']
  nome: string
  created_at: string
  messaggi: MessaggioTicket[]
}
