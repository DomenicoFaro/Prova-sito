import { formatEuro } from './format'
import { supabase } from './supabase'

export type GruppoVoce = 'tipologia' | 'extra' | 'servizio_esterno'
export type ModalitaPrezzo = 'fisso' | 'da' | 'preventivo'

/** Riga di `configuratore_voci` (supabase/configuratore.sql): il listino modificabile dall'admin. */
export interface VoceConfiguratore {
  codice: string
  gruppo: GruppoVoce
  nome: string
  descrizione: string
  prezzo: number | null
  modalita: ModalitaPrezzo
  pagine_incluse: number
  incluse: string[]
  a_quantita: boolean
  costo_testo: string
  ordine: number
  attivo: boolean
}

export type Impostazioni = Record<string, string>

export interface Selezione {
  tipologia: string
  pagine: number
  /** codice → quantità */
  extra: Record<string, number>
  urgenzaConfermata?: boolean
}

export interface RigaPreventivo {
  codice: string
  nome: string
  quantita: number
  importo: number
  incluso: boolean
  modalita: ModalitaPrezzo
}

/** Stessa forma restituita dalla funzione SQL `calcola_preventivo` (e salvata in `dettaglio_preventivo`). */
export interface Preventivo {
  tipologia: { codice: string; nome: string; prezzo: number | null; modalita: ModalitaPrezzo }
  pagine: number
  pagine_incluse: number
  pagine_extra: number
  pagine_extra_importo: number
  righe: RigaPreventivo[]
  subtotale: number
  urgenza_percentuale: number
  urgenza_importo: number
  urgenza_confermata: boolean
  totale: number
  approvazione_manuale: boolean
}

export const CODICE_PAGINA_AGGIUNTIVA = 'pagina_aggiuntiva'
export const MAX_PAGINE = 100
export const MAX_QUANTITA = 20

export const FASCE_BUDGET = [
  'Meno di 300 €',
  '300–600 €',
  '600–1.000 €',
  '1.000–2.000 €',
  'Oltre 2.000 €',
  'Non ho un budget preciso',
] as const

export type TipoScadenza = 'standard' | 'urgente' | 'nessuna'
export const OPZIONI_SCADENZA: { valore: TipoScadenza; titolo: string; nota: string }[] = [
  { valore: 'standard', titolo: 'Consegna standard', nota: 'Tempi normali, concordati nel preventivo.' },
  { valore: 'urgente', titolo: 'Consegna urgente', nota: 'Supplemento indicativo, solo previa conferma di FormaWeb.' },
  { valore: 'nessuna', titolo: 'Nessuna scadenza precisa', nota: 'Non ho fretta.' },
]

export const AVVISO_PREVENTIVO_PREDEFINITO = 'Preventivo indicativo, soggetto a conferma da parte di FormaWeb.'
export const AVVISO_SERVIZI_PREDEFINITO =
  'I costi dei servizi esterni variano in base alle funzionalità richieste e ai piani scelti. Verranno comunicati e concordati prima dell’attivazione.'

const arrotonda = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function percentualeUrgenza(imp: Impostazioni): number {
  const v = imp.urgenza_percentuale ?? ''
  return /^[0-9]{1,3}([.,][0-9]+)?$/.test(v) ? Number(v.replace(',', '.')) : 20
}

/**
 * Calcolo istantaneo mostrato nel modulo. È una COPIA di `calcola_preventivo` (SQL), che resta l'unica
 * fonte di verità: all'invio il server ricalcola tutto e ignora i numeri del browser.
 *   totale = prezzo base + pagine aggiuntive + extra (non già inclusi) + urgenza SOLO se confermata
 */
export function calcolaPreventivo(voci: VoceConfiguratore[], imp: Impostazioni, sel: Selezione): Preventivo | null {
  const t = voci.find((v) => v.gruppo === 'tipologia' && v.codice === sel.tipologia)
  if (!t) return null

  const pagine = Math.min(Math.max(Math.trunc(sel.pagine) || 1, 1), MAX_PAGINE)
  let sub = t.prezzo ?? 0
  let appr = t.modalita !== 'fisso'

  const pagExtra = t.modalita === 'preventivo' ? 0 : Math.max(0, pagine - t.pagine_incluse)
  const prezzoPagina = voci.find((v) => v.gruppo === 'extra' && v.codice === CODICE_PAGINA_AGGIUNTIVA)?.prezzo ?? 0
  const pagImporto = pagExtra * Number(prezzoPagina)
  sub += pagImporto

  const righe: RigaPreventivo[] = []
  for (const [codice, q] of Object.entries(sel.extra)) {
    if (!Number.isInteger(q) || q <= 0 || q > 99) continue
    const v = voci.find((x) => x.gruppo === 'extra' && x.codice === codice && x.codice !== CODICE_PAGINA_AGGIUNTIVA)
    if (!v) continue
    const quantita = v.a_quantita ? Math.min(q, MAX_QUANTITA) : 1
    const incluso = t.incluse.includes(codice)
    const importo = incluso ? 0 : Number(v.prezzo ?? 0) * quantita
    if (!incluso && v.modalita !== 'fisso') appr = true
    righe.push({ codice, nome: v.nome, quantita, importo, incluso, modalita: v.modalita })
    sub += importo
  }
  righe.sort((a, b) => (voci.find((v) => v.codice === a.codice)?.ordine ?? 0) - (voci.find((v) => v.codice === b.codice)?.ordine ?? 0))

  const pct = percentualeUrgenza(imp)
  const urg = arrotonda((sub * pct) / 100)
  const confermata = sel.urgenzaConfermata === true
  return {
    tipologia: { codice: t.codice, nome: t.nome, prezzo: t.prezzo, modalita: t.modalita },
    pagine,
    pagine_incluse: t.pagine_incluse,
    pagine_extra: pagExtra,
    pagine_extra_importo: pagImporto,
    righe,
    subtotale: sub,
    urgenza_percentuale: pct,
    urgenza_importo: urg,
    urgenza_confermata: confermata,
    totale: arrotonda(sub + (confermata ? urg : 0)),
    approvazione_manuale: appr,
  }
}

