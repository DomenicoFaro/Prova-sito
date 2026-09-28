import { useState } from 'react'
import { Icon } from '../../../components/Icon'
import { BadgeStatoRichiesta, Caricamento, IntestazionePagina, MessaggioErrore, Modale, Vuoto } from '../../../components/ui'
import { ETICHETTE_STATO_RICHIESTA, formatDataOra } from '../../../lib/format'
import { messaggioErrore, supabase } from '../../../lib/supabase'
import type { RichiestaContatto, StatoRichiesta } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

export default function AdminRichieste() {
  const [filtro, setFiltro] = useState<StatoRichiesta | ''>('')
  const [aperta, setAperta] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [daEliminare, setDaEliminare] = useState<RichiestaContatto | null>(null)

  const { dati, caricamento, errore: erroreCaricamento, ricarica, setDati } = useQuery(() =>
    esegui<RichiestaContatto[]>(supabase.from('richieste_contatto').select('*').order('created_at', { ascending: false })),
  )

  async function cambiaStato(r: RichiestaContatto, stato: StatoRichiesta) {
    setErrore(null)
    const { error } = await supabase.from('richieste_contatto').update({ stato }).eq('id', r.id)
    if (error) return setErrore(messaggioErrore(error))
    setDati((d) => d && d.map((x) => (x.id === r.id ? { ...x, stato } : x)))
  }

  function espandi(r: RichiestaContatto) {
    const nuova = aperta === r.id ? null : r.id
    setAperta(nuova)
    if (nuova && r.stato === 'nuova') cambiaStato(r, 'letta')
  }

  async function elimina() {
    if (!daEliminare) return
    const { error } = await supabase.from('richieste_contatto').delete().eq('id', daEliminare.id)
    setDaEliminare(null)
    if (error) return setErrore(messaggioErrore(error))
    ricarica()
  }

  const conteggi = (dati ?? []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.stato]: (acc[r.stato] ?? 0) + 1 }), {})
  const filtrate = (dati ?? []).filter((r) => !filtro || r.stato === filtro)

  return (
    <>
      <IntestazionePagina titolo="Richieste di contatto" sottotitolo="Messaggi arrivati dal form del sito." />

      <div className="mb-4 flex flex-wrap gap-2">
        {(['', 'nuova', 'letta', 'gestita'] as const).map((s) => (
          <button
            key={s || 'tutte'}
            onClick={() => setFiltro(s)}
            aria-pressed={filtro === s}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${filtro === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
          >
            {s ? ETICHETTE_STATO_RICHIESTA[s] : 'Tutte'}
            <span className="ml-1.5 opacity-60">{s ? (conteggi[s] ?? 0) : (dati?.length ?? 0)}</span>
          </button>
        ))}
      </div>

      {errore && <div className="mb-4"><MessaggioErrore>{errore}</MessaggioErrore></div>}

      {caricamento ? (
        <Caricamento />
      ) : erroreCaricamento ? (
        <MessaggioErrore onRiprova={ricarica}>{erroreCaricamento}</MessaggioErrore>
      ) : filtrate.length === 0 ? (
        <div className="card"><Vuoto icona="inbox" titolo="Nessuna richiesta" /></div>
      ) : (
        <ul className="card divide-y divide-slate-100 overflow-hidden">
          {filtrate.map((r) => (
            <li key={r.id} className={r.stato === 'nuova' ? 'bg-brand-50/40' : ''}>
              <button onClick={() => espandi(r)} className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-slate-50 sm:px-6" aria-expanded={aperta === r.id}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`font-semibold ${r.stato === 'nuova' ? 'text-slate-900' : 'text-slate-700'}`}>{r.nome}</p>
                    <BadgeStatoRichiesta stato={r.stato} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-slate-500">{r.messaggio}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{formatDataOra(r.created_at)}</span>
              </button>
              {aperta === r.id && (
                <div className="space-y-4 px-4 pb-5 sm:px-6">
                  <div className="flex flex-wrap gap-2 text-sm">
                    <a href={`mailto:${r.email}`} className="btn-secondary py-1.5"><Icon name="mail" className="h-4 w-4" /> {r.email}</a>
                    {r.telefono && (
                      <a href={`tel:${r.telefono.replace(/\s/g, '')}`} className="btn-secondary py-1.5"><Icon name="phone" className="h-4 w-4" /> {r.telefono}</a>
                    )}
                  </div>
                  <p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed whitespace-pre-line text-slate-700">{r.messaggio}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-sm font-medium text-slate-600" htmlFor={`s-${r.id}`}>Stato:</label>
                    <select id={`s-${r.id}`} className="input w-auto py-1.5" value={r.stato} onChange={(e) => cambiaStato(r, e.target.value as StatoRichiesta)}>
                      {Object.entries(ETICHETTE_STATO_RICHIESTA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button className="btn-ghost ml-auto py-1.5 text-red-600" onClick={() => setDaEliminare(r)}>
                      <Icon name="trash" className="h-4 w-4" /> Elimina
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modale aperta={!!daEliminare} titolo="Eliminare la richiesta?" onChiudi={() => setDaEliminare(null)}>
        <p className="text-sm text-slate-600">La richiesta di <strong>{daEliminare?.nome}</strong> verrà eliminata definitivamente.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDaEliminare(null)}>Annulla</button>
          <button className="btn-danger" onClick={elimina}>Elimina</button>
        </div>
      </Modale>
    </>
  )
}
