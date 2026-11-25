import { Link } from 'react-router-dom'
import type { Lavoro } from '../data/lavori'
import { hostname } from '../lib/format'
import { Icon } from './Icon'
import { Finestra } from './Mockup'
import { Screenshot } from './Screenshot'

export function ProjectCard({ progetto }: { progetto: Lavoro }) {
  const dettaglio = `/portfolio/${progetto.id}`
  return (
    <article className="group flex h-full flex-col">
      <Link to={dettaglio} className="block overflow-hidden rounded-3xl bg-nebbia px-5 pt-6 transition-colors group-hover:bg-brand-100 sm:px-8 sm:pt-9" tabIndex={-1} aria-hidden="true">
        {/* La finestra sporge leggermente dal fondo del riquadro */}
        <div className="-mb-6 transition duration-500 group-hover:-translate-y-2">
          <Finestra indirizzo={hostname(progetto.url)}>
            <Screenshot src={progetto.screenshot_url} nome={progetto.nome} />
          </Finestra>
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-1 pt-6">
        {progetto.categoria && <p className="sopratitolo">{progetto.categoria}</p>}
        <h3 className="mt-1 text-2xl font-bold tracking-tight text-brand-950">
          <Link to={dettaglio} className="hover:text-brand-600">
            {progetto.nome}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 leading-relaxed text-slate-600">{progetto.descrizione}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-brand-900">
          <Link to={dettaglio} className="inline-flex items-center gap-1.5 hover:text-brand-500">
            Dettagli <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
          {progetto.url && (
            <a href={progetto.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-brand-500">
              Visita il sito <Icon name="external" className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

/** Segnaposto delle stesse dimensioni delle card, mentre i progetti si caricano. */
export function ProjectCardScheletro() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="aspect-[4/3] rounded-3xl bg-nebbia" />
      <div className="mt-6 h-4 w-24 rounded-full bg-nebbia" />
      <div className="mt-3 h-6 w-56 rounded-full bg-nebbia" />
      <div className="mt-3 h-4 w-full rounded-full bg-nebbia" />
      <div className="mt-8 h-4 w-40 rounded-full bg-nebbia" />
    </div>
  )
}
