import { supabase } from './supabase'

/** Bucket privato (supabase/vendite.sql): modello/… e firmati/<id utente>/… */
export const BUCKET_CONTRATTI = 'contratti'
const CARTELLA_MODELLO = 'modello'
export const MAX_MB_CONTRATTO = 15
export const ACCEPT_CONTRATTO = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif'
export const ACCEPT_MODELLO = '.pdf,.doc,.docx'

function estensione(nome: string, fallback: string) {
  return nome.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || fallback
}

function controllaDimensione(file: File) {
  if (file.size > MAX_MB_CONTRATTO * 1024 * 1024) throw new Error(`"${file.name}" supera i ${MAX_MB_CONTRATTO} MB.`)
}

/** Carica i file del contratto firmato nella cartella dell'utente e restituisce i percorsi. */
export async function caricaContrattoFirmato(userId: string, files: File[]): Promise<string[]> {
  files.forEach(controllaDimensione)
  const percorsi: string[] = []
  try {
    for (const file of files) {
      const path = `firmati/${userId}/${crypto.randomUUID()}.${estensione(file.name, 'pdf')}`
      const { error } = await supabase.storage.from(BUCKET_CONTRATTI).upload(path, file, { contentType: file.type || undefined })
      if (error) throw error
      percorsi.push(path)
    }
    return percorsi
  } catch (e) {
    // Non lasciare file orfani se uno dei caricamenti fallisce
    await eliminaFile(percorsi)
    throw e
  }
}

export async function eliminaFile(percorsi: string[]) {
  if (percorsi.length) await supabase.storage.from(BUCKET_CONTRATTI).remove(percorsi)
}

/** Scarica un file del bucket contratti con il nome indicato. */
export async function scaricaFile(path: string, nomeFile: string) {
  const { data, error } = await supabase.storage.from(BUCKET_CONTRATTI).createSignedUrl(path, 60, { download: nomeFile })
  if (error) throw error
  window.location.assign(data.signedUrl)
}

/** Percorso del modello di contratto attuale, o null se non è ancora stato caricato. */
export async function trovaModello(): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET_CONTRATTI).list(CARTELLA_MODELLO, {
    limit: 10,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (error) throw error
  const file = (data ?? []).find((f) => f.id && !f.name.startsWith('.'))
  return file ? `${CARTELLA_MODELLO}/${file.name}` : null
}

export function nomeModello(path: string) {
  return `contratto.${estensione(path, 'pdf')}`
}

/** Sostituisce il modello di contratto (solo admin). */
export async function caricaModello(file: File): Promise<string> {
  controllaDimensione(file)
  const vecchio = await trovaModello()
  const path = `${CARTELLA_MODELLO}/contratto-${Date.now()}.${estensione(file.name, 'pdf')}`
  const { error } = await supabase.storage.from(BUCKET_CONTRATTI).upload(path, file, { contentType: file.type || undefined })
  if (error) throw error
  if (vecchio) await eliminaFile([vecchio])
  return path
}

/** Nome leggibile per un allegato: "Contratto Rossi (2 di 3).pdf" */
export function nomeAllegato(cliente: string, path: string, i: number, totale: number) {
  const base = `Contratto ${cliente}`.replace(/[\\/:*?"<>|]/g, '').trim()
  return `${base}${totale > 1 ? ` (${i + 1} di ${totale})` : ''}.${estensione(path, 'pdf')}`
}
