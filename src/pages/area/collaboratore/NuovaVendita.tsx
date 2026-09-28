import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { Icon } from '../../../components/Icon'
import { ScaricaModello } from '../../../components/ScaricaModello'
import { IntestazionePagina, MessaggioErrore, Spinner } from '../../../components/ui'
import { ACCEPT_CONTRATTO, caricaContrattoFirmato, eliminaFile, MAX_MB_CONTRATTO } from '../../../lib/contratti'
import { oggiISO, parseNumero, TIPI_SITO } from '../../../lib/format'
import { messaggioErrore, supabase } from '../../../lib/supabase'

const VUOTO = {
  cliente_nome: '',
  cliente_codice: '',
  cliente_email: '',
  cliente_telefono: '',
  cliente_indirizzo: '',
  sito_nome: '',
  tipo_sito: '',
  dominio: '',
  prezzo: '',
  acconto: '',
  data_firma: oggiISO(),
  consegna_prevista: '',
  note: '',
}
type Campo = keyof typeof VUOTO

function Sezione({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="mb-4 font-semibold text-slate-900">{titolo}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export default function NuovaVendita() {
  const { profilo } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(VUOTO)
  const [files, setFiles] = useState<File[]>([])
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const campo = (k: Campo) => ({
    id: k,
    value: form[k],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })),
  })

  function aggiungiFile(lista: FileList | null) {
    if (!lista?.length) return
    setFiles((f) => [...f, ...Array.from(lista)].slice(0, 20))
  }

  async function invia(e: FormEvent) {
    e.preventDefault()
    setErrore(null)
    const prezzo = parseNumero(form.prezzo)
    const acconto = form.acconto.trim() ? parseNumero(form.acconto) : 0

    if (!form.cliente_nome.trim()) return setErrore('Inserisci il nome del cliente.')
    if (!form.sito_nome.trim()) return setErrore('Inserisci il nome del sito.')
    if (!Number.isFinite(prezzo) || prezzo < 0) return setErrore('Inserisci un prezzo valido.')
    if (!Number.isFinite(acconto) || acconto < 0) return setErrore("Inserisci un acconto valido (o lascialo vuoto).")
    if (acconto > prezzo) return setErrore("L'acconto non può superare il prezzo.")
    if (form.cliente_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.cliente_email.trim())) {
      return setErrore("L'email del cliente non è valida.")
    }
    if (!form.data_firma) return setErrore('Inserisci la data della firma.')
    if (files.length === 0) return setErrore('Carica il contratto firmato (PDF o foto delle pagine).')
    if (!profilo) return

    setInvio(true)
    let allegati: string[] = []
    try {
      allegati = await caricaContrattoFirmato(profilo.id, files)
      const { error } = await supabase.from('vendite').insert({
        collaboratore_id: profilo.id,
        cliente_nome: form.cliente_nome.trim(),
        cliente_codice: form.cliente_codice.trim(),
        cliente_email: form.cliente_email.trim(),
        cliente_telefono: form.cliente_telefono.trim(),
        cliente_indirizzo: form.cliente_indirizzo.trim(),
        sito_nome: form.sito_nome.trim(),
        tipo_sito: form.tipo_sito,
        dominio: form.dominio.trim(),
        prezzo: Math.round(prezzo * 100) / 100,
        acconto: Math.round(acconto * 100) / 100,
        data_firma: form.data_firma,
        consegna_prevista: form.consegna_prevista || null,
        note: form.note.trim(),
        allegati,
      })
      if (error) throw error
      navigate('/area/vendite', { replace: true, state: { inviata: true } })
    } catch (err) {
      await eliminaFile(allegati).catch(() => {})
      setErrore(messaggioErrore(err))
      setInvio(false)
    }
  }

  return (
    <>
      <Link to="/area/vendite" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
        <Icon name="arrowLeft" className="h-4 w-4" /> Le mie vendite
      </Link>
      <IntestazionePagina
        titolo="Sito venduto"
        sottotitolo="Compila i dati del cliente e dell'accordo, poi carica il contratto firmato."
        azioni={<ScaricaModello />}
      />

      <form onSubmit={invia} className="space-y-6" noValidate>
        <Sezione titolo="Cliente">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="cliente_nome">Nome e cognome o ragione sociale *</label>
            <input className="input" required maxLength={200} autoComplete="off" {...campo('cliente_nome')} />
          </div>
          <div>
            <label className="label" htmlFor="cliente_codice">Partita IVA o codice fiscale</label>
            <input className="input" maxLength={50} autoComplete="off" {...campo('cliente_codice')} />
          </div>
          <div>
            <label className="label" htmlFor="cliente_telefono">Telefono</label>
            <input className="input" type="tel" maxLength={50} autoComplete="off" {...campo('cliente_telefono')} />
          </div>
          <div>
            <label className="label" htmlFor="cliente_email">Email</label>
            <input className="input" type="email" maxLength={320} autoComplete="off" {...campo('cliente_email')} />
          </div>
          <div>
            <label className="label" htmlFor="cliente_indirizzo">Indirizzo / sede</label>
            <input className="input" maxLength={300} autoComplete="off" {...campo('cliente_indirizzo')} />
          </div>
        </Sezione>

        <Sezione titolo="Sito">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="sito_nome">Nome del sito / progetto *</label>
            <input className="input" required maxLength={200} placeholder="es. Pizzeria Da Mario" {...campo('sito_nome')} />
          </div>
          <div>
            <label className="label" htmlFor="tipo_sito">Tipo di sito</label>
            <select className="input" {...campo('tipo_sito')}>
              <option value="">Seleziona…</option>
              {TIPI_SITO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="dominio">Dominio (se già deciso)</label>
            <input className="input" maxLength={300} placeholder="es. pizzeriadamario.it" {...campo('dominio')} />
          </div>
        </Sezione>

        <Sezione titolo="Accordi">
          <div>
            <label className="label" htmlFor="prezzo">Prezzo concordato (€) *</label>
            <input className="input" inputMode="decimal" required placeholder="es. 1.500" {...campo('prezzo')} />
          </div>
          <div>
            <label className="label" htmlFor="acconto">Acconto già ricevuto (€)</label>
            <input className="input" inputMode="decimal" placeholder="0" {...campo('acconto')} />
          </div>
          <div>
            <label className="label" htmlFor="data_firma">Data firma *</label>
            <input className="input" type="date" required {...campo('data_firma')} />
          </div>
          <div>
            <label className="label" htmlFor="consegna_prevista">Consegna prevista</label>
            <input className="input" type="date" {...campo('consegna_prevista')} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="note">Note</label>
            <textarea className="input min-h-28 resize-y" maxLength={5000} placeholder="Richieste particolari, pagine da fare, scadenze, modalità di pagamento…" {...campo('note')} />
          </div>
        </Sezione>

        <section className="card p-5 sm:p-6">
          <h2 className="font-semibold text-slate-900">Contratto firmato *</h2>
          <p className="mt-1 text-sm text-slate-500">
            PDF oppure foto delle pagine (JPG, PNG, HEIC). Fino a 20 file, massimo {MAX_MB_CONTRATTO} MB ciascuno.
          </p>
          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-600 transition hover:border-brand-400 hover:bg-brand-50/40">
            <Icon name="upload" className="h-6 w-6 text-brand-600" />
            <span className="font-semibold text-slate-900">Scegli i file</span>
            <span className="text-xs text-slate-500">oppure scatta una foto dal telefono</span>
            <input
              type="file"
              className="sr-only"
              multiple
              accept={ACCEPT_CONTRATTO}
              onChange={(e) => {
                aggiungiFile(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
          {files.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Icon name="file" className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button type="button" className="btn-ghost p-1.5 text-red-600" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} aria-label={`Rimuovi ${f.name}`}>
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {errore && <MessaggioErrore>{errore}</MessaggioErrore>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link to="/area/vendite" className="btn-secondary">Annulla</Link>
          <button type="submit" className="btn-primary px-6" disabled={invio}>
            {invio ? <Spinner className="h-4 w-4" /> : <Icon name="check" className="h-4 w-4" />}
            {invio ? 'Invio in corso…' : 'Invia vendita'}
          </button>
        </div>
      </form>
    </>
  )
}
