import { Link } from 'react-router-dom'
import { AGENZIA, SERVIZI } from '../../config'
import { Icon } from '../../components/Icon'
import { ProjectCard } from '../../components/ProjectCard'
import { Reveal } from '../../components/Reveal'
import { Seo } from '../../components/Seo'
import { Caricamento, MessaggioErrore } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import type { ProgettoPortfolio } from '../../lib/types'
import { esegui, useQuery } from '../../lib/useQuery'

export default function Home() {
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
        <div className="container-sito pt-16 pb-20 text-center sm:pt-24 sm:pb-28">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-semibold text-brand-700 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> Agenzia web · {AGENZIA.citta}
            </span>
          </Reveal>
          <Reveal ritardo={80}>
            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
              {AGENZIA.nome}
              <span className="mt-2 block bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent">
                {AGENZIA.slogan}
              </span>
            </h1>
          </Reveal>
          <Reveal ritardo={160}>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">{AGENZIA.descrizione}</p>
          </Reveal>
          <Reveal ritardo={240}>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/portfolio" className="btn-primary px-6 py-3 text-base">
                Guarda i lavori <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
              <Link to="/contatti" className="btn-secondary px-6 py-3 text-base">
                Contattaci
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Servizi */}
      <section className="bg-slate-50 py-20" id="servizi">
        <div className="container-sito">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">Servizi</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Cosa possiamo fare per te</h2>
            <p className="mt-3 text-slate-600">Dalla prima idea alla messa online, con assistenza anche dopo la consegna.</p>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVIZI.map((s, i) => (
              <Reveal key={s.titolo} ritardo={i * 60}>
                <div className="card h-full p-6 transition hover:-translate-y-0.5 hover:shadow-md">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon name={s.icona} className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{s.titolo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.testo}</p>
                </div>
              </Reveal>
            ))}
            <Reveal ritardo={SERVIZI.length * 60}>
              <Link
                to="/contatti"
                className="flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 p-6 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div>
                  <h3 className="text-lg font-bold">Hai un progetto in mente?</h3>
                  <p className="mt-2 text-sm text-brand-100">Raccontacelo: ti rispondiamo con una proposta su misura.</p>
                </div>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
                  Parliamone <Icon name="arrowRight" className="h-4 w-4" />
                </span>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Ultimi lavori */}
      <section className="py-20">
        <div className="container-sito">
          <Reveal className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">Portfolio</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Ultimi progetti</h2>
            </div>
            <Link to="/portfolio" className="btn-secondary">
              Tutti i lavori <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </Reveal>
          <div className="mt-10">
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
              <p className="text-slate-500">Presto qui i nostri lavori.</p>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20">
        <div className="container-sito">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-14 text-center sm:px-12">
              <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-brand-600/40 blur-3xl" aria-hidden="true" />
              <h2 className="relative text-3xl font-bold tracking-tight text-white sm:text-4xl">Pronto a far crescere la tua attività online?</h2>
              <p className="relative mx-auto mt-3 max-w-xl text-slate-300">Preventivo gratuito e senza impegno. Ti rispondiamo entro 24 ore lavorative.</p>
              <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link to="/contatti" className="btn-primary px-6 py-3 text-base">
                  Richiedi un preventivo
                </Link>
                <a href={`https://wa.me/${AGENZIA.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn px-6 py-3 text-base text-white ring-1 ring-white/20 hover:bg-white/10">
                  <Icon name="chat" className="h-5 w-5" /> Scrivici su WhatsApp
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
