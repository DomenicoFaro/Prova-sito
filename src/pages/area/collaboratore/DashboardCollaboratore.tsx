import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GraficoMensile } from '../../../components/GraficoMensile'
import { Icon } from '../../../components/Icon'
import {
  BadgeStatoPagamento,
  BadgeStatoProgetto,
  Caricamento,
  MessaggioErrore,
  StatCard,
  Vuoto,
} from '../../../components/ui'
import { formatData, formatEuro, formatPercentuale, hostname } from '../../../lib/format'
import { dataRiferimento, ETICHETTE_PERIODO, nelPeriodo, totali, type Periodo } from '../../../lib/periodo'
import { supabase } from '../../../lib/supabase'
import type { Guadagno } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

/**
 * Dashboard di un collaboratore (sola lettura).
 * La usa il collaboratore stesso e l'admin nella "vista come".
 * Le RLS garantiscono che un collaboratore riceva solo le proprie righe.
 */
export function DashboardCollaboratoreView({
  collaboratoreId,
  linkDettaglio,
}: {
  collaboratoreId: string
  linkDettaglio: (assegnazioneId: string) => string
}) {
  const [periodo, setPeriodo] = useState<Periodo>('sempre')
  const navigate = useNavigate()

  const { dati, caricamento, errore, ricarica } = useQuery(
    () =>
      esegui<Guadagno[]>(
        supabase
          .from('v_guadagni')
          .select('*')
          .eq('collaboratore_id', collaboratoreId)
          .order('data_consegna', { ascending: false, nullsFirst: true }),
      ),
    [collaboratoreId],
  )

  const righe = useMemo(() => (dati ?? []).filter((r) => nelPeriodo(dataRiferimento(r), periodo)), [dati, periodo])
  const t = totali(righe)

  if (caricamento) return <Caricamento testo="Carico i tuoi dati…" />
  if (errore) return <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Periodo">
        {(Object.keys(ETICHETTE_PERIODO) as Periodo[]).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={p === periodo}
            onClick={() => setPeriodo(p)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${p === periodo ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
          >
            {ETICHETTE_PERIODO[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard etichetta="Totale guadagnato" valore={formatEuro(t.guadagnato)} icona="euro" />
        <StatCard etichetta="Già pagato" valore={formatEuro(t.pagato)} icona="check" tono="verde" />
        <StatCard etichetta="Da ricevere" valore={formatEuro(t.daRicevere)} icona="clock" tono="ambra" />
        <StatCard etichetta="Numero progetti" valore={t.progetti} icona="folder" tono="slate" />
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-6">
          <h2 className="font-semibold text-slate-900">I miei siti</h2>
          <span className="text-sm text-slate-500">{righe.length} {righe.length === 1 ? 'progetto' : 'progetti'}</span>
        </div>

        {righe.length === 0 ? (
          <Vuoto titolo="Nessun progetto in questo periodo">Prova a selezionare un periodo più ampio.</Vuoto>
        ) : (
          <>
            {/* Mobile: card */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {righe.map((r) => (
                <li key={r.assegnazione_id}>
                  <Link to={linkDettaglio(r.assegnazione_id)} className="block px-4 py-4 active:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{r.progetto_nome}</p>
                        <p className="truncate text-sm text-slate-500">{r.cliente}</p>
                      </div>
                      <BadgeStatoPagamento stato={r.stato_pagamento} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">Prezzo</p>
                        <p className="font-medium tabular-nums">{formatEuro(r.prezzo_totale)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Mia %</p>
                        <p className="font-medium tabular-nums">{formatPercentuale(r.percentuale)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Mio guadagno</p>
                        <p className="font-bold text-slate-900 tabular-nums">{formatEuro(r.guadagno)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <BadgeStatoProgetto stato={r.stato_progetto} />
                      <span className="text-xs text-slate-500">Consegna: {formatData(r.data_consegna)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Desktop: tabella */}
            <div className="hidden overflow-x-auto md:block">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Progetto</th>
                    <th>Consegna</th>
                    <th>Stato</th>
                    <th className="text-right">Prezzo</th>
                    <th className="text-right">Mia %</th>
                    <th className="text-right">Mio guadagno</th>
                    <th>Pagamento</th>
                  </tr>
                </thead>
                <tbody>
                  {righe.map((r) => (
                    <tr
                      key={r.assegnazione_id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => navigate(linkDettaglio(r.assegnazione_id))}
                    >
                      <td>
                        <Link to={linkDettaglio(r.assegnazione_id)} className="font-semibold text-slate-900 hover:text-brand-700" onClick={(e) => e.stopPropagation()}>
                          {r.progetto_nome}
                        </Link>
                        <p className="text-xs text-slate-500">{r.cliente}</p>
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                            {hostname(r.url)} <Icon name="external" className="h-3 w-3" />
                          </a>
                        )}
                      </td>
                      <td className="whitespace-nowrap">{formatData(r.data_consegna)}</td>
                      <td><BadgeStatoProgetto stato={r.stato_progetto} /></td>
                      <td className="text-right whitespace-nowrap tabular-nums">{formatEuro(r.prezzo_totale)}</td>
                      <td className="text-right tabular-nums">{formatPercentuale(r.percentuale)}</td>
                      <td className="text-right font-bold whitespace-nowrap text-slate-900 tabular-nums">{formatEuro(r.guadagno)}</td>
                      <td><BadgeStatoPagamento stato={r.stato_pagamento} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <GraficoMensile righe={dati ?? []} />
    </div>
  )
}
