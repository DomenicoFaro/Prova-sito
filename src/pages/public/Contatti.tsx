import { useState, type FormEvent } from 'react'
import { AGENZIA } from '../../config'
import { Icon, type NomeIcona } from '../../components/Icon'
import { Reveal } from '../../components/Reveal'
import { Seo } from '../../components/Seo'
import { MessaggioErrore, MessaggioSuccesso, Spinner } from '../../components/ui'
import { messaggioErrore, supabase } from '../../lib/supabase'

const VUOTO = { nome: '', email: '', telefono: '', messaggio: '' }

export default function Contatti() {
  const [form, setForm] = useState(VUOTO)
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [inviato, setInviato] = useState(false)

  const aggiorna = (k: keyof typeof VUOTO) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function invia(e: FormEvent) {
    e.preventDefault()
    setErrore(null)
    if (!form.nome.trim() || !form.email.trim() || !form.messaggio.trim()) {
      setErrore('Compila nome, email e messaggio.')
      return
    }
    setInvio(true)
    const { error } = await supabase.from('richieste_contatto').insert({
      nome: form.nome.trim(),
      email: form.email.trim(),
      telefono: form.telefono.trim(),
      messaggio: form.messaggio.trim(),
    })
    setInvio(false)
    if (error) {
      setErrore(messaggioErrore(error))
      return
    }
    setInviato(true)
    setForm(VUOTO)
  }

  const canali: { icona: NomeIcona; etichetta: string; valore: string; href: string }[] = [
    { icona: 'mail', etichetta: 'Email', valore: AGENZIA.email, href: `mailto:${AGENZIA.email}` },
    { icona: 'phone', etichetta: 'Telefono', valore: AGENZIA.telefono, href: `tel:${AGENZIA.telefono.replace(/\s/g, '')}` },
    { icona: 'chat', etichetta: 'WhatsApp', valore: 'Scrivici in chat', href: `https://wa.me/${AGENZIA.whatsapp}` },
  ]

  return (
    <>
      <Seo titolo="Contatti" descrizione={`Contatta ${AGENZIA.nome} per un preventivo gratuito per il tuo sito web.`} />
      <section className="border-b border-slate-100 bg-gradient-to-b from-brand-50/60 to-white">
        <div className="container-sito py-14 sm:py-20">
          <Reveal>
            <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">Contatti</p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Parliamo del tuo progetto</h1>
            <p className="mt-4 max-w-2xl text-slate-600">Raccontaci cosa ti serve: ti rispondiamo entro 24 ore lavorative con idee e un preventivo gratuito.</p>
          </Reveal>
        </div>
      </section>

      <section className="container-sito grid gap-10 py-12 lg:grid-cols-5">
        <Reveal className="space-y-3 lg:col-span-2">
          {canali.map((c) => (
            <a
              key={c.etichetta}
              href={c.href}
              target={c.href.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="card flex items-center gap-4 p-4 transition hover:border-brand-200 hover:shadow-md"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <Icon name={c.icona} />
              </span>
              <span>
                <span className="block text-xs font-semibold text-slate-500 uppercase">{c.etichetta}</span>
                <span className="block font-semibold break-all text-slate-900">{c.valore}</span>
              </span>
            </a>
          ))}
        </Reveal>

        <Reveal ritardo={100} className="lg:col-span-3">
          <form onSubmit={invia} className="card space-y-4 p-6 sm:p-8" noValidate>
            {inviato && <MessaggioSuccesso>Grazie! Abbiamo ricevuto il tuo messaggio e ti risponderemo al più presto.</MessaggioSuccesso>}
            {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="nome" className="label">Nome *</label>
                <input id="nome" className="input" autoComplete="name" required maxLength={200} value={form.nome} onChange={aggiorna('nome')} />
              </div>
              <div>
                <label htmlFor="telefono" className="label">Telefono</label>
                <input id="telefono" type="tel" className="input" autoComplete="tel" maxLength={50} value={form.telefono} onChange={aggiorna('telefono')} />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="label">Email *</label>
              <input id="email" type="email" className="input" autoComplete="email" required maxLength={320} value={form.email} onChange={aggiorna('email')} />
            </div>
            <div>
              <label htmlFor="messaggio" className="label">Messaggio *</label>
              <textarea
                id="messaggio"
                className="input min-h-36 resize-y"
                required
                maxLength={5000}
                placeholder="Che tipo di sito ti serve? Hai già un dominio? Tempistiche?"
                value={form.messaggio}
                onChange={aggiorna('messaggio')}
              />
            </div>
            <button type="submit" className="btn-primary w-full py-3 sm:w-auto sm:px-8" disabled={invio}>
              {invio ? <Spinner className="h-4 w-4" /> : <Icon name="mail" className="h-4 w-4" />}
              {invio ? 'Invio in corso…' : 'Invia messaggio'}
            </button>
            <p className="text-xs text-slate-500">Usiamo i tuoi dati solo per rispondere alla tua richiesta.</p>
          </form>
        </Reveal>
      </section>
    </>
  )
}