/** Prezzo di una voce come lo vede il cliente: "299 €", "da 1.199 €", "Su preventivo". */
export function formatPrezzoVoce(v: Pick<VoceConfiguratore, 'prezzo' | 'modalita'>, prefisso = ''): string {
  if (v.modalita === 'preventivo' || v.prezzo == null) return 'Su preventivo'
  const importo = formatEuro(v.prezzo).replace(/,00(?=\s)/, '')
  return `${v.modalita === 'da' ? 'da ' : ''}${prefisso}${importo}`
}

export async function caricaConfiguratore(): Promise<{ voci: VoceConfiguratore[]; impostazioni: Impostazioni }> {
  const [v, i] = await Promise.all([
    supabase.from('configuratore_voci').select('*').eq('attivo', true).order('ordine'),
    supabase.from('configuratore_impostazioni').select('chiave, valore'),
  ])
  if (v.error) throw v.error
  if (i.error) throw i.error
  const voci = (v.data as VoceConfiguratore[]).map((x) => ({ ...x, prezzo: x.prezzo == null ? null : Number(x.prezzo) }))
  const impostazioni = Object.fromEntries((i.data as { chiave: string; valore: string }[]).map((r) => [r.chiave, r.valore]))
  return { voci, impostazioni }
}

// ---------------------------------------------------------------------------
// Bozza del modulo: resta salvata nella scheda del browser, così andare avanti e indietro
// (o ricaricare la pagina) non fa perdere i dati.
// ---------------------------------------------------------------------------
export interface AllegatoCaricato {
  path: string
  nome: string
  dimensione: number
}

export interface Bozza {
  passo: number
  cartella: string
  cliente_nome: string
  cliente_email: string
  cliente_telefono: string
  cliente_codice: string
  cliente_indirizzo: string
  tipologia: string
  nome_attivita: string
  pagine: number
  lingue: string
  dominio: string
  descrizione: string
  stile: string
  extra: Record<string, number>
  budget: string
  scadenza_tipo: TipoScadenza
  allegati: AllegatoCaricato[]
}

const CHIAVE_BOZZA = 'sito-su-misura-bozza'

export function bozzaVuota(): Bozza {
  return {
    passo: 1,
    cartella: crypto.randomUUID(),
    cliente_nome: '',
    cliente_email: '',
    cliente_telefono: '',
    cliente_codice: '',
    cliente_indirizzo: '',
    tipologia: '',
    nome_attivita: '',
    pagine: 1,
    lingue: '',
    dominio: '',
    descrizione: '',
    stile: '',
    extra: {},
    budget: '',
    scadenza_tipo: 'standard',
    allegati: [],
  }
}

export function leggiBozza(): Bozza {
  try {
    const salvata = JSON.parse(sessionStorage.getItem(CHIAVE_BOZZA) ?? 'null') as Partial<Bozza> | null
    if (salvata && typeof salvata === 'object') return { ...bozzaVuota(), ...salvata }
  } catch {
    /* sessionStorage non disponibile o contenuto non valido */
  }
  return bozzaVuota()
}

export function salvaBozza(b: Bozza) {
  try {
    sessionStorage.setItem(CHIAVE_BOZZA, JSON.stringify(b))
  } catch {
    /* il modulo funziona anche senza bozza salvata */
  }
}

export function cancellaBozza() {
  try {
    sessionStorage.removeItem(CHIAVE_BOZZA)
  } catch {
    /* niente da fare */
  }
}

// ---------------------------------------------------------------------------
// Allegati del cliente (bucket privato "richieste-allegati")
// ---------------------------------------------------------------------------
export const BUCKET_ALLEGATI = 'richieste-allegati'
export const MAX_ALLEGATI = 10
export const MAX_BYTE_ALLEGATO = 5 * 1024 * 1024
export const TIPI_ALLEGATO: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

/** Controlla tipo e dimensione di un file; restituisce il messaggio d'errore o null. */
export function erroreAllegato(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (!TIPI_ALLEGATO[file.type]) return `"${file.name}": formato non consentito. Usa immagini (PNG, JPG, WebP), PDF, Word o testo.`
  if (file.size > MAX_BYTE_ALLEGATO) return `"${file.name}" supera i 5 MB.`
  if (file.size === 0) return `"${file.name}" è vuoto.`
  return null
}

/** Nome sicuro per il percorso: solo lettere, numeri, punto, trattino e underscore. */
export function nomeFileSicuro(nome: string, tipo: string): string {
  const estensione = TIPI_ALLEGATO[tipo] ?? 'bin'
  const base = nome
    .replace(/\.[^.]*$/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${crypto.randomUUID().slice(0, 8)}-${base || 'file'}.${estensione}`
}

export async function caricaAllegato(cartella: string, file: File): Promise<AllegatoCaricato> {
  const errore = erroreAllegato(file)
  if (errore) throw new Error(errore)
  const path = `richieste/${cartella}/${nomeFileSicuro(file.name, file.type)}`
  const { error } = await supabase.storage.from(BUCKET_ALLEGATI).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return { path, nome: file.name, dimensione: file.size }
}
