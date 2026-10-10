import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { Icon } from '../../../components/Icon'
import { Screenshot } from '../../../components/Screenshot'
import { Caricamento, IntestazionePagina, MessaggioErrore, MessaggioSuccesso, Modale, Spinner } from '../../../components/ui'
import { ETICHETTE_STATO_PROGETTO, formatEuro, formatPercentuale, parseNumero } from '../../../lib/format'
import { BUCKET_SCREENSHOTS, caricaImmagine, messaggioErrore, supabase } from '../../../lib/supabase'
import type { Assegnazione, Profilo, Progetto, StatoProgetto } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

interface FormProgetto {
  nome: string
  cliente: string
  url: string
  categoria: string
  descrizione: string
  funzionalita: string
  tecnologie: string
  screenshot_url: string | null
  galleria: string[]
  prezzo_totale: string
  incassato: string
  data_consegna: string
  stato: StatoProgetto
  pubblico: boolean
  /** Chi gestisce il progetto ('' = l'admin). Il socio crea sempre per sé. */
  gestore_id: string
}

interface RigaAssegnazione {
  id?: string
  collaboratore_id: string
  percentuale: string
  ruolo_nel_progetto: string
}

const VUOTO: FormProgetto = {
  nome: '',
  cliente: '',
  url: '',
  categoria: '',
  descrizione: '',
  funzionalita: '',
  tecnologie: '',
  screenshot_url: null,
  galleria: [],
  prezzo_totale: '',
  incassato: '',
  data_consegna: '',
  stato: 'in_lavorazione',
  pubblico: false,
  gestore_id: '',
}

const righe = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
const numero = parseNumero

