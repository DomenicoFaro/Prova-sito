import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigurato = Boolean(url && anonKey)

if (!supabaseConfigurato) {
  console.warn(
    'Supabase non configurato: imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (vedi .env.example).',
  )
}

// Solo la chiave "anon" (pubblica): la sicurezza è garantita dalle policy RLS.
export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'chiave-mancante', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const BUCKET_SCREENSHOTS = 'screenshots'
export const BUCKET_AVATARS = 'avatars'

/** Carica un file su Storage e restituisce l'URL pubblico. */
export async function caricaImmagine(bucket: string, cartella: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${cartella}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type,
  })
  if (error) throw error
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/** Traduce gli errori più comuni di Supabase in messaggi comprensibili. */
export function messaggioErrore(err: unknown): string {
  const msg =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Si è verificato un errore imprevisto.'
  if (/invalid login credentials/i.test(msg)) return 'Email o password non corretti.'
  if (/email not confirmed/i.test(msg)) return "Email non ancora confermata: controlla la tua casella di posta."
  if (!supabaseConfigurato) return 'Supabase non è configurato: crea il file .env.local (vedi .env.example).'
  if (/failed to fetch|networkerror/i.test(msg)) return 'Impossibile contattare il server. Controlla la connessione.'
  if (/row-level security|permission denied/i.test(msg)) return 'Non hai i permessi per eseguire questa operazione.'
  if (/rate limit/i.test(msg)) return 'Troppi tentativi ravvicinati: riprova tra qualche minuto.'
  if (/password should be at least/i.test(msg)) return 'La password deve contenere almeno 6 caratteri.'
  return msg
}
