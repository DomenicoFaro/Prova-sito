import { useState, type FormEvent } from 'react'
import { CONTATTI } from '../config'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'
import { MessaggioErrore, Spinner } from './ui'

const VUOTO = { nome: '', email: '', telefono: '', messaggio: '', controllo: '' }

type Errore = { testo: string; scriviDiretto?: boolean }

/** Il server spiega cosa non va solo per dati errati (400) o troppi invii (429). */
async function leggiErrore(errore: unknown): Promise<Errore> {
  const risposta = (errore as { context?: unknown }).context
  if (risposta instanceof Response && (risposta.status === 400 || risposta.status === 429)) {
    const corpo = await risposta.json().catch(() => null)
    if (corpo?.error) return { testo: corpo.error, scriviDiretto: risposta.status === 429 }
  }
  return { testo: 'Non è stato possibile inviare il messaggio.', scriviDiretto: true }
}

/** «Scrivici»: il messaggio arriva via email a Forma Web (funzione Supabase `contatto`). */
export function ModuloContatto() {
  const [dati, setDati] = useState(VUOTO)
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState<Errore | null>(null)
  const [inviatoA, setInviatoA] = useState('')

  const campo = (nome: keyof typeof VUOTO) => ({
    name: nome,
    value: dati[nome],
    onChange: (e: { target: { value: string } }) => setDati((d) => ({ ...d, [nome]: e.target.value })),
  })

  async function invia(e: FormEvent) {
    e.preventDefault()
    if (invio) return
    if (dati.nome.trim().length < 2) return setErrore({ testo: 'Inserisci il tuo nome.' })
    if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/.test(dati.email.trim())) return setErrore({ testo: 'Inserisci un indirizzo email valido.' })
    if (dati.messaggio.trim().length < 10) return setErrore({ testo: 'Scrivi un messaggio di almeno 10 caratteri.' })

    setErrore(null)
    setInvio(true)
    try {
      const { error } = await supabase.functions.invoke('contatto', { body: dati })
      if (error) setErrore(await leggiErrore(error))
      else {
        setInviatoA(dati.email.trim())
        setDati(VUOTO)
      }
    } catch (err) {
      setErrore(await leggiErrore(err))
    } finally {
      setInvio(false)
    }
  }

  if (inviatoA) {
    return (
      <div role="status" className="flex h-full min-h-96 flex-col items-center justify-center text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-600 text-white">
          <Icon name="check" className="h-8 w-8" />
        </span>
        <h3 className="mt-6 text-3xl font-bold tracking-tight text-brand-950">Messaggio inviato</h3>
        <p className="mt-3 max-w-xs leading-relaxed break-words text-slate-600">Grazie! Ti rispondiamo all’indirizzo {inviatoA}.</p>
        <button type="button" className="btn-secondary mt-8" onClick={() => setInviatoA('')}>
          Scrivi un altro messaggio
        </button>
      </div>
    )
  }

  // Se l'invio dal sito non funziona, il cliente non perde quello che ha scritto
  const mailto = `mailto:${CONTATTI.email}?subject=${encodeURIComponent(`Richiesta dal sito – ${dati.nome.trim()}`)}&body=${encodeURIComponent(
    `${dati.messaggio.trim()}\n\n${dati.nome.trim()}${dati.telefono.trim() ? `\nTel. ${dati.telefono.trim()}` : ''}`,
  )}`

  return (
    <form onSubmit={invia} noValidate className="space-y-4">
      <h3 className="text-2xl font-bold tracking-tight text-brand-950">Scrivici</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="label">Nome</span>
          <input className="input" autoComplete="name" maxLength={100} required {...campo('nome')} />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input className="input" type="email" autoComplete="email" maxLength={200} required {...campo('email')} />
        </label>
        <label className="block">
          <span className="label">
            Telefono <span className="font-normal text-slate-400">(facoltativo)</span>
          </span>
          <input className="input" type="tel" autoComplete="tel" maxLength={50} {...campo('telefono')} />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Messaggio</span>
          <textarea className="input min-h-36 resize-y" maxLength={4000} required placeholder="Che attività hai? Cosa ti serve?" {...campo('messaggio')} />
        </label>
      </div>

      {/* Trappola per i programmi automatici: invisibile alle persone */}
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0" {...campo('controllo')} />

      {errore && (
        <MessaggioErrore>
          {errore.testo}
          {errore.scriviDiretto && CONTATTI.email && (
            <>
              {' '}
              <a href={mailto} className="font-semibold break-all underline underline-offset-2">
                Scrivici a {CONTATTI.email}
              </a>
            </>
          )}
        </MessaggioErrore>
      )}

      <button type="submit" className="btn-primary btn-grande w-full" disabled={invio}>
        {invio ? <Spinner className="h-5 w-5" /> : <Icon name="mail" className="h-5 w-5" />}
        {invio ? 'Invio in corso…' : 'Invia il messaggio'}
      </button>
      <p className="text-center text-xs text-slate-500">Usiamo questi dati solo per risponderti.</p>
    </form>
  )
}
