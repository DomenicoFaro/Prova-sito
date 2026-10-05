import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { Avatar } from '../../../components/Avatar'
import { Icon } from '../../../components/Icon'
import { BadgeStatoProgetto, Caricamento, IntestazionePagina, MessaggioErrore, StatCard, Vuoto } from '../../../components/ui'
import { formatData, formatEuro } from '../../../lib/format'
import { ETICHETTE_PERIODO, nelPeriodo, type Periodo } from '../../../lib/periodo'
import { supabase } from '../../../lib/supabase'
import type { Guadagno, Profilo, Progetto, RigaAzienda } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

export default function AdminRiepilogo() {
  const { isSocio } = useAuth()
  const [periodo, setPeriodo] = useState<Periodo>('sempre')
  const { dati, caricamento, errore, ricarica } = useQuery(async () => {
    const [progetti, guadagni, profili, azienda] = await Promise.all([
      esegui<Progetto[]>(supabase.from('progetti').select('*').order('created_at', { ascending: false })),
      esegui<Guadagno[]>(supabase.from('v_guadagni').select('*')),
      esegui<Profilo[]>(supabase.from('profiles').select('*')),
      // Il socio vede i soli totali dell'azienda (nessun dettaglio degli altri team)
      isSocio ? esegui<RigaAzienda[]>(supabase.rpc('riepilogo_azienda')) : Promise.resolve<RigaAzienda[]>([]),
    ])
    return { progetti, guadagni, profili, azienda }
  })

  const calcolo = useMemo(() => {
    if (!dati) return null
    const dataProg = (p: Pick<Progetto, 'data_consegna' | 'created_at'>) =>
      p.data_consegna ? new Date(`${p.data_consegna}T00:00:00`) : new Date(p.created_at)
    const progetti = dati.progetti.filter((p) => nelPeriodo(dataProg(p), periodo))
    const ids = new Set(progetti.map((p) => p.id))
    const guadagni = dati.guadagni.filter((g) => ids.has(g.progetto_id))

    const fatturato = progetti.reduce((s, p) => s + Number(p.prezzo_totale), 0)
    const dovuto = guadagni.reduce((s, g) => s + Number(g.guadagno), 0)
    const daPagare = guadagni.reduce((s, g) => s + Number(g.residuo), 0)
    const attivi = progetti.filter((p) => p.stato !== 'consegnato').length

    const perCollaboratore = new Map<string, { dovuto: number; pagato: number; residuo: number }>()
    for (const g of guadagni) {
      const c = perCollaboratore.get(g.collaboratore_id) ?? { dovuto: 0, pagato: 0, residuo: 0 }
      c.dovuto += Number(g.guadagno)
      c.pagato += Number(g.pagato)
      c.residuo += Number(g.residuo)
      perCollaboratore.set(g.collaboratore_id, c)
    }
    const righeAzienda = dati.azienda.filter((r) => nelPeriodo(new Date(`${r.data_riferimento}T00:00:00`), periodo))
    const azienda = {
      fatturato: righeAzienda.reduce((t, r) => t + Number(r.prezzo_totale), 0),
      progetti: righeAzienda.length,
    }
    return { progetti, fatturato, dovuto, daPagare, margine: fatturato - dovuto, attivi, perCollaboratore, azienda }
  }, [dati, periodo])

  return (
    <>
      <IntestazionePagina
        titolo="Riepilogo"
        sottotitolo={isSocio ? 'Il tuo team e i totali dell\'azienda.' : "Andamento globale dell'agenzia."}
        azioni={
          <Link to="/area/admin/progetti/nuovo" className="btn-primary">
            <Icon name="plus" className="h-4 w-4" /> Nuovo progetto
          </Link>
        }
      />
      {caricamento ? (
        <Caricamento />
      ) : errore ? (
        <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>
      ) : dati && calcolo ? (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ETICHETTE_PERIODO) as Periodo[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                aria-pressed={p === periodo}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${p === periodo ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
              >
                {ETICHETTE_PERIODO[p]}
              </button>
            ))}
          </div>

          {isSocio && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <StatCard etichetta="Fatturato azienda" valore={formatEuro(calcolo.azienda.fatturato)} icona="euro" tono="verde" nota={`${calcolo.azienda.progetti} progetti in tutto`} />
              <StatCard etichetta="Il tuo fatturato" valore={formatEuro(calcolo.fatturato)} icona="chart" nota={`${calcolo.progetti.length} progetti del tuo team`} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard etichetta={isSocio ? 'Fatturato del team' : 'Fatturato totale'} valore={formatEuro(calcolo.fatturato)} icona="euro" nota={`${calcolo.progetti.length} progetti`} />
            <StatCard etichetta="Da pagare ai collaboratori" valore={formatEuro(calcolo.daPagare)} icona="clock" tono="ambra" nota={`su ${formatEuro(calcolo.dovuto)} dovuti`} />
            <StatCard etichetta="Margine agenzia" valore={formatEuro(calcolo.margine)} icona="chart" tono="verde" nota={calcolo.fatturato > 0 ? `${Math.round((calcolo.margine / calcolo.fatturato) * 100)}% del fatturato` : undefined} />
            <StatCard etichetta="Progetti attivi" valore={calcolo.attivi} icona="folder" tono="slate" nota="In lavorazione o manutenzione" />
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <section className="card overflow-hidden xl:col-span-3">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-6">
                <h2 className="font-semibold text-slate-900">Progetti recenti</h2>
                <Link to="/area/admin/progetti" className="text-sm font-semibold text-brand-700 hover:underline">Tutti</Link>
              </div>
              {calcolo.progetti.length === 0 ? (
                <Vuoto titolo="Nessun progetto nel periodo" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {calcolo.progetti.slice(0, 6).map((p) => (
                    <li key={p.id}>
                      <Link to={`/area/admin/progetti/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:px-6">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{p.nome}</p>
                          <p className="truncate text-xs text-slate-500">{p.cliente} · {formatData(p.data_consegna)}</p>
                        </div>
                        <BadgeStatoProgetto stato={p.stato} />
                        <span className="w-24 text-right text-sm font-semibold tabular-nums">{formatEuro(p.prezzo_totale)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card overflow-hidden xl:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-6">
                <h2 className="font-semibold text-slate-900">{isSocio ? 'Il tuo team' : 'Collaboratori'}</h2>
                <Link to="/area/admin/pagamenti" className="text-sm font-semibold text-brand-700 hover:underline">Pagamenti</Link>
              </div>
              {dati.profili.filter((p) => p.ruolo === 'collaboratore').length === 0 ? (
                <Vuoto icona="users" titolo="Nessun collaboratore" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {dati.profili
                    .filter((p) => p.ruolo === 'collaboratore')
                    .map((c) => {
                      const t = calcolo.perCollaboratore.get(c.id) ?? { dovuto: 0, pagato: 0, residuo: 0 }
                      return (
                        <li key={c.id}>
                          <Link to={`/area/admin/collaboratori/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:px-6">
                            <Avatar nome={c.nome} url={c.avatar_url} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-slate-900">{c.nome}{!c.attivo && <span className="ml-2 text-xs font-medium text-slate-400">(disattivato)</span>}</p>
                              <p className="text-xs text-slate-500 tabular-nums">
                                Guadagnato {formatEuro(t.dovuto)}
                                {!isSocio && c.responsabile_id && <> · team di {dati.profili.find((r) => r.id === c.responsabile_id)?.nome ?? '—'}</>}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-500">Da pagare</p>
                              <p className={`text-sm font-semibold tabular-nums ${t.residuo > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{formatEuro(t.residuo)}</p>
                            </div>
                          </Link>
                        </li>
                      )
                    })}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </>
  )
}
