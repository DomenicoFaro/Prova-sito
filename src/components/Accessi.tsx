import { useState, type FormEvent } from 'react'
import { eliminaAccesso, leggiAccessi, salvaAccesso } from '../lib/cassaforte'
import { formatData } from '../lib/format'
import { messaggioErrore } from '../lib/supabase'
import type { Accesso, DatiAccesso } from '../lib/types'
import { useQuery } from '../lib/useQuery'
import { Icon } from './Icon'
import { Caricamento, MessaggioErrore, Modale, Spinner, Vuoto } from './ui'

const SERVIZI = ['Google', 'Vercel', 'Supabase', 'Resend']
const VUOTO: DatiAccesso = { servizio: '', nome: '', cognome: '', data: '', email: '', password: '', link: '', note: '' }

/** Casella con password nascosta/visibile e copia. */
export function ValoreSegreto({ etichetta, valore, nascosto = false }: { etichetta: string; valore: string; nascosto?: boolean }) {
  const [visibile, setVisibile] = useState(!nascosto)
  const [copiato, setCopiato] = useState(false)
  if (!valore) return null
  async function copia() {
    try {
      await navigator.clipboard.writeText(valore)
      setCopiato(true)
      setTimeout(() => setCopiato(false), 1500)
    } catch {
      setVisibile(true)
    }
  }
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-slate-500">{etichetta}</dt>
        <dd className={`text-sm font-medium break-all whitespace-pre-line text-slate-900 ${nascosto ? 'font-mono' : ''}`}>{visibile ? valore : '••••••••••'}</dd>
      </div>
      {nascosto && (
        <button type="button" className="btn-ghost p-2" onClick={() => setVisibile((v) => !v)} aria-label={`${visibile ? 'Nascondi' : 'Mostra'} ${etichetta.toLowerCase()}`}>
          <Icon name={visibile ? 'ban' : 'eye'} className="h-4 w-4" />
        </button>
      )}
      <button type="button" className="btn-ghost p-2" onClick={copia} aria-label={`Copia ${etichetta.toLowerCase()}`} title="Copia">
        <Icon name={copiato ? 'check' : 'file'} className="h-4 w-4" />
      </button>
    </div>
  )
}

