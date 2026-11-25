import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { formatDataOra } from '../lib/format'
import { messaggioErrore } from '../lib/supabase'
import type { MessaggioTicket } from '../lib/types'
import { Icon } from './Icon'
import { MessaggioErrore, Spinner } from './ui'

/** Conversazione di un ticket. `mio` dice quali messaggi stanno a destra. */
export function Chat({
  messaggi,
  mio,
  onInvia,
  avviso,
}: {
  messaggi: MessaggioTicket[]
  mio: MessaggioTicket['autore']
  onInvia: (testo: string) => Promise<void>
  avviso?: string
}) {
  const [testo, setTesto] = useState('')
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const elenco = useRef<HTMLDivElement>(null)

  // Si resta sull'ultimo messaggio quando ne arriva uno nuovo
  useEffect(() => {
    const el = elenco.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messaggi.length])

  async function invia(e?: FormEvent) {
    e?.preventDefault()
    if (invio || !testo.trim()) return
    setErrore(null)
    setInvio(true)
    try {
      await onInvia(testo.trim())
      setTesto('')
    } catch (err) {
      setErrore(messaggioErrore(err))
    } finally {
      setInvio(false)
    }
  }

  // Invio spedisce, Maiusc+Invio va a capo
  const tasto = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      invia()
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div ref={elenco} className="max-h-[55vh] min-h-64 space-y-4 overflow-y-auto bg-slate-50 p-4 sm:p-6" role="log" aria-live="polite" aria-label="Messaggi">
        {messaggi.map((m) => {
          const proprio = m.autore === mio
          return (
            <div key={m.id} className={`flex flex-col ${proprio ? 'items-end' : 'items-start'}`}>
              <p
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                  proprio ? 'rounded-br-md bg-brand-900 text-white' : 'rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200'
                }`}
              >
                {m.testo}
              </p>
              <p className="mt-1 px-1 text-xs text-slate-500">
                {m.autore_nome} · {formatDataOra(m.created_at)}
              </p>
            </div>
          )
        })}
      </div>
      <form onSubmit={invia} className="space-y-3 border-t border-slate-200 p-3 sm:p-4">
        {avviso && <p className="text-sm text-amber-800">{avviso}</p>}
        {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
        <div className="flex items-end gap-2">
          <textarea
            className="input min-h-12 flex-1 resize-y"
            rows={2}
            maxLength={4000}
            placeholder="Scrivi un messaggio…"
            aria-label="Scrivi un messaggio"
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            onKeyDown={tasto}
          />
          <button type="submit" className="btn-primary h-12" disabled={invio || !testo.trim()}>
            {invio ? <Spinner className="h-4 w-4" /> : <Icon name="arrowRight" className="h-4 w-4" />}
            <span className="hidden sm:inline">Invia</span>
          </button>
        </div>
      </form>
    </div>
  )
}
