import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import { Stelle } from '../../../components/Stelle'
import { Caricamento, IntestazionePagina, MessaggioErrore, Modale, Vuoto } from '../../../components/ui'
import { formatData } from '../../../lib/format'
import { messaggioErrore, supabase } from '../../../lib/supabase'
import type { Recensione } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

export default function AdminRecensioni() {
  const { dati, caricamento, errore, ricarica } = useQuery(() =>
    esegui<Recensione[]>(supabase.from('recensioni').select('*').order('created_at', { ascending: false })),
  )
  const [daEliminare, setDaEliminare] = useState<Recensione | null>(null)
  const [erroreAzione, setErroreAzione] = useState<string | null>(null)

  async function esito(q: PromiseLike<{ error: unknown }>) {
    setErroreAzione(null)
    const { error } = await q
    if (error) setErroreAzione(messaggioErrore(error))
    ricarica()
  }

  return (
    <>
      <IntestazionePagina titolo="Recensioni" sottotitolo="Vanno online appena il cliente le invia. Puoi nasconderle o eliminarle; il testo non si modifica." />
      {erroreAzione && <div className="mb-4"><MessaggioErrore>{erroreAzione}</MessaggioErrore></div>}
      {caricamento && !dati ? (
        <Caricamento />
      ) : errore ? (
        <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>
      ) : !dati?.length ? (
        <div className="card"><Vuoto icona="chat" titolo="Ancora nessuna recensione">Le scrivono i clienti dalla loro area riservata.</Vuoto></div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {dati.map((r) => (
            <li key={r.id} className={`card flex flex-col p-5 ${r.visibile ? '' : 'opacity-60'}`}>
              <div className="flex items-center justify-between gap-3">
                <Stelle voto={r.stelle} />
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.visibile ? 'bg-brand-50 text-brand-700' : 'bg-slate-200 text-slate-700'}`}>{r.visibile ? 'Online' : 'Nascosta'}</span>
              </div>
              <p className="mt-3 flex-1 text-sm break-words whitespace-pre-line text-slate-700">{r.testo}</p>
              <p className="mt-3 text-sm font-semibold text-slate-900">{r.firma} <span className="font-normal text-slate-500">· {r.attivita} · {formatData(r.created_at.slice(0, 10))}</span></p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-secondary py-1.5" onClick={() => esito(supabase.from('recensioni').update({ visibile: !r.visibile }).eq('id', r.id))}>
                  <Icon name={r.visibile ? 'ban' : 'eye'} className="h-4 w-4" /> {r.visibile ? 'Nascondi' : 'Mostra'}
                </button>
                <Link to={`/area/admin/clienti/${r.cliente_id}`} className="btn-ghost py-1.5"><Icon name="user" className="h-4 w-4" /> Cliente</Link>
                <button className="btn-ghost py-1.5 text-red-600" onClick={() => setDaEliminare(r)}><Icon name="trash" className="h-4 w-4" /> Elimina</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modale aperta={!!daEliminare} titolo="Eliminare la recensione?" onChiudi={() => setDaEliminare(null)}>
        <p className="text-sm text-slate-600">La recensione di <strong>{daEliminare?.firma}</strong> verrà eliminata per sempre. Per toglierla solo dal sito usa «Nascondi».</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDaEliminare(null)}>Annulla</button>
          <button className="btn-danger" onClick={() => { const r = daEliminare!; setDaEliminare(null); esito(supabase.from('recensioni').delete().eq('id', r.id)) }}>Elimina</button>
        </div>
      </Modale>
    </>
  )
}