/** Elenco degli accessi di un cliente, già aperto con la sua chiave. */
export function Accessi({ clienteId, chiave, modificabile = false }: { clienteId: string; chiave: CryptoKey; modificabile?: boolean }) {
  const { dati, caricamento, errore, ricarica } = useQuery(() => leggiAccessi(clienteId, chiave), [clienteId, chiave])
  const [form, setForm] = useState<(DatiAccesso & { id?: string; altro: boolean }) | null>(null)
  const [daEliminare, setDaEliminare] = useState<Accesso | null>(null)
  const [salvataggio, setSalvataggio] = useState(false)
  const [erroreForm, setErroreForm] = useState<string | null>(null)

  function apri(a?: Accesso, servizio = '') {
    setErroreForm(null)
    setForm(a ? { ...VUOTO, ...a, altro: !SERVIZI.includes(a.servizio) } : { ...VUOTO, servizio, altro: !servizio })
  }

  async function salva(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const { id, altro: _altro, ...valori } = form
    if (!valori.servizio.trim()) return setErroreForm('Scrivi il nome del servizio.')
    setSalvataggio(true)
    try {
      await salvaAccesso(clienteId, chiave, { ...valori, servizio: valori.servizio.trim() }, id)
      setForm(null)
      ricarica()
    } catch (err) {
      setErroreForm(messaggioErrore(err))
    } finally {
      setSalvataggio(false)
    }
  }

  async function elimina() {
    if (!daEliminare) return
    try {
      await eliminaAccesso(daEliminare.id)
    } catch (err) {
      setErroreForm(messaggioErrore(err))
    }
    setDaEliminare(null)
    ricarica()
  }

  const campo = (nome: keyof DatiAccesso, etichetta: string, tipo = 'text') => (
    <div>
      <label className="label" htmlFor={`acc-${nome}`}>{etichetta}</label>
      <input
        id={`acc-${nome}`}
        type={tipo}
        className="input"
        autoComplete="off"
        value={form?.[nome] ?? ''}
        onChange={(e) => setForm((f) => f && { ...f, [nome]: e.target.value })}
      />
    </div>
  )

  return (
    <div className="space-y-4">
      {modificabile && (
        <div className="flex flex-wrap gap-2">
          {SERVIZI.map((s) => (
            <button key={s} type="button" className="btn-secondary py-1.5" onClick={() => apri(undefined, s)}>
              <Icon name="plus" className="h-4 w-4" /> {s}
            </button>
          ))}
          <button type="button" className="btn-secondary py-1.5" onClick={() => apri()}>
            <Icon name="plus" className="h-4 w-4" /> Altro
          </button>
        </div>
      )}

      {caricamento && !dati ? (
        <Caricamento />
      ) : errore ? (
        <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>
      ) : !dati?.length ? (
        <Vuoto icona="lock" titolo="Nessun accesso salvato" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {dati.map((a) => (
            <li key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="min-w-0 truncate font-semibold text-slate-900">{a.servizio}</h3>
                {modificabile && (
                  <div className="flex shrink-0">
                    <button type="button" className="btn-ghost p-2" onClick={() => apri(a)} aria-label={`Modifica ${a.servizio}`}>
                      <Icon name="edit" className="h-4 w-4" />
                    </button>
                    <button type="button" className="btn-ghost p-2 text-red-600" onClick={() => setDaEliminare(a)} aria-label={`Elimina ${a.servizio}`}>
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <dl className="mt-3 space-y-2">
                <ValoreSegreto etichetta="Nome e cognome" valore={[a.nome, a.cognome].filter(Boolean).join(' ')} />
                <ValoreSegreto etichetta="Data di nascita" valore={a.data ? formatData(a.data) : ''} />
                <ValoreSegreto etichetta="Email" valore={a.email} />
                <ValoreSegreto etichetta="Password" valore={a.password} nascosto />
                <ValoreSegreto etichetta="Indirizzo" valore={a.link} />
                <ValoreSegreto etichetta="Note" valore={a.note} />
              </dl>
            </li>
          ))}
        </ul>
      )}

      <Modale aperta={!!form} titolo={form?.id ? 'Modifica accesso' : 'Nuovo accesso'} onChiudi={() => setForm(null)}>
        {form && (
          <form onSubmit={salva} className="space-y-4">
            {erroreForm && <MessaggioErrore>{erroreForm}</MessaggioErrore>}
            {form.altro ? campo('servizio', 'Servizio (es. dominio, social, hosting)') : <p className="text-sm text-slate-600">Servizio: <strong>{form.servizio}</strong></p>}
            <div className="grid gap-4 sm:grid-cols-2">
              {campo('nome', 'Nome')}
              {campo('cognome', 'Cognome')}
            </div>
            {campo('data', 'Data di nascita', 'date')}
            {campo('email', 'Email o nome utente')}
            {campo('password', 'Password')}
            {campo('link', 'Indirizzo del servizio (facoltativo)')}
            <div>
              <label className="label" htmlFor="acc-note">Note</label>
              <textarea id="acc-note" rows={3} className="input" value={form.note} onChange={(e) => setForm((f) => f && { ...f, note: e.target.value })} />
            </div>
            <p className="text-xs text-slate-500">Vengono cifrati prima di essere salvati. Il cliente può leggerli con il suo codice.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setForm(null)}>Annulla</button>
              <button type="submit" className="btn-primary" disabled={salvataggio}>
                {salvataggio && <Spinner className="h-4 w-4" />} Salva
              </button>
            </div>
          </form>
        )}
      </Modale>

      <Modale aperta={!!daEliminare} titolo="Eliminare l'accesso?" onChiudi={() => setDaEliminare(null)}>
        <p className="text-sm text-slate-600"><strong>{daEliminare?.servizio}</strong> verrà eliminato. L'operazione non si può annullare.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDaEliminare(null)}>Annulla</button>
          <button className="btn-danger" onClick={elimina}>Elimina</button>
        </div>
      </Modale>
    </div>
  )
}
