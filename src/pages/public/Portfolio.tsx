import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProjectCard } from '../../components/ProjectCard'
import { Reveal } from '../../components/Reveal'
import { Seo } from '../../components/Seo'
import { Caricamento, MessaggioErrore, Vuoto } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import type { ProgettoPortfolio } from '../../lib/types'
import { esegui, useQuery } from '../../lib/useQuery'

export default function Portfolio() {
  const [params, setParams] = useSearchParams()
  const filtro = params.get('categoria') ?? ''

  const { dati, caricamento, errore, ricarica } = useQuery(() =>
    esegui<ProgettoPortfolio[]>(
      supabase.from('portfolio').select('*').order('data_consegna', { ascending: false, nullsFirst: false }),
    ),
  )

  const categorie = useMemo(
    () => Array.from(new Set((dati ?? []).map((p) => p.categoria).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'it')),
    [dati],
  )
  const filtrati = (dati ?? []).filter((p) => !filtro || p.categoria === filtro)

  const scegli = (c: string) => {
    const next = new URLSearchParams(params)
    if (c) next.set('categoria', c)
    else next.delete('categoria')
    setParams(next, { replace: true })
  }

  return (
    <>
      <Seo titolo="Portfolio" descrizione="I siti web, gli e-commerce e le web app che abbiamo realizzato per i nostri clienti." />
      <section className="border-b border-slate-100 bg-gradient-to-b from-brand-50/60 to-white">
        <div className="container-sito py-14 sm:py-20">
          <Reveal>
            <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">Portfolio</p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">I nostri lavori</h1>
            <p className="mt-4 max-w-2xl text-slate-600">
              Una selezione dei siti che abbiamo progettato e sviluppato. Ognuno è pensato su misura per gli obiettivi del cliente.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container-sito py-10 sm:py-14">
        {categorie.length > 1 && (
          <div className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Filtra per categoria">
            {['', ...categorie].map((c) => {
              const attivo = c === filtro
              return (
                <button
                  key={c || 'tutti'}
                  role="tab"
                  aria-selected={attivo}
                  onClick={() => scegli(c)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${attivo ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {c || 'Tutti'}
                </button>
              )
            })}
          </div>
        )}

        {caricamento ? (
          <Caricamento testo="Carico il portfolio…" />
        ) : errore ? (
          <MessaggioErrore onRiprova={ricarica}>Non è stato possibile caricare il portfolio. {errore}</MessaggioErrore>
        ) : filtrati.length === 0 ? (
          <Vuoto titolo="Nessun progetto in questa categoria" />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtrati.map((p, i) => (
              <Reveal key={p.id} ritardo={(i % 3) * 80}>
                <ProjectCard progetto={p} />
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
