import { useMemo, useState, type FormEvent } from 'react'
import { Icon } from '../../../components/Icon'
import {
  BadgeStatoPagamento,
  Caricamento,
  IntestazionePagina,
  MessaggioErrore,
  Modale,
  Spinner,
  StatCard,
  Vuoto,
} from '../../../components/ui'
import { formatData, formatEuro, oggiISO, parseNumero } from '../../../lib/format'
import { messaggioErrore, supabase } from '../../../lib/supabase'
import type { Guadagno, Pagamento, Profilo } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

interface NuovoPagamento {
  collaboratore_id: string
  assegnazione_id: string
  importo: string
  data: string
  nota: string
}

export default function AdminPagamenti() {
  const [filtroCollab, setFiltroCollab] = useState('')
  const [modale, setModale] = useState(false)
  const [form, setForm] = useState<NuovoPagamento>({ collaboratore_id: '', assegnazione_id: '', importo: '', data: oggiISO(), nota: '' })
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [daEliminare, setDaEliminare] = useState<Pagamento | null>(null)

  const { dati, caricamento, errore: erroreCaricamento, ricarica } = useQuery(async () => {
    const [profili, guadagni, pagamenti] = await Promise.all([
      esegui<Profilo[]>(supabase.from('profiles').select('*').order('nome')),
      esegui<Guadagno[]>(supabase.from('v_guadagni').select('*').order('progetto_nome')),
      esegui<Pagamento[]>(supabase.from('pagamenti').select('*').order('data', { ascending: false }).order('created_at', { ascending: false })),
    ])
    return { profili, guadagni, pagamenti }
  })

  const mappe = useMemo(() => {
    const profili = new Map((dati?.profili ?? []).map((p) => [p.id, p]))
    const guadagni = new Map((dati?.guadagni ?? []).map((g) => [g.assegnazione_id, g]))
    return { profili, guadagni }
  }, [dati])

  const daSaldare = (dati?.guadagni ?? []).filter((g) => Number(g.residuo) > 0 && (!filtroCollab || g.collaboratore_id === filtroCollab))
  const pagamenti = (dati?.pagamenti ?? []).filter((p) => !filtroCollab || mappe.guadagni.get(p.assegnazione_id)?.collaboratore_id === filtroCollab)
  const totaleResiduo = daSaldare.reduce((s, g) => s + Number(g.residuo), 0)
  const totalePagato = pagamenti.reduce((s, p) => s + Number(p.importo), 0)

  const collabConAssegnazioni = (dati?.profili ?? []).filter((p) => (dati?.guadagni ?? []).some((g) => g.collaboratore_id === p.id))
  const assegnazioniCollab = (dati?.guadagni ?? []).filter((g) => g.collaboratore_id === form.collaboratore_id)
  const assegnazioneScelta = form.assegnazione_id ? mappe.guadagni.get(form.assegnazione_id) : undefined

  function apri(g?: Guadagno) {
    setErrore(null)
    setForm({
      collaboratore_id: g?.collaboratore_id ?? filtroCollab ?? '',
      assegnazione_id: g?.assegnazione_id ?? '',
      importo: g ? String(g.residuo).replace('.', ',') : '',
      data: oggiISO(),
      nota: '',
    })
    setModale(true)
  }

  async function registra(e: FormEvent) {
    e.preventDefault()
    setErrore(null)
    const importo = parseNumero(form.importo)
    if (!form.assegnazione_id) return setErrore('Seleziona collaboratore e progetto.')
    if (!Number.isFinite(importo) || importo <= 0) return setErrore("Inserisci un importo valido maggiore di zero.")
    setSalvataggio(true)
    const { error } = await supabase.from('pagamenti').insert({
      assegnazione_id: form.assegnazione_id,
      importo: Math.round(importo * 100) / 100,
      data: form.data || oggiISO(),
      nota: form.nota.trim(),
    })
    setSalvataggio(false)
    if (error) return setErrore(messaggioErrore(error))
    setModale(false)
    ricarica()
  }

  async function elimina() {
    if (!daEliminare) return
    const { error } = await supabase.from('pagamenti').delete().eq('id', daEliminare.id)
    setDaEliminare(null)
    if (error) return setErrore(messaggioErrore(error))
    ricarica()
  }

  return (
    <>
      <IntestazionePagina
        titolo="Pagamenti"
        sottotitolo="Registra i pagamenti ai collaboratori. Lo stato (Pagato / Parziale / Da pagare) si aggiorna da solo."
        azioni={
          <button className="btn-primary" onClick={() => apri()}>
            <Icon name="plus" className="h-4 w-4" /> Registra pagamento
          </button>
        }
      />

      {caricamento ? (
        <Caricamento />
      ) : erroreCaricamento ? (
        <MessaggioErrore onRiprova={ricarica}>{erroreCaricamento}</MessaggioErrore>
      ) : (
        <div className="space-y-6">
          {errore && !modale && <MessaggioErrore>{errore}</MessaggioErrore>}
          <select className="input sm:max-w-xs" value={filtroCollab} onChange={(e) => setFiltroCollab(e.target.value)} aria-label="Filtra per collaboratore">
            <option value="">Tutti i collaboratori</option>
            {collabConAssegnazioni.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:max-w-xl">
            <StatCard etichetta="Da pagare" valore={formatEuro(totaleResiduo)} icona="clock" tono="ambra" />
            <StatCard etichetta="Pagato (storico)" valore={formatEuro(totalePagato)} icona="check" tono="verde" />
          </div>

          <section className="card overflow-hidden">
            <h2 className="border-b border-slate-100 px-4 py-4 font-semibold text-slate-900 sm:px-6">Da saldare</h2>
            {daSaldare.length === 0 ? (
              <Vuoto icona="check" titolo="Tutto saldato" />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Collaboratore</th>
                      <th>Progetto</th>
                      <th className="text-right">Dovuto</th>
                      <th className="text-right">Pagato</th>
                      <th className="text-right">Residuo</th>
                      <th>Stato</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {daSaldare.map((g) => (
                      <tr key={g.assegnazione_id}>
                        <td className="font-medium whitespace-nowrap">{mappe.profili.get(g.collaboratore_id)?.nome ?? '—'}</td>
                        <td>{g.progetto_nome}</td>
                        <td className="text-right whitespace-nowrap tabular-nums">{formatEuro(g.guadagno)}</td>
                        <td className="text-right whitespace-nowrap tabular-nums">{formatEuro(g.pagato)}</td>
                        <td className="text-right font-semibold whitespace-nowrap tabular-nums">{formatEuro(g.residuo)}</td>
                        <td><BadgeStatoPagamento stato={g.stato_pagamento} /></td>
                        <td className="text-right">
                          <button className="btn-secondary py-1.5 whitespace-nowrap" onClick={() => apri(g)}>Paga</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card overflow-hidden">
            <h2 className="border-b border-slate-100 px-4 py-4 font-semibold text-slate-900 sm:px-6">Storico pagamenti</h2>
            {pagamenti.length === 0 ? (
              <Vuoto icona="wallet" titolo="Nessun pagamento registrato" />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Collaboratore</th>
                      <th>Progetto</th>
                      <th className="text-right">Importo</th>
                      <th>Nota</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {pagamenti.map((p) => {
                      const g = mappe.guadagni.get(p.assegnazione_id)
                      return (
                        <tr key={p.id}>
                          <td className="whitespace-nowrap">{formatData(p.data)}</td>
                          <td className="font-medium whitespace-nowrap">{g ? mappe.profili.get(g.collaboratore_id)?.nome : '—'}</td>
                          <td>{g?.progetto_nome ?? '—'}</td>
                          <td className="text-right font-semibold whitespace-nowrap tabular-nums">{formatEuro(p.importo)}</td>
                          <td className="text-slate-600">{p.nota || '—'}</td>
                          <td className="text-right">
                            <button className="btn-ghost p-2 text-red-600" onClick={() => setDaEliminare(p)} aria-label="Elimina pagamento">
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      <Modale aperta={modale} titolo="Registra pagamento" onChiudi={() => setModale(false)}>
        <form onSubmit={registra} className="space-y-4">
          {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
          <div>
            <label className="label" htmlFor="pc">Collaboratore</label>
            <select id="pc" className="input" value={form.collaboratore_id} onChange={(e) => setForm((f) => ({ ...f, collaboratore_id: e.target.value, assegnazione_id: '', importo: '' }))}>
              <option value="">Seleziona…</option>
              {collabConAssegnazioni.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pp">Progetto</label>
            <select
              id="pp"
              className="input"
              disabled={!form.collaboratore_id}
              value={form.assegnazione_id}
              onChange={(e) => {
                const g = mappe.guadagni.get(e.target.value)
                setForm((f) => ({ ...f, assegnazione_id: e.target.value, importo: g && Number(g.residuo) > 0 ? String(g.residuo).replace('.', ',') : f.importo }))
              }}
            >
              <option value="">Seleziona…</option>
              {assegnazioniCollab.map((g) => (
                <option key={g.assegnazione_id} value={g.assegnazione_id}>
                  {g.progetto_nome} — residuo {formatEuro(g.residuo)}
                </option>
              ))}
            </select>
            {assegnazioneScelta && (
              <p className="mt-1.5 text-xs text-slate-500">
                Dovuto {formatEuro(assegnazioneScelta.guadagno)} · già pagato {formatEuro(assegnazioneScelta.pagato)}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="pi">Importo (€)</label>
              <input id="pi" inputMode="decimal" className="input" value={form.importo} onChange={(e) => setForm((f) => ({ ...f, importo: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="pd">Data</label>
              <input id="pd" type="date" className="input" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="pn">Nota</label>
            <input id="pn" className="input" placeholder="es. Bonifico, acconto…" value={form.nota} onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModale(false)}>Annulla</button>
            <button type="submit" className="btn-primary" disabled={salvataggio}>
              {salvataggio && <Spinner className="h-4 w-4" />} Registra
            </button>
          </div>
        </form>
      </Modale>

      <Modale aperta={!!daEliminare} titolo="Eliminare il pagamento?" onChiudi={() => setDaEliminare(null)}>
        <p className="text-sm text-slate-600">
          Il pagamento di <strong>{formatEuro(daEliminare?.importo)}</strong> del {formatData(daEliminare?.data)} verrà eliminato e lo stato verrà ricalcolato.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDaEliminare(null)}>Annulla</button>
          <button className="btn-danger" onClick={elimina}>Elimina</button>
        </div>
      </Modale>
    </>
  )
}
