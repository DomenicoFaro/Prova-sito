import { Link } from 'react-router-dom'
import { SITO } from '../../config'
import { useAuth } from '../../auth/AuthProvider'
import { Icon } from '../../components/Icon'
import { ProjectCard } from '../../components/ProjectCard'
import { Reveal } from '../../components/Reveal'
import { Seo } from '../../components/Seo'
import { Caricamento, MessaggioErrore } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import type { ProgettoPortfolio } from '../../lib/types'
import { esegui, useQuery } from '../../lib/useQuery'

export default function Home() {
  const { session } = useAuth()
  const { dati, caricamento, errore, ricarica } = useQuery(() =>
    esegui<ProgettoPortfolio[]>(
      supabase.from('portfolio').select('*').order('data_consegna', { ascending: false, nullsFirst: false }).limit(3),
    ),
  )

  return (
    <>
      <Seo />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-200/70 via-violet-200/50 to-transparent blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(15_23_42/0.06)_1px,transparent_0)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        </div>
        <div className="container-sito pt-16 pb-20 text-center sm:pt-24 sm:pb-24">
          <Reveal>
            <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
              {SITO.titolo}
            </h1>
          </Reveal>
          <Reveal ritardo={80}>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">{SITO.descrizione}</p>
          </Reveal>
          <Reveal ritardo={160}>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/portfolio" className="btn-primary px-6 py-3 text-base">
                Vai al portfolio <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
              <Link to={session ? '/area' : '/login'} className="btn-secondary px-6 py-3 text-base">
                <Icon name="lock" className="h-4 w-4" /> Area riservata
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Ultimi lavori */}
      <section className="pb-20">
        <div className="container-sito">
          <Reveal className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Ultimi progetti</h2>
            <Link to="/portfolio" className="btn-secondary">
              Tutti i progetti <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </Reveal>
          <div className="mt-8">
            {caricamento ? (
              <Caricamento testo="Carico i progetti…" />
            ) : errore ? (
              <MessaggioErrore onRiprova={ricarica}>Non è stato possibile caricare i progetti. {errore}</MessaggioErrore>
            ) : dati && dati.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {dati.map((p, i) => (
                  <Reveal key={p.id} ritardo={i * 80}>
                    <ProjectCard progetto={p} />
                  </Reveal>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">Nessun progetto pubblicato.</p>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