export default function AdminProgettoForm() {
  const { id } = useParams()
  const { profilo: io, isAdmin } = useAuth()
  const nuovo = !id
  const navigate = useNavigate()

  const [form, setForm] = useState<FormProgetto>(VUOTO)
  const [assegnazioni, setAssegnazioni] = useState<RigaAssegnazione[]>([])
  const [originali, setOriginali] = useState<Assegnazione[]>([])
  const [salvataggio, setSalvataggio] = useState(false)
  const [upload, setUpload] = useState<'screenshot' | 'galleria' | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [successo, setSuccesso] = useState<string | null>(null)
  const [confermaElimina, setConfermaElimina] = useState(false)

  const { dati, caricamento, errore: erroreCaricamento, ricarica } = useQuery(async () => {
    const collaboratori = await esegui<Profilo[]>(supabase.from('profiles').select('*').order('nome'))
    if (nuovo) return { collaboratori, progetto: null, assegnazioni: [] as Assegnazione[] }
    const [progetto, ass] = await Promise.all([
      esegui<Progetto | null>(supabase.from('progetti').select('*').eq('id', id).maybeSingle()),
      esegui<Assegnazione[]>(supabase.from('assegnazioni').select('*').eq('progetto_id', id).order('created_at')),
    ])
    return { collaboratori, progetto, assegnazioni: ass }
  }, [id])

  useEffect(() => {
    if (!dati) return
    const p = dati.progetto
    setForm(
      p
        ? {
            nome: p.nome,
            cliente: p.cliente,
            url: p.url ?? '',
            categoria: p.categoria,
            descrizione: p.descrizione,
            funzionalita: (p.funzionalita ?? []).join('\n'),
            tecnologie: (p.tecnologie ?? []).join('\n'),
            screenshot_url: p.screenshot_url,
            galleria: p.galleria ?? [],
            prezzo_totale: String(p.prezzo_totale ?? ''),
            incassato: String(p.incassato ?? ''),
            data_consegna: p.data_consegna ?? '',
            stato: p.stato,
            pubblico: p.pubblico,
            gestore_id: p.gestore_id ?? '',
          }
        : VUOTO,
    )
    setOriginali(dati.assegnazioni)
    setAssegnazioni(
      dati.assegnazioni.map((a) => ({
        id: a.id,
        collaboratore_id: a.collaboratore_id,
        percentuale: String(a.percentuale),
        ruolo_nel_progetto: a.ruolo_nel_progetto,
      })),
    )
  }, [dati])

  if (caricamento) return <Caricamento />
  if (erroreCaricamento) return <MessaggioErrore onRiprova={ricarica}>{erroreCaricamento}</MessaggioErrore>
  if (!nuovo && !dati?.progetto)
    return <MessaggioErrore>Progetto non trovato. <Link to="/area/admin/progetti" className="font-semibold underline">Torna ai progetti</Link></MessaggioErrore>

  const collaboratori = dati?.collaboratori ?? []
  const prezzoInserito = form.prezzo_totale.trim() ? numero(form.prezzo_totale) : 0
  const prezzo = Number.isFinite(prezzoInserito) ? prezzoInserito : 0
  const incassatoInserito = form.incassato.trim() ? numero(form.incassato) : 0
  const incassato = Number.isFinite(incassatoInserito) ? incassatoInserito : 0
  const sommaPerc = assegnazioni.reduce((s, a) => s + (numero(a.percentuale) || 0), 0)
  const oltre100 = sommaPerc > 100
  const margine = prezzo * (1 - Math.min(sommaPerc, 100) / 100)

  const set = <K extends keyof FormProgetto>(k: K, v: FormProgetto[K]) => setForm((f) => ({ ...f, [k]: v }))

  async function caricaScreenshot(files: FileList | null, tipo: 'screenshot' | 'galleria') {
    if (!files?.length) return
    setErrore(null)
    setUpload(tipo)
    try {
      const urls: string[] = []
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) throw new Error(`"${file.name}" supera i 5 MB.`)
        urls.push(await caricaImmagine(BUCKET_SCREENSHOTS, 'progetti', file))
      }
      if (tipo === 'screenshot') set('screenshot_url', urls[0])
      else set('galleria', [...form.galleria, ...urls])
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setUpload(null)
    }
  }

  function aggiungiAssegnazione() {
    const giaAssegnati = new Set(assegnazioni.map((a) => a.collaboratore_id))
    const libero = collaboratori.find((c) => c.attivo && c.ruolo === 'collaboratore' && !giaAssegnati.has(c.id))
      ?? collaboratori.find((c) => c.attivo && !giaAssegnati.has(c.id))
    if (!libero) return setErrore('Tutti i collaboratori attivi sono già assegnati a questo progetto.')
    const restante = Math.max(0, 100 - sommaPerc)
    const perc = Math.min(Number(libero.percentuale_default) || 0, restante)
    setAssegnazioni((a) => [...a, { collaboratore_id: libero.id, percentuale: String(perc), ruolo_nel_progetto: '' }])
  }

  function aggiornaAssegnazione(i: number, patch: Partial<RigaAssegnazione>) {
    setAssegnazioni((arr) => arr.map((a, j) => (j === i ? { ...a, ...patch } : a)))
  }

  async function salva(e: FormEvent) {
    e.preventDefault()
    setErrore(null)
    setSuccesso(null)

    if (!form.nome.trim()) return setErrore('Il nome del progetto è obbligatorio.')
    if (!Number.isFinite(prezzoInserito) || prezzoInserito < 0) return setErrore('Prezzo non valido.')
    if (isAdmin && (!Number.isFinite(incassatoInserito) || incassatoInserito < 0)) return setErrore('Importo incassato non valido.')
    if (isAdmin && incassatoInserito > prezzoInserito) return setErrore("L'importo incassato non può superare il prezzo totale.")
    let url = form.url.trim()
    if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`
    if (url && !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(url)) return setErrore('URL del sito non valido (es. https://www.esempio.it).')
    if (oltre100) return setErrore(`La somma delle percentuali è ${formatPercentuale(sommaPerc)}: non può superare il 100%.`)
    const ids = assegnazioni.map((a) => a.collaboratore_id)
    if (new Set(ids).size !== ids.length) return setErrore('Lo stesso collaboratore è assegnato più volte.')
    for (const a of assegnazioni) {
      const p = numero(a.percentuale)
      if (!Number.isFinite(p) || p <= 0 || p > 100) return setErrore('Ogni percentuale deve essere maggiore di 0 e al massimo 100.')
    }

    setSalvataggio(true)
    try {
      const payload = {
        nome: form.nome.trim(),
        cliente: form.cliente.trim(),
        url: url || null,
        categoria: form.categoria.trim(),
        descrizione: form.descrizione.trim(),
        funzionalita: righe(form.funzionalita),
        tecnologie: righe(form.tecnologie),
        screenshot_url: form.screenshot_url,
        galleria: form.galleria,
        prezzo_totale: prezzo,
        // I soldi incassati li gestisce solo l'admin
        ...(isAdmin ? { incassato } : {}),
        data_consegna: form.data_consegna || null,
        stato: form.stato,
        pubblico: form.pubblico,
        // Il socio crea per sé; l'admin sceglie (nel DB, null = admin)
        ...(isAdmin ? { gestore_id: form.gestore_id || null } : nuovo ? { gestore_id: io?.id ?? null } : {}),
      }

      let progettoId = id
      if (nuovo) {
        const creato = await esegui<{ id: string }>(supabase.from('progetti').insert(payload).select('id').single())
        progettoId = creato.id
      } else {
        await esegui(supabase.from('progetti').update(payload).eq('id', id!))
      }

      // Sincronizza le assegnazioni. Ordine: eliminazioni, riduzioni, aumenti, nuove —
      // così la somma non supera mai il 100% nei passaggi intermedi (c'è un vincolo nel DB).
      const tenuti = new Set(assegnazioni.filter((a) => a.id).map((a) => a.id))
      const daEliminare = originali.filter((o) => !tenuti.has(o.id)).map((o) => o.id)
      if (daEliminare.length) await esegui(supabase.from('assegnazioni').delete().in('id', daEliminare))

      const esistenti = assegnazioni
        .filter((a) => a.id)
        .map((a) => ({ a, delta: numero(a.percentuale) - Number(originali.find((o) => o.id === a.id)?.percentuale ?? 0) }))
        .sort((x, y) => x.delta - y.delta)
      for (const { a } of esistenti) {
        await esegui(
          supabase
            .from('assegnazioni')
            .update({ collaboratore_id: a.collaboratore_id, percentuale: numero(a.percentuale), ruolo_nel_progetto: a.ruolo_nel_progetto.trim() })
            .eq('id', a.id!),
        )
      }
      const nuove = assegnazioni.filter((a) => !a.id)
      if (nuove.length) {
        await esegui(
          supabase.from('assegnazioni').insert(
            nuove.map((a) => ({
              progetto_id: progettoId,
              collaboratore_id: a.collaboratore_id,
              percentuale: numero(a.percentuale),
              ruolo_nel_progetto: a.ruolo_nel_progetto.trim(),
            })),
          ),
        )
      }

      if (nuovo) {
        navigate(`/area/admin/progetti/${progettoId}`, { replace: true })
      } else {
        setSuccesso('Progetto salvato.')
        ricarica()
      }
    } catch (err) {
      setErrore(messaggioErrore(err))
    } finally {
      setSalvataggio(false)
    }
  }

  async function elimina() {
    setErrore(null)
    const { error } = await supabase.from('progetti').delete().eq('id', id!)
    if (error) {
      setConfermaElimina(false)
      return setErrore(messaggioErrore(error))
    }
    navigate('/area/admin/progetti', { replace: true })
  }

  return (
    <>
      <Link to="/area/admin/progetti" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
        <Icon name="arrowLeft" className="h-4 w-4" /> Progetti
      </Link>
      <IntestazionePagina
        titolo={nuovo ? 'Nuovo progetto' : form.nome || 'Modifica progetto'}
        azioni={
          !nuovo && (
            <button type="button" className="btn-secondary text-red-600 hover:border-red-200 hover:bg-red-50" onClick={() => setConfermaElimina(true)}>
              <Icon name="trash" className="h-4 w-4" /> Elimina
            </button>
          )
        }
      />

      <form onSubmit={salva} className="space-y-6">
        {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
        {successo && <MessaggioSuccesso>{successo}</MessaggioSuccesso>}

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="card space-y-4 p-5 sm:p-6 xl:col-span-2">
            <h2 className="font-semibold text-slate-900">Dati del progetto</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="nome">Nome *</label>
                <input id="nome" className="input" required value={form.nome} onChange={(e) => set('nome', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="cliente">Cliente</label>
                <input id="cliente" className="input" value={form.cliente} onChange={(e) => set('cliente', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="url">URL del sito</label>
                <input id="url" type="url" className="input" placeholder="https://…" value={form.url} onChange={(e) => set('url', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="categoria">Categoria</label>
                <input id="categoria" className="input" list="categorie" placeholder="es. Ristorazione" value={form.categoria} onChange={(e) => set('categoria', e.target.value)} />
                <datalist id="categorie">
                  {['Ristorazione', 'Beauty', 'E-commerce', 'Servizi', 'Turismo', 'Web app'].map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="label" htmlFor="prezzo">Prezzo totale (€)</label>
                <input id="prezzo" inputMode="decimal" className="input" placeholder="0,00" value={form.prezzo_totale} onChange={(e) => set('prezzo_totale', e.target.value)} />
              </div>
              {isAdmin && (
                <div>
                  <label className="label" htmlFor="incassato">Già incassato (€)</label>
                  <input id="incassato" inputMode="decimal" className="input" placeholder="0,00" value={form.incassato} onChange={(e) => set('incassato', e.target.value)} />
                  <p className="mt-1 text-xs text-slate-500">
                    Soldi già ricevuti dal cliente. Ancora da incassare: <strong className="tabular-nums">{formatEuro(Math.max(0, prezzo - incassato))}</strong>
                  </p>
                </div>
              )}
              <div>
                <label className="label" htmlFor="data">Data consegna</label>
                <input id="data" type="date" className="input" value={form.data_consegna} onChange={(e) => set('data_consegna', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="stato">Stato</label>
                <select id="stato" className="input" value={form.stato} onChange={(e) => set('stato', e.target.value as StatoProgetto)}>
                  {Object.entries(ETICHETTE_STATO_PROGETTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-slate-200 px-3.5 py-2.5">
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.pubblico} onChange={(e) => set('pubblico', e.target.checked)} />
                <span className="text-sm font-medium text-slate-700">Mostra nel portfolio pubblico</span>
              </label>
              {isAdmin && (
                <div>
                  <label className="label" htmlFor="gestore">Team</label>
                  <select id="gestore" className="input" value={form.gestore_id} onChange={(e) => set('gestore_id', e.target.value)}>
                    <option value="">Il mio team</option>
                    {collaboratori.filter((c) => c.ruolo === 'socio' && c.attivo).map((c) => (
                      <option key={c.id} value={c.id}>Team di {c.nome}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="label" htmlFor="descrizione">Descrizione</label>
              <textarea id="descrizione" className="input min-h-28" value={form.descrizione} onChange={(e) => set('descrizione', e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="funz">Funzionalità realizzate <span className="font-normal text-slate-400">(una per riga)</span></label>
                <textarea id="funz" className="input min-h-28" value={form.funzionalita} onChange={(e) => set('funzionalita', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="tech">Tecnologie <span className="font-normal text-slate-400">(una per riga)</span></label>
                <textarea id="tech" className="input min-h-28" value={form.tecnologie} onChange={(e) => set('tecnologie', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="card space-y-4 p-5 sm:p-6">
            <h2 className="font-semibold text-slate-900">Screenshot</h2>
            <div className="aspect-[16/10] overflow-hidden rounded-xl border border-slate-200">
              <Screenshot src={form.screenshot_url} nome={form.nome || 'Anteprima'} url={form.url} />
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="btn-secondary cursor-pointer">
                {upload === 'screenshot' ? <Spinner className="h-4 w-4" /> : <Icon name="upload" className="h-4 w-4" />}
                {form.screenshot_url ? 'Sostituisci' : 'Carica'}
                <input type="file" accept="image/*" className="sr-only" disabled={!!upload} onChange={(e) => caricaScreenshot(e.target.files, 'screenshot')} />
              </label>
              {form.screenshot_url && (
                <button type="button" className="btn-ghost" onClick={() => set('screenshot_url', null)}>Rimuovi</button>
              )}
            </div>

            <h3 className="pt-2 text-sm font-semibold text-slate-700">Galleria (pagina di dettaglio)</h3>
            {form.galleria.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {form.galleria.map((g) => (
                  <div key={g} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200">
                    <img src={g} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => set('galleria', form.galleria.filter((x) => x !== g))}
                      className="absolute top-1 right-1 rounded-md bg-white/90 p-1 text-red-600 shadow"
                      aria-label="Rimuovi immagine"
                    >
                      <Icon name="close" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="btn-secondary w-full cursor-pointer">
              {upload === 'galleria' ? <Spinner className="h-4 w-4" /> : <Icon name="plus" className="h-4 w-4" />}
              Aggiungi immagini
              <input type="file" accept="image/*" multiple className="sr-only" disabled={!!upload} onChange={(e) => caricaScreenshot(e.target.files, 'galleria')} />
            </label>
          </section>
        </div>

        <section className="card p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Collaboratori assegnati</h2>
              <p className="text-sm text-slate-500">La parte non assegnata è il margine dell'agenzia.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={aggiungiAssegnazione}>
              <Icon name="plus" className="h-4 w-4" /> Assegna collaboratore
            </button>
          </div>

          {assegnazioni.length > 0 && (
            <div className="mt-4 space-y-3">
              {assegnazioni.map((a, i) => {
                const perc = numero(a.percentuale) || 0
                return (
                  <div key={a.id ?? `nuova-${i}`} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-12 sm:items-end">
                    <div className="sm:col-span-4">
                      <label className="label text-xs">Collaboratore</label>
                      <select
                        className="input"
                        value={a.collaboratore_id}
                        onChange={(e) => {
                          const c = collaboratori.find((x) => x.id === e.target.value)
                          aggiornaAssegnazione(i, { collaboratore_id: e.target.value, ...(c && !a.id ? { percentuale: String(c.percentuale_default) } : {}) })
                        }}
                      >
                        {collaboratori
                          .filter((c) => c.attivo || c.id === a.collaboratore_id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}{c.ruolo === 'admin' ? ' (admin)' : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label text-xs">Percentuale</label>
                      <div className="relative">
                        <input inputMode="decimal" className="input pr-8" value={a.percentuale} onChange={(e) => aggiornaAssegnazione(i, { percentuale: e.target.value })} />
                        <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-slate-400">%</span>
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="label text-xs">Ruolo nel progetto</label>
                      <input className="input" placeholder="es. Sviluppo" value={a.ruolo_nel_progetto} onChange={(e) => aggiornaAssegnazione(i, { ruolo_nel_progetto: e.target.value })} />
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:col-span-3">
                      <div>
                        <p className="text-xs text-slate-500">Guadagno</p>
                        <p className="font-semibold tabular-nums">{formatEuro((prezzo * perc) / 100)}</p>
                      </div>
                      <button type="button" className="btn-ghost p-2 text-red-600" onClick={() => setAssegnazioni((arr) => arr.filter((_, j) => j !== i))} aria-label="Rimuovi assegnazione">
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className={`mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl p-3 text-sm ${oltre100 ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-600'}`}>
            {oltre100 && <Icon name="alert" className="h-5 w-5" />}
            <span>Totale assegnato: <strong className="tabular-nums">{formatPercentuale(sommaPerc)}</strong></span>
            <span>Margine agenzia: <strong className="tabular-nums">{formatPercentuale(Math.max(0, 100 - sommaPerc))}</strong> · <strong className="tabular-nums">{formatEuro(margine)}</strong></span>
            {oltre100 && <span className="font-semibold">Attenzione: la somma delle percentuali supera il 100%.</span>}
          </div>
        </section>

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Link to="/area/admin/progetti" className="btn-secondary">Annulla</Link>
          <button type="submit" className="btn-primary" disabled={salvataggio || !!upload || oltre100}>
            {salvataggio && <Spinner className="h-4 w-4" />} {nuovo ? 'Crea progetto' : 'Salva modifiche'}
          </button>
        </div>
      </form>

      <Modale aperta={confermaElimina} titolo="Eliminare il progetto?" onChiudi={() => setConfermaElimina(false)}>
        <p className="text-sm text-slate-600">
          Verranno eliminati anche le assegnazioni e i pagamenti registrati per <strong>{form.nome}</strong>. L'operazione non è reversibile.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setConfermaElimina(false)}>Annulla</button>
          <button className="btn-danger" onClick={elimina}>Elimina definitivamente</button>
        </div>
      </Modale>
    </>
  )
}
