import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { Icon } from '../../../components/Icon'
import { Screenshot } from '../../../components/Screenshot'
import { BadgeStatoProgetto, Caricamento, IntestazionePagina, MessaggioErrore, Vuoto } from '../../../components/ui'
import { ETICHETTE_STATO_PROGETTO, formatData, formatEuro, formatPercentuale } from '../../../lib/format'
import { messaggioErrore, supabase } from '../../../lib/supabase'
import type { Assegnazione, Progetto, StatoProgetto } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

export default function AdminProgetti() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [cerca, setCerca] = useState('')
  const [stato, setStato] = useState<StatoProgetto | ''>('')
  const [erroreAzione, setErroreAzione] = useState<string | null>(null)

  const { dati, caricamento, errore, ricarica, setDati } = useQuery(async () => {
    const [progetti, assegnazioni] = await Promise.all([
      esegui<Progetto[]>(supabase.from('progetti').select('*').order('created_at', { ascending: false })),
      esegui<Pick<Assegnazione, 'progetto_id' | 'percentuale'>[]>(supabase.from('assegnazioni').select('progetto_id, percentuale')),
    ])
    const perc = new Map<string, number>()
    for (const a of assegnazioni) perc.set(a.progetto_id, (perc.get(a.progetto_id) ?? 0) + Number(a.percentuale))
    return { progetti, perc }
  })

  const filtrati = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    return (dati?.progetti ?? []).filter(
      (p) =>
        (!stato || p.stato === stato) &&
        (!q || [p.nome, p.cliente, p.categoria].some((x) => x?.toLowerCase().includes(q))),
    )
  }, [dati, cerca, stato])

  async function togglePubblico(p: Progetto) {
    setErroreAzione(null)
    const { error } = await supabase.from('progetti').update({ pubblico: !p.pubblico }).eq('id', p.id)
    if (error) return setErroreAzione(messaggioErrore(error))
    setDati((d) => d && { ...d, progetti: d.progetti.map((x) => (x.id === p.id ? { ...x, pubblico: !p.pubblico } : x)) })
  }

  return (
    <>
      <IntestazionePagina
        titolo="Progetti"
        sottotitolo="Crea, modifica e assegna i progetti ai collaboratori."
        azioni={
          <Link to="/area/admin/progetti/nuovo" className="btn-primary">
            <Icon name="plus" className="h-4 w-4" /> Nuovo progetto
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input className="input sm:max-w-xs" placeholder="Cerca per nome, cliente, categoria…" value={cerca} onChange={(e) => setCerca(e.target.value)} aria-label="Cerca" />
        <select className="input sm:max-w-52" value={stato} onChange={(e) => setStato(e.target.value as StatoProgetto | '')} aria-label="Filtra per stato">
          <option value="">Tutti gli stati</option>
          {Object.entries(ETICHETTE_STATO_PROGETTO).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {erroreAzione && <div className="mb-4"><MessaggioErrore>{erroreAzione}</MessaggioErrore></div>}

      {caricamento ? (
        <Caricamento />
      ) : errore ? (
        <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>
      ) : filtrati.length === 0 ? (
        <div className="card">
          <Vuoto titolo="Nessun progetto">
            <Link to="/area/admin/progetti/nuovo" className="font-semibold text-brand-700">Crea il primo progetto</Link>
          </Vuoto>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Progetto</th>
                  <th>Stato</th>
                  <th>Consegna</th>
                  <th className="text-right">Prezzo</th>
                  {isAdmin && <th className="text-right">Incassato</th>}
                  <th className="text-right">% assegnata</th>
                  <th className="text-center">Portfolio</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtrati.map((p) => {
                  const perc = dati?.perc.get(p.id) ?? 0
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td>
                        <div className="flex min-w-56 items-center gap-3">
                          <div className="h-10 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                            <Screenshot src={p.screenshot_url} nome={p.nome} className="text-[8px]" />
                          </div>
                          <div className="min-w-0">
                            <Link to={`/area/admin/progetti/${p.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{p.nome}</Link>
                            <p className="truncate text-xs text-slate-500">{p.cliente}{p.categoria && ` · ${p.categoria}`}</p>
                          </div>
                        </div>
                      </td>
                      <td><BadgeStatoProgetto stato={p.stato} /></td>
                      <td className="whitespace-nowrap">{formatData(p.data_consegna)}</td>
                      <td className="text-right whitespace-nowrap tabular-nums">{formatEuro(p.prezzo_totale)}</td>
                      {isAdmin && (
                        <td className="text-right whitespace-nowrap tabular-nums">
                          {formatEuro(p.incassato)}
                          {Number(p.prezzo_totale) - Number(p.incassato) > 0 && (
                            <p className="text-xs font-medium text-amber-700">ancora {formatEuro(Number(p.prezzo_totale) - Number(p.incassato))}</p>
                          )}
                        </td>
                      )}
                      <td className={`text-right tabular-nums ${perc > 100 ? 'font-semibold text-red-600' : ''}`}>{formatPercentuale(perc)}</td>
                      <td className="text-center">
                        <button
                          onClick={() => togglePubblico(p)}
                          role="switch"
                          aria-checked={p.pubblico}
                          aria-label={`Mostra ${p.nome} nel portfolio`}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${p.pubblico ? 'bg-brand-600' : 'bg-slate-300'}`}
                        >
                          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${p.pubblico ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                        </button>
                      </td>
                      <td className="text-right">
                        <button onClick={() => navigate(`/area/admin/progetti/${p.id}`)} className="btn-ghost p-2" aria-label={`Modifica ${p.nome}`}>
                          <Icon name="edit" className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
