import { useMemo, useState } from 'react'
import { useAuth } from '../../../auth/AuthProvider'
import { Icon } from '../../../components/Icon'
import { BadgeEsitoOpportunita, Caricamento, IntestazionePagina, MessaggioErrore, Spinner, Vuoto } from '../../../components/ui'
import { messaggioErrore, supabase } from '../../../lib/supabase'
import type { EsitoOpportunita, EsitoOpportunitaRiga, Opportunita as OpportunitaRiga } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

export default function Opportunita() {
  const { profilo } = useAuth()
  const [inCorso, setInCorso] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  const { dati, caricamento, errore: erroreCaricamento, ricarica } = useQuery(async () => {
    const [opportunita, esiti] = await Promise.all([
      esegui<OpportunitaRiga[]>(supabase.from('opportunita').select('*').eq('attiva', true).order('created_at', { ascending: false })),
      esegui<EsitoOpportunitaRiga[]>(supabase.from('opportunita_esiti').select('*').eq('collaboratore_id', profilo?.id ?? '')),
    ])
    return { opportunita, esiti }
  }, [profilo?.id])

  const esiti = useMemo(() => new Map((dati?.esiti ?? []).map((e) => [e.opportunita_id, e.esito])), [dati])

  /** Salva l'esito; premendo di nuovo lo stesso tasto lo annulla. */
  async function segna(o: OpportunitaRiga, esito: EsitoOpportunita) {
    if (!profilo) return
    setErrore(null)
    setInCorso(o.id)
    const { error } =
      esiti.get(o.id) === esito
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
        sottotitolo="Attività con alta vendibilità scelte per te. Aprile su Google Maps e segna com'è andata."
      />

      {caricamento && !dati ? (
        <Caricamento />
      ) : erroreCaricamento ? (
        <MessaggioErrore onRiprova={ricarica}>{erroreCaricamento}</MessaggioErrore>
      ) : !dati?.opportunita.length ? (
        <div className="card">
          <Vuoto icona="pin" titolo="Nessuna opportunità al momento">
            Quando l'amministratore ne aggiunge una, la trovi qui.
          </Vuoto>
        </div>
      ) : (
        <div className="space-y-4">
          {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
          <ul className="grid gap-4 lg:grid-cols-2">
            {dati.opportunita.map((o) => {
              const esito = esiti.get(o.id) ?? null
              const occupato = inCorso === o.id
              return (
                <li key={o.id} className="card flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{o.nome}</p>
                      <p className="truncate text-sm text-slate-500">
                        {[o.categoria, o.indirizzo].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <BadgeEsitoOpportunita esito={esito} />
                  </div>
                  {o.dettagli && <p className="mt-3 text-sm whitespace-pre-line text-slate-700">{o.dettagli}</p>}
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <a href={o.maps_url} target="_blank" rel="noopener noreferrer" className="btn-secondary py-1.5">
                      <Icon name="pin" className="h-4 w-4" /> Google Maps
                    </a>
                    <button
                      className={`btn-secondary py-1.5 ${esito === 'fatto' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : ''}`}
                      disabled={occupato}
                      aria-pressed={esito === 'fatto'}
                      onClick={() => segna(o, 'fatto')}
                    >
                      {occupato ? <Spinner className="h-4 w-4" /> : <Icon name="check" className="h-4 w-4" />} Fatto
                    </button>
                    <button
                      className={`btn-secondary py-1.5 ${esito === 'non_accettato' ? 'border-red-300 bg-red-50 text-red-700' : ''}`}
                      disabled={occupato}
                      aria-pressed={esito === 'non_accettato'}
                      onClick={() => segna(o, 'non_accettato')}
                    >
                      <Icon name="ban" className="h-4 w-4" /> Non accettato
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
