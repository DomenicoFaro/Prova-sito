import { useCallback, useEffect, useState } from 'react'
import { messaggioErrore } from './supabase'

/** Piccolo hook per caricare dati asincroni con stato di caricamento ed errore. */
export function useQuery<T>(carica: () => Promise<T>, deps: unknown[] = []) {
  const [dati, setDati] = useState<T | null>(null)
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [versione, setVersione] = useState(0)

  const fn = useCallback(carica, deps)

  useEffect(() => {
    let attivo = true
    setCaricamento(true)
    setErrore(null)
    fn()
      .then((d) => {
        if (attivo) setDati(d)
      })
      .catch((e) => {
        if (attivo) setErrore(messaggioErrore(e))
      })
      .finally(() => {
        if (attivo) setCaricamento(false)
      })
    return () => {
      attivo = false
    }
  }, [fn, versione])

  const ricarica = useCallback(() => setVersione((v) => v + 1), [])
  return { dati, caricamento, errore, ricarica, setDati }
}

/** Esegue una query Supabase e lancia l'errore se presente. */
export async function esegui<T>(q: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await q
  if (error) throw error
  return data as T
}
