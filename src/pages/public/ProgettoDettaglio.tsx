import { Link, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Reveal } from '../../components/Reveal'
import { Screenshot } from '../../components/Screenshot'
import { Seo } from '../../components/Seo'
import { Caricamento, MessaggioErrore, Vuoto } from '../../components/ui'
import { formatData, hostname } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { ProgettoPortfolio } from '../../lib/types'
import { esegui, useQuery } from '../../lib/useQuery'

const UUID_RE = /^[0-9a-f-]{36}$/i

export default function ProgettoDettaglio() {
  const { id = '' } = useParams()
  const { dati: p, caricamento, errore, ricarica } = useQuery(
    () =>
      UUID_RE.test(id)
        ? esegui<ProgettoPortfolio | null>(supabase.from('portfolio').select('*').eq('id', id).maybeSingle())
        : Promise.resolve(null),
    [id],
  )

  if (caricamento) return <Caricamento pieno />
  if (errore)
    return (
      <div className="container-sito py-16">
        <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>
      </div>
    )
  if (!p)
    return (
      <div className="container-sito py-16">
        <Seo titolo="Progetto non trovato" />
        <Vuoto titolo="Progetto non trovato">
          <Link to="/portfolio" className="font-semibold text-brand-700">
            Torna al portfolio
          </Link>
        </Vuoto>
      </div>
    )

  const immagini = [p.screenshot_url, ...(p.galleria ?? [])].filter(Boolean) as string[]

  return (
    <>
      <Seo titolo={p.nome} />
      <section className="container-sito py-10 sm:py-14">
        <Link to="/portfolio" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
          <Icon name="arrowLeft" className="h-4 w-4" /> Portfolio
        </Link>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <Reveal>
            {p.categoria && (
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{p.categoria}</span>
            )}
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">{p.nome}</h1>
            {p.cliente && <p className="mt-2 text-slate-500">Cliente: {p.cliente}</p>}
          </Reveal>
          {p.url && (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn-primary w-full px-6 py-3 sm:w-auto">
              Visita il sito <Icon name="external" className="h-4 w-4" />
            </a>
          )}
        </div>

        <Reveal className="mt-8">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-xl shadow-slate-900/5">
            <div className="flex items-center gap-1.5 border-b border-slate-200 bg-white px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              {p.url && <span className="ml-3 truncate rounded-md bg-slate-100 px-3 py-0.5 text-xs text-slate-500">{hostname(p.url)}</span>}
            </div>
            <div className="aspect-[16/9]">
              <Screenshot src={immagini[0]} nome={p.nome} url={p.url} />
            </div>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-3">
          <Reveal className="lg:col-span-2">
            <h2 className="text-xl font-bold text-slate-900">Il progetto</h2>
            <p className="mt-3 leading-relaxed whitespace-pre-line text-slate-600">{p.descrizione}</p>

            {p.funzionalita?.length > 0 && (
              <>
                <h2 className="mt-10 text-xl font-bold text-slate-900">Funzionalità realizzate</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {p.funzionalita.map((f) => (
                    <li key={f} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                        <Icon name="check" className="h-3.5 w-3.5" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Reveal>

          <Reveal ritardo={100}>
            <aside className="card space-y-5 p-6">
              {p.tecnologie?.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-slate-500">Tecnologie</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.tecnologie.map((t) => (
                      <span key={t} className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {p.data_consegna && (
                <div>
                  <h2 className="text-sm font-semibold text-slate-500">Consegna</h2>
                  <p className="mt-1 font-medium text-slate-800">{formatData(p.data_consegna)}</p>
                </div>
              )}
              {p.url && (
                <div>
                  <h2 className="text-sm font-semibold text-slate-500">Sito</h2>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium break-all text-brand-700 hover:underline">
                    {hostname(p.url)} <Icon name="external" className="h-4 w-4 shrink-0" />
                  </a>
                </div>
              )}
            </aside>
          </Reveal>
        </div>

        {immagini.length > 1 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-slate-900">Galleria</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {immagini.slice(1).map((src) => (
                <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-slate-200">
                  <img src={src} alt={`Schermata di ${p.nome}`} loading="lazy" className="w-full transition hover:scale-[1.02]" />
                </a>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  )
}
