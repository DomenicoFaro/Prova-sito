import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Seo } from '../../components/Seo'
import { MessaggioErrore, Spinner } from '../../components/ui'
import { TIPI_SITO } from '../../lib/format'
import { FUNZIONALITA_SITO, ordiniSalvati, PAGINE_SITO, salvaOrdine } from '../../lib/ordini'
import { messaggioErrore, supabase } from '../../lib/supabase'

function Campo({ etichetta, children, nota }: { etichetta: string; children: ReactNode; nota?: string }) {
  return (
    <label className="block">
      <span className="label">{etichetta}</span>
      {children}
      {nota && <span className="mt-1 block text-xs text-slate-500">{nota}</span>}
    </label>
  )
}

export default function SitoSuMisura() {
  const navigate = useNavigate()
  const [funzionalita, setFunzionalita] = useState<string[]>([])
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const precedenti = ordiniSalvati()

  function attiva(f: string) {
    setFunzionalita((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]))
  }

  async function invia(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    if (f.get('sito_web')) return // campo esca per i bot
    const v = (k: string) => String(f.get(k) ?? '').trim()
    setErrore(null)
    setInvio(true)
    try {
      const { data, error } = await supabase.rpc('crea_richiesta_sito', {
        p: {
          cliente_nome: v('cliente_nome'),
          cliente_email: v('cliente_email'),
          cliente_telefono: v('cliente_telefono'),
          cliente_codice: v('cliente_codice'),
          cliente_indirizzo: v('cliente_indirizzo'),
          tipo_sito: v('tipo_sito'),
          nome_attivita: v('nome_attivita'),
          pagine: v('pagine'),
          funzionalita,
          lingue: v('lingue'),
          dominio: v('dominio'),
          stile: v('stile'),
          descrizione: v('descrizione'),
          scadenza: v('scadenza'),
          budget: v('budget'),
        },
      })
      if (error) throw error
      const token = String(data)
      salvaOrdine({ token, nome: v('nome_attivita') || v('tipo_sito') || 'Il mio sito', data: new Date().toISOString() })
      navigate(`/ordine/${token}?nuovo=1`)
    } catch (err) {
      setErrore(messaggioErrore(err))
      setInvio(false)
    }
  }

  return (
    <>
      <Seo titolo="Richiedi il tuo sito" />
      <section className="bg-black pt-10 pb-12 text-center text-white">
        <div className="container-sito">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Il tuo sito, su misura</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            Descrivici cosa ti serve: ti rispondiamo con un preventivo. Se ti convince leggi il contratto, accetti e paghi online in
            pochi minuti.
          </p>
          <ol className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-300">
            <li>1. Compili la richiesta</li>
            <li>2. Ricevi il preventivo</li>
            <li>3. Accetti il contratto e paghi</li>
            <li>4. Ricevi il contratto firmato</li>
          </ol>
        </div>
      </section>

      <div className="container-sito py-10">
        {precedenti.length > 0 && (
          <div className="card mx-auto mb-8 max-w-3xl p-5">
            <h2 className="font-semibold text-slate-900">Le tue richieste su questo dispositivo</h2>
            <ul className="mt-2 divide-y divide-slate-100">
              {precedenti.map((o) => (
                <li key={o.token} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="truncate text-slate-700">{o.nome}</span>
                  <Link to={`/ordine/${o.token}`} className="font-semibold text-brand-600 hover:underline">
                    Apri
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={invia} className="mx-auto max-w-3xl space-y-8" noValidate={false}>
          {/* Esca anti-bot: i visitatori non la vedono */}
          <input name="sito_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

          <fieldset className="card space-y-4 p-5 sm:p-6">
            <legend className="sr-only">I tuoi dati</legend>
            <h2 className="text-lg font-bold text-slate-900">1. I tuoi dati</h2>
            <p className="-mt-2 text-sm text-slate-500">Compaiono nel contratto, quindi inseriscili esattamente come devono risultare.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etichetta="Nome e cognome / ragione sociale *">
                <input name="cliente_nome" required maxLength={200} className="input" autoComplete="name" />
              </Campo>
              <Campo etichetta="Email *">
                <input name="cliente_email" type="email" required maxLength={320} className="input" autoComplete="email" />
              </Campo>
              <Campo etichetta="Telefono">
                <input name="cliente_telefono" type="tel" maxLength={50} className="input" autoComplete="tel" />
              </Campo>
              <Campo etichetta="Codice fiscale o P.IVA *">
                <input name="cliente_codice" required minLength={5} maxLength={50} className="input" />
              </Campo>
            </div>
            <Campo etichetta="Indirizzo di residenza o sede *">
              <input name="cliente_indirizzo" required minLength={5} maxLength={300} className="input" autoComplete="street-address" />
            </Campo>
          </fieldset>

          <fieldset className="card space-y-4 p-5 sm:p-6">
            <legend className="sr-only">Il sito</legend>
            <h2 className="text-lg font-bold text-slate-900">2. Il tuo sito</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etichetta="Tipo di sito *">
                <select name="tipo_sito" required defaultValue="" className="input">
                  <option value="" disabled>
                    Scegli…
                  </option>
                  {TIPI_SITO.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Campo>
              <Campo etichetta="Nome dell'attività / del progetto">
                <input name="nome_attivita" maxLength={200} className="input" />
              </Campo>
              <Campo etichetta="Quante pagine circa?">
                <select name="pagine" defaultValue="" className="input">
                  <option value="">Non so</option>
                  {PAGINE_SITO.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Campo>
              <Campo etichetta="Lingue del sito">
                <input name="lingue" maxLength={200} placeholder="Es. italiano, inglese" className="input" />
              </Campo>
            </div>

            <div>
              <span className="label">Funzionalità che ti servono</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {FUNZIONALITA_SITO.map((f) => (
                  <label
                    key={f}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition ${
                      funzionalita.includes(f) ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input type="checkbox" checked={funzionalita.includes(f)} onChange={() => attiva(f)} className="h-4 w-4 accent-brand-600" />
                    {f}
                  </label>
                ))}
              </div>
            </div>

            <Campo etichetta="Descrivi il sito che hai in mente *" nota="Cosa fa la tua attività, chi sono i clienti, cosa deve ottenere il sito.">
              <textarea name="descrizione" required minLength={10} maxLength={5000} rows={5} className="input" />
            </Campo>
            <Campo etichetta="Stile e siti che ti piacciono" nota="Colori, atmosfera, link a siti di riferimento.">
              <textarea name="stile" maxLength={2000} rows={3} className="input" />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo etichetta="Dominio (se ce l'hai)">
                <input name="dominio" maxLength={300} placeholder="miosito.it" className="input" />
              </Campo>
              <Campo etichetta="Entro quando ti serve?">
                <input name="scadenza" maxLength={200} placeholder="Es. entro fine mese" className="input" />
              </Campo>
              <Campo etichetta="Budget indicativo">
                <input name="budget" maxLength={200} placeholder="Es. 500–800 €" className="input" />
              </Campo>
            </div>
          </fieldset>

          {errore && <MessaggioErrore>{errore}</MessaggioErrore>}

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-xs text-slate-500">
              Inviare la richiesta non ti impegna a nulla: riceverai un preventivo e deciderai tu se procedere.
            </p>
            <button type="submit" disabled={invio} className="btn-primary px-6 py-3 text-base">
              {invio ? <Spinner className="h-4 w-4" /> : <Icon name="arrowRight" className="h-4 w-4" />} Richiedi il preventivo
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
