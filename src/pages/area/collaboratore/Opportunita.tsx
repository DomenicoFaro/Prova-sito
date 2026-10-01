import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../../../auth/AuthProvider'
import { Icon } from '../../../components/Icon'
import {
  BadgeEsitoOpportunita,
  Caricamento,
  IntestazionePagina,
  MessaggioErrore,
  Modale,
  Spinner,
  Vuoto,
} from '../../../components/ui'
import { messaggioErrore, supabase } from '../../../lib/supabase'
import type { EsitoOpportunita, EsitoOpportunitaRiga, Opportunita as OpportunitaRiga, OpportunitaPresa } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

interface FormLink {
  nome: string
  maps_url: string
  categoria: string
  indirizzo: string
  dettagli: string
}

/** Tempo rimasto in formato "3h 20m". */
function tempoRimasto(scadenza: string, adesso: number): string {
  const min = Math.max(0, Math.ceil((new Date(scadenza).getTime() - adesso) / 60000))
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`
}

const FORM_VUOTO: FormLink = { nome: '', maps_url: '', categoria: '', indirizzo: '', dettagli: '' }

export default function Opportunita() {
  const { profilo } = useAuth()
  const [inCorso, setInCorso] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [modale, setModale] = useState(false)
  const [inModifica, setInModifica] = useState<OpportunitaRiga | null>(null)
  const [form, setForm] = useState<FormLink>(FORM_VUOTO)
  const [salvataggio, setSalvataggio] = useState(false)
  const [erroreForm, setErroreForm] = useState<string | null>(null)
  const [daEliminare, setDaEliminare] = useState<OpportunitaRiga | null>(null)

  const { dati, caricamento, errore: erroreCaricamento, ricarica } = useQuery(async () => {
    const [opportunita, esiti, prese] = await Promise.all([
      esegui<OpportunitaRiga[]>(supabase.from('opportunita').select('*').order('created_at', { ascending: false })),
      esegui<EsitoOpportunitaRiga[]>(supabase.from('opportunita_esiti').select('*').eq('collaboratore_id', profilo?.id ?? '')),
      esegui<OpportunitaPresa[]>(supabase.from('opportunita_prese').select('*').eq('collaboratore_id', profilo?.id ?? '')),
    ])
    return { opportunita, esiti, prese }
  }, [profilo?.id])

  // Orologio: aggiorna il conto alla rovescia e allo scadere ricarica la lista
  const [adesso, setAdesso] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAdesso(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const prese = useMemo(() => new Map((dati?.prese ?? []).map((p) => [p.opportunita_id, p])), [dati])

  const esiti = useMemo(() => new Map((dati?.esiti ?? []).map((e) => [e.opportunita_id, e.esito])), [dati])

  /** Presa in carico ancora valida (non scaduta e senza risposta). */
  const inCaricoOra = useMemo(
    () => (dati?.prese ?? []).find((p) => new Date(p.scade_il).getTime() > adesso && !esiti.has(p.opportunita_id)) ?? null,
    [dati, esiti, adesso],
  )

  // Allo scadere delle 12 ore aggiorna la pagina (l'opportunità torna agli altri)
  const scadenzaInCarico = inCaricoOra?.scade_il
  useEffect(() => {
    if (!scadenzaInCarico) return
    const ms = Math.min(new Date(scadenzaInCarico).getTime() - Date.now() + 1000, 2_000_000_000)
    const t = setTimeout(() => {
      setAdesso(Date.now())
      ricarica()
    }, Math.max(ms, 0))
    return () => clearTimeout(t)
  }, [scadenzaInCarico, ricarica])

  async function prendi(o: OpportunitaRiga) {
    setErrore(null)
    setInCorso(o.id)
    const { error } = await supabase.rpc('prendi_in_carico', { p_opp: o.id })
    setInCorso(null)
    if (error) setErrore(messaggioErrore(error))
    ricarica()
  }

  function apri(o?: OpportunitaRiga) {
    setErroreForm(null)
    setInModifica(o ?? null)
    setForm(o ? { nome: o.nome, maps_url: o.maps_url, categoria: o.categoria, indirizzo: o.indirizzo, dettagli: o.dettagli } : FORM_VUOTO)
    setModale(true)
  }

  async function salva(e: FormEvent) {
    e.preventDefault()
    if (!profilo) return
    setErroreForm(null)
    const valori = {
      nome: form.nome.trim(),
      maps_url: form.maps_url.trim(),
      categoria: form.categoria.trim(),
      indirizzo: form.indirizzo.trim(),
      dettagli: form.dettagli.trim(),
    }
    if (!valori.nome) return setErroreForm("Inserisci il nome dell'attività.")
    if (!/^https?:\/\//i.test(valori.maps_url)) return setErroreForm('Inserisci un link valido (deve iniziare con https://).')
    setSalvataggio(true)
    const { error } = inModifica
      ? await supabase.from('opportunita').update(valori).eq('id', inModifica.id)
      : await supabase.from('opportunita').insert({ ...valori, owner_id: profilo.id })
    setSalvataggio(false)
    if (error) return setErroreForm(messaggioErrore(error))
    setModale(false)
    ricarica()
  }

  async function elimina() {
    if (!daEliminare) return
    const { error } = await supabase.from('opportunita').delete().eq('id', daEliminare.id)
    setDaEliminare(null)
    if (error) return setErrore(messaggioErrore(error))
    ricarica()
  }

  /** Salva l'esito; sui propri link premendo di nuovo lo stesso tasto lo annulla. */
  async function segna(o: OpportunitaRiga, esito: EsitoOpportunita) {
    if (!profilo) return
    setErrore(null)
    setInCorso(o.id)
    const { error } =
      esiti.get(o.id) === esito && o.owner_id
        ? await supabase.from('opportunita_esiti').delete().eq('opportunita_id', o.id).eq('collaboratore_id', profilo.id)
        : await supabase
            .from('opportunita_esiti')
            .upsert({ opportunita_id: o.id, collaboratore_id: profilo.id, esito, updated_at: new Date().toISOString() })
    setInCorso(null)
    if (error) return setErrore(messaggioErrore(error))
    ricarica()
  }

  return (
    <>
      <IntestazionePagina
        titolo="Opportunità"
        sottotitolo="Attività con alta vendibilità scelte per te. Aprile su Google Maps e segna com'è andata. Prendi in carico un'opportunità alla volta: hai 12 ore per rispondere, poi torna disponibile per gli altri. Puoi aggiungere anche i tuoi link: li vedi solo tu."
        azioni={
          <button className="btn-primary" onClick={() => apri()}>
            <Icon name="plus" className="h-4 w-4" /> Aggiungi link
          </button>
        }
      />

      {caricamento && !dati ? (
        <Caricamento />
      ) : erroreCaricamento ? (
        <MessaggioErrore onRiprova={ricarica}>{erroreCaricamento}</MessaggioErrore>
      ) : !dati?.opportunita.length ? (
        <div className="card">
          <Vuoto icona="pin" titolo="Nessuna opportunità al momento">
            Quando l'amministratore ne aggiunge una, la trovi qui. Puoi anche aggiungere i tuoi link con <strong>Aggiungi link</strong>.
          </Vuoto>
        </div>
      ) : (
        <div className="space-y-4">
          {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
          <ul className="grid gap-4 lg:grid-cols-2">
            {dati.opportunita.map((o) => {
              const esito = esiti.get(o.id) ?? null
              const occupato = inCorso === o.id
              const presa = prese.get(o.id)
              const presaValida = !!presa && new Date(presa.scade_il).getTime() > adesso
              const scaduta = !!presa && !presaValida && !esito
              const puoRispondere = !!o.owner_id || presaValida
              return (
                <li key={o.id} className="card flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{o.nome}</p>
                      <p className="truncate text-sm text-slate-500">
                        {[o.categoria, o.indirizzo].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {o.owner_id && (
                        <>
                          <span className="mr-1 text-xs font-semibold text-brand-700">Tuo</span>
                          <button className="btn-ghost p-2" onClick={() => apri(o)} aria-label="Modifica link">
                            <Icon name="edit" className="h-4 w-4" />
                          </button>
                          <button className="btn-ghost p-2 text-red-600" onClick={() => setDaEliminare(o)} aria-label="Elimina link">
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {scaduta ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Scaduta</span>
                      ) : presaValida && !esito ? (
                        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                          In carico · {tempoRimasto(presa.scade_il, adesso)}
                        </span>
                      ) : (
                        <BadgeEsitoOpportunita esito={esito} />
                      )}
                    </div>
                  </div>
                  {o.dettagli && <p className="mt-3 text-sm whitespace-pre-line text-slate-700">{o.dettagli}</p>}
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <a href={o.maps_url} target="_blank" rel="noopener noreferrer" className="btn-secondary py-1.5">
                      <Icon name="pin" className="h-4 w-4" /> Google Maps
                    </a>
                    {!o.owner_id && !presa && (
                      <button
                        className="btn-primary py-1.5"
                        disabled={occupato || !!inCaricoOra}
                        title={inCaricoOra ? 'Hai già un\'opportunità in carico' : undefined}
                        onClick={() => prendi(o)}
                      >
                        {occupato ? <Spinner className="h-4 w-4" /> : <Icon name="check" className="h-4 w-4" />} Prendi in carico
                      </button>
                    )}
                    {puoRispondere && (
                      <>
                    <button
                      className={`btn-secondary py-1.5 ${esito === 'venduto' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : ''}`}
                      disabled={occupato}
                      aria-pressed={esito === 'venduto'}
                      onClick={() => segna(o, 'venduto')}
                    >
                      {occupato ? <Spinner className="h-4 w-4" /> : <Icon name="check" className="h-4 w-4" />} Venduto
                    </button>
                    <button
                      className={`btn-secondary py-1.5 ${esito === 'interessato' ? 'border-amber-300 bg-amber-50 text-amber-700' : ''}`}
                      disabled={occupato}
                      aria-pressed={esito === 'interessato'}
                      onClick={() => segna(o, 'interessato')}
                    >
                      {occupato ? <Spinner className="h-4 w-4" /> : <Icon name="handshake" className="h-4 w-4" />} Interessato
                    </button>
                    <button
                      className={`btn-secondary py-1.5 ${esito === 'non_interessato' ? 'border-red-300 bg-red-50 text-red-700' : ''}`}
                      disabled={occupato}
                      aria-pressed={esito === 'non_interessato'}
                      onClick={() => segna(o, 'non_interessato')}
                    >
                      {occupato ? <Spinner className="h-4 w-4" /> : <Icon name="ban" className="h-4 w-4" />} Non interessato
                    </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <Modale aperta={modale} titolo={inModifica ? 'Modifica link' : 'Aggiungi un tuo link'} onChiudi={() => setModale(false)}>
        <form onSubmit={salva} className="space-y-4">
          {erroreForm && <MessaggioErrore>{erroreForm}</MessaggioErrore>}
          <div>
            <label className="label" htmlFor="cn">Nome attività</label>
            <input id="cn" className="input" placeholder="es. Pizzeria Da Mario" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="cm">Link Google Maps</label>
            <input id="cm" type="url" className="input" placeholder="https://maps.app.goo.gl/…" value={form.maps_url} onChange={(e) => setForm((f) => ({ ...f, maps_url: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="cc">Categoria</label>
              <input id="cc" className="input" placeholder="es. Ristorante" value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="ci">Zona / indirizzo</label>
              <input id="ci" className="input" value={form.indirizzo} onChange={(e) => setForm((f) => ({ ...f, indirizzo: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="cd">Dettagli</label>
            <textarea id="cd" rows={4} className="input" value={form.dettagli} onChange={(e) => setForm((f) => ({ ...f, dettagli: e.target.value }))} />
          </div>
          <p className="text-xs text-slate-500">Questo link lo vedi solo tu (e l'amministratore).</p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModale(false)}>Annulla</button>
            <button type="submit" className="btn-primary" disabled={salvataggio}>
              {salvataggio && <Spinner className="h-4 w-4" />} Salva
            </button>
          </div>
        </form>
      </Modale>

      <Modale aperta={!!daEliminare} titolo="Eliminare il link?" onChiudi={() => setDaEliminare(null)}>
        <p className="text-sm text-slate-600"><strong>{daEliminare?.nome}</strong> verrà eliminato.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDaEliminare(null)}>Annulla</button>
          <button className="btn-danger" onClick={elimina}>Elimina</button>
        </div>
      </Modale>
    </>
  )
}
