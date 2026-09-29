import { useMemo, useState, type FormEvent } from 'react'
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
import { formatDataOra } from '../../../lib/format'
import { messaggioErrore, supabase } from '../../../lib/supabase'
import type { EsitoOpportunitaRiga, Opportunita, OpportunitaPresa, Profilo } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

interface FormOpportunita {
  nome: string
  maps_url: string
  categoria: string
  indirizzo: string
  dettagli: string
  attiva: boolean
}

const FORM_VUOTO: FormOpportunita = { nome: '', maps_url: '', categoria: '', indirizzo: '', dettagli: '', attiva: true }

export default function AdminOpportunita() {
  const [modale, setModale] = useState(false)
  const [inModifica, setInModifica] = useState<Opportunita | null>(null)
  const [form, setForm] = useState<FormOpportunita>(FORM_VUOTO)
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [daEliminare, setDaEliminare] = useState<Opportunita | null>(null)

  const { dati, caricamento, errore: erroreCaricamento, ricarica } = useQuery(async () => {
    const [opportunita, esiti, profili, prese] = await Promise.all([
      esegui<Opportunita[]>(supabase.from('opportunita').select('*').order('created_at', { ascending: false })),
      esegui<EsitoOpportunitaRiga[]>(supabase.from('opportunita_esiti').select('*').order('updated_at', { ascending: false })),
      esegui<Profilo[]>(supabase.from('profiles').select('*').order('nome')),
      esegui<OpportunitaPresa[]>(supabase.from('opportunita_prese').select('*').order('preso_il', { ascending: false })),
    ])
    return { opportunita, esiti, profili, prese }
  })

  const mappe = useMemo(() => {
    const profili = new Map((dati?.profili ?? []).map((p) => [p.id, p]))
    const esiti = new Map<string, EsitoOpportunitaRiga[]>()
    for (const e of dati?.esiti ?? []) esiti.set(e.opportunita_id, [...(esiti.get(e.opportunita_id) ?? []), e])
    const prese = new Map<string, OpportunitaPresa[]>()
    for (const p of dati?.prese ?? []) prese.set(p.opportunita_id, [...(prese.get(p.opportunita_id) ?? []), p])
    return { profili, esiti, prese }
  }, [dati])

  function apri(o?: Opportunita) {
    setErrore(null)
    setInModifica(o ?? null)
    setForm(o ? { nome: o.nome, maps_url: o.maps_url, categoria: o.categoria, indirizzo: o.indirizzo, dettagli: o.dettagli, attiva: o.attiva } : FORM_VUOTO)
    setModale(true)
  }

  async function salva(e: FormEvent) {
    e.preventDefault()
    setErrore(null)
    const valori = {
      nome: form.nome.trim(),
      maps_url: form.maps_url.trim(),
      categoria: form.categoria.trim(),
      indirizzo: form.indirizzo.trim(),
      dettagli: form.dettagli.trim(),
      attiva: form.attiva,
    }
    if (!valori.nome) return setErrore("Inserisci il nome dell'attività.")
    if (!/^https?:\/\//i.test(valori.maps_url)) return setErrore('Inserisci un link Google Maps valido (deve iniziare con https://).')
    setSalvataggio(true)
    const { error } = inModifica
      ? await supabase.from('opportunita').update(valori).eq('id', inModifica.id)
      : await supabase.from('opportunita').insert(valori)
    setSalvataggio(false)
    if (error) return setErrore(messaggioErrore(error))
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

  return (
    <>
      <IntestazionePagina
        titolo="Opportunità"
        sottotitolo="Attività con alta vendibilità da proporre ai collaboratori. Qui vedi anche i link che i collaboratori aggiungono da soli (visibili solo a loro)."
        azioni={
          <button className="btn-primary" onClick={() => apri()}>
            <Icon name="plus" className="h-4 w-4" /> Nuova opportunità
          </button>
        }
      />

      {caricamento ? (
        <Caricamento />
      ) : erroreCaricamento ? (
        <MessaggioErrore onRiprova={ricarica}>{erroreCaricamento}</MessaggioErrore>
      ) : (
        <div className="space-y-4">
          {errore && !modale && <MessaggioErrore>{errore}</MessaggioErrore>}
          {!dati?.opportunita.length ? (
            <div className="card">
              <Vuoto icona="pin" titolo="Nessuna opportunità">
                Premi <strong>Nuova opportunità</strong> e incolla il link Google Maps dell'attività.
              </Vuoto>
            </div>
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {dati.opportunita.map((o) => {
                const esiti = mappe.esiti.get(o.id) ?? []
                return (
                  <li key={o.id} className={`card p-5 ${o.attiva ? '' : 'opacity-60'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{o.nome}</p>
                        {o.owner_id && (
                          <p className="truncate text-xs font-semibold text-brand-700">
                            Aggiunta da {mappe.profili.get(o.owner_id)?.nome ?? 'un collaboratore'}
                          </p>
                        )}
                        <p className="truncate text-sm text-slate-500">
                          {[o.categoria, o.indirizzo].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {!o.attiva && <span className="mr-1 text-xs font-semibold text-slate-500">Nascosta</span>}
                        <button className="btn-ghost p-2" onClick={() => apri(o)} aria-label="Modifica opportunità">
                          <Icon name="edit" className="h-4 w-4" />
                        </button>
                        <button className="btn-ghost p-2 text-red-600" onClick={() => setDaEliminare(o)} aria-label="Elimina opportunità">
                          <Icon name="trash" className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {o.dettagli && <p className="mt-3 text-sm whitespace-pre-line text-slate-700">{o.dettagli}</p>}
                    <a href={o.maps_url} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-4 py-1.5">
                      <Icon name="pin" className="h-4 w-4" /> Apri su Google Maps
                    </a>
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Esiti collaboratori</p>
                      {esiti.length === 0 && !(mappe.prese.get(o.id)?.length) ? (
                        <p className="text-sm text-slate-500">Nessun esito ancora.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {(mappe.prese.get(o.id) ?? [])
                            .filter((p) => !esiti.some((e) => e.collaboratore_id === p.collaboratore_id))
                            .map((p) => {
                              const inCorso = new Date(p.scade_il).getTime() > Date.now()
                              return (
                                <li key={`p-${p.collaboratore_id}`} className="flex items-center justify-between gap-3 text-sm">
                                  <span className="truncate font-medium text-slate-800">{mappe.profili.get(p.collaboratore_id)?.nome ?? '—'}</span>
                                  <span className={`shrink-0 text-xs font-semibold ${inCorso ? 'text-brand-700' : 'text-amber-700'}`}>
                                    {inCorso ? `In carico fino alle ${formatDataOra(p.scade_il)}` : 'Scaduta senza risposta'}
                                  </span>
                                </li>
                              )
                            })}
                          {esiti.map((e) => (
                            <li key={e.collaboratore_id} className="flex items-center justify-between gap-3 text-sm">
                              <span className="truncate font-medium text-slate-800">{mappe.profili.get(e.collaboratore_id)?.nome ?? '—'}</span>
                              <span className="flex shrink-0 items-center gap-2">
                                <span className="hidden text-xs text-slate-400 sm:inline">{formatDataOra(e.updated_at)}</span>
                                <BadgeEsitoOpportunita esito={e.esito} />
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <Modale aperta={modale} titolo={inModifica ? 'Modifica opportunità' : 'Nuova opportunità'} onChiudi={() => setModale(false)}>
        <form onSubmit={salva} className="space-y-4">
          {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
          <div>
            <label className="label" htmlFor="on">Nome attività</label>
            <input id="on" className="input" placeholder="es. Pizzeria Da Mario" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="om">Link Google Maps</label>
            <input id="om" type="url" className="input" placeholder="https://maps.app.goo.gl/…" value={form.maps_url} onChange={(e) => setForm((f) => ({ ...f, maps_url: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="oc">Categoria</label>
              <input id="oc" className="input" placeholder="es. Ristorante" value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="oi">Zona / indirizzo</label>
              <input id="oi" className="input" value={form.indirizzo} onChange={(e) => setForm((f) => ({ ...f, indirizzo: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="od">Dettagli</label>
            <textarea
              id="od"
              rows={5}
              className="input"
              placeholder="Perché è una buona opportunità: niente sito, tante recensioni, orari, a chi chiedere…"
              value={form.dettagli}
              onChange={(e) => setForm((f) => ({ ...f, dettagli: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.attiva} onChange={(e) => setForm((f) => ({ ...f, attiva: e.target.checked }))} />
            Visibile ai collaboratori
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModale(false)}>Annulla</button>
            <button type="submit" className="btn-primary" disabled={salvataggio}>
              {salvataggio && <Spinner className="h-4 w-4" />} Salva
            </button>
          </div>
        </form>
      </Modale>

      <Modale aperta={!!daEliminare} titolo="Eliminare l'opportunità?" onChiudi={() => setDaEliminare(null)}>
        <p className="text-sm text-slate-600">
          <strong>{daEliminare?.nome}</strong> verrà eliminata insieme agli esiti dei collaboratori.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDaEliminare(null)}>Annulla</button>
          <button className="btn-danger" onClick={elimina}>Elimina</button>
        </div>
      </Modale>
    </>
  )
}
