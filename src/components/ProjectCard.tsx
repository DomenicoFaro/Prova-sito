import { Link } from 'react-router-dom'
import type { ProgettoPortfolio } from '../lib/types'
import { Icon } from './Icon'
import { Screenshot } from './Screenshot'

export function ProjectCard({ progetto }: { progetto: ProgettoPortfolio }) {
  return (
    <article className="group card flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-900/5">
      <Link to={`/portfolio/${progetto.id}`} className="relative block aspect-[16/10] overflow-hidden bg-slate-100">
        <div className="h-full w-full transition duration-500 group-hover:scale-[1.04]">
          <Screenshot src={progetto.screenshot_url} nome={progetto.nome} url={progetto.url} />
        </div>
        <span className="sr-only">Dettagli di {progetto.nome}</span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        {progetto.categoria && (
          <span className="mb-2 w-fit rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
            {progetto.categoria}
          </span>
        )}
        <h3 className="text-lg font-bold text-slate-900">
          <Link to={`/portfolio/${progetto.id}`} className="hover:text-brand-700">
            {progetto.nome}
          </Link>
        </h3>
        {progetto.cliente && progetto.cliente !== progetto.nome && (
          <p className="text-sm text-slate-500">{progetto.cliente}</p>
        )}
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600">{progetto.descrizione}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {progetto.url && (
            <a href={progetto.url} target="_blank" rel="noopener noreferrer" className="btn-primary py-2">
              Visita il sito <Icon name="external" className="h-4 w-4" />
            </a>
          )}
          <Link to={`/portfolio/${progetto.id}`} className="btn-ghost py-2">
            Dettagli
          </Link>
        </div>
      </div>
    </article>
  )
}
