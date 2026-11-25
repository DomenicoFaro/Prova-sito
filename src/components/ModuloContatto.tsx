import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CONTATTI } from '../config'
import { messaggioErrore, supabase } from '../lib/supabase'
import { salvaTicket, ticketSalvati, type TicketSalvato } from '../lib/ticket'
import { Icon } from './Icon'
import { MessaggioErrore, Spinner } from './ui'

const VUOTO = { nome: '', email: '', telefono: '', messaggio: '', controllo: '' }

/** «Scrivici»: apre un ticket e porta alla chat privata sul sito. */
export function ModuloContatto() {
  const [dati, setDati] = useState(VUOTO)
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState<{ testo: string; scriviDiretto?: boolean } | null>(null)
  const [aperto, setAperto] = useState<TicketSalvato | null>(null)
  const [precedenti] = useState(ticketSalvati)

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
    const { data, error } = await supabase.rpc('apri_ticket', { p: dati })
    setInvio(false)
    if (error || !data?.token) {
      // Le frasi del database spiegano cosa correggere; per tutto il resto si propone l'email
      const chiaro = ['22023', '54000'].includes(error?.code ?? '')
      return setErrore(chiaro ? { testo: messaggioErrore(error), scriviDiretto: error?.code === '54000' } : { testo: 'Non è stato possibile inviare il messaggio.', scriviDiretto: true })
    }
    const nuovo = { token: data.token as string, numero: data.numero as number }
    salvaTicket(nuovo)
    setAperto(nuovo)
    setDati(VUOTO)
  }

  if (aperto) {
    return (
      <div role="status" className="flex h-full min-h-96 flex-col items-center justify-center text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-lime-accento text-brand-950">
          <Icon name="check" className="h-8 w-8" />
        </span>
        <h3 className="mt-6 text-3xl font-bold tracking-tight text-brand-950">Ticket n. {aperto.numero} aperto</h3>
        <p className="mt-3 max-w-xs leading-relaxed text-slate-600">
          Ti rispondiamo nella chat. <strong>Salva il link</strong>: è la tua chat privata.
        </p>
        <Link to={`/assistenza/${aperto.token}`} className="btn-primary btn-grande mt-7">
          <Icon name="chat" className="h-5 w-5" /> Apri la chat
        </Link>
        <button type="button" className="btn-ghost mt-2" onClick={() => setAperto(null)}>
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
      {precedenti.length > 0 && (
        <p className="rounded-2xl bg-nebbia p-3 text-sm text-slate-700">
          Le tue chat:{' '}
          {precedenti.map((t) => (
            <Link key={t.token} to={`/assistenza/${t.token}`} className="mr-3 font-semibold whitespace-nowrap text-brand-700 underline underline-offset-2">
              ticket n. {t.numero}
            </Link>
          ))}
        </p>
      )}
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
        {invio ? <Spinner className="h-5 w-5" /> : <Icon name="chat" className="h-5 w-5" />}
        {invio ? 'Invio in corso…' : 'Apri la richiesta'}
      </button>
      <p className="text-center text-xs text-slate-500">Usiamo questi dati solo per risponderti.</p>
    </form>
  )
}
