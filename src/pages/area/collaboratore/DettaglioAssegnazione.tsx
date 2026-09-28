import { Link, useParams } from 'react-router-dom'
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
import { supabase } from '../../../lib/supabase'
import type { Guadagno, Pagamento } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

/** Dettaglio di un progetto dal punto di vista del collaboratore, con storico pagamenti. */
export function DettaglioAssegnazioneView({ assegnazioneId, linkIndietro }: { assegnazioneId: string; linkIndietro: string }) {
  const { dati, caricamento, errore, ricarica } = useQuery(async () => {
    const [g, p] = await Promise.all([
      esegui<Guadagno | null>(supabase.from('v_guadagni').select('*').eq('assegnazione_id', assegnazioneId).maybeSingle()),
      esegui<Pagamento[]>(supabase.from('pagamenti').select('*').eq('assegnazione_id', assegnazioneId).order('data', { ascending: false })),
    ])
    return { g, pagamenti: p }
  }, [assegnazioneId])

  const indietro = (
    <Link to={linkIndietro} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
      <Icon name="arrowLeft" className="h-4 w-4" /> Torna ai progetti
    </Link>
  )

  if (caricamento) return <Caricamento />
  if (errore) return <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>
  if (!dati?.g)
    return (
      <>
        {indietro}
        <Vuoto titolo="Progetto non trovato">Il progetto non esiste o non sei assegnato a questo progetto.</Vuoto>
      </>
    )

  const { g, pagamenti } = dati

  return (
    <div className="space-y-6">
      <div>
        {indietro}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{g.progetto_nome}</h1>
            <p className="text-sm text-slate-500">
              {g.cliente}
              {g.ruolo_nel_progetto && <> · Il mio ruolo: <strong className="text-slate-700">{g.ruolo_nel_progetto}</strong></>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BadgeStatoProgetto stato={g.stato_progetto} />
            <BadgeStatoPagamento stato={g.stato_pagamento} />
          </div>
        </div>
        {g.url && (
          <a href={g.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            {hostname(g.url)} <Icon name="external" className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard etichetta="Prezzo progetto" valore={formatEuro(g.prezzo_totale)} icona="folder" tono="slate" nota={`Consegna: ${formatData(g.data_consegna)}`} />
        <StatCard etichetta="Mio guadagno" valore={formatEuro(g.guadagno)} icona="euro" nota={`${formatPercentuale(g.percentuale)} del prezzo`} />
        <StatCard etichetta="Già pagato" valore={formatEuro(g.pagato)} icona="check" tono="verde" />
        <StatCard etichetta="Da ricevere" valore={formatEuro(g.residuo)} icona="clock" tono="ambra" />
      </div>

      <section className="card overflow-hidden">
        <h2 className="border-b border-slate-100 px-4 py-4 font-semibold text-slate-900 sm:px-6">Storico pagamenti</h2>
        {pagamenti.length === 0 ? (
          <Vuoto icona="wallet" titolo="Nessun pagamento ancora registrato" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Data</th>
                  <th className="text-right">Importo</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {pagamenti.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{formatData(p.data)}</td>
                    <td className="text-right font-semibold whitespace-nowrap tabular-nums">{formatEuro(p.importo)}</td>
                    <td className="text-slate-600">{p.nota || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="font-semibold">Totale</td>
                  <td className="text-right font-bold tabular-nums">{formatEuro(g.pagato)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default function DettaglioAssegnazione() {
  const { assegnazioneId = '' } = useParams()
  return <DettaglioAssegnazioneView assegnazioneId={assegnazioneId} linkIndietro="/area/dashboard" />
}
