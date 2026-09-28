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

      {/* Hero con il logo (lo sfondo nero combacia con quello dell'immagine) */}
      <section className="bg-black">
        <div className="container-sito pt-10 pb-14 text-center sm:pt-14 sm:pb-20">
          <Reveal>
            <h1>
              <img src="/logo-completo.jpg" alt={SITO.titolo} width={900} height={366} className="mx-auto w-full max-w-2xl" />
            </h1>
          </Reveal>
          <Reveal ritardo={120}>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/portfolio" className="btn-primary px-6 py-3 text-base">
                Vai al portfolio <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
              <Link to={session ? '/area' : '/login'} className="btn px-6 py-3 text-base text-white ring-1 ring-white/25 hover:bg-white/10">
                <Icon name="lock" className="h-4 w-4" /> Area riservata
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Ultimi lavori */}
      <section className="py-16 sm:py-20">
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
