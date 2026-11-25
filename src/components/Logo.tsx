import { Link } from 'react-router-dom'
import { SITO } from '../config'

/** Marchio "Λ" + nome. Con `chiaro` va su fondi scuri. */
export function Logo({ chiaro = false, className = 'text-xl' }: { chiaro?: boolean; className?: string }) {
  return (
    <Link to="/" className={`inline-flex shrink-0 items-center gap-[0.5em] ${className}`} aria-label={`${SITO.titolo} – Home`}>
      <svg viewBox="0 0 64 64" className="h-[1.8em] w-[1.8em]" aria-hidden="true">
        <rect width="64" height="64" rx="18" className={chiaro ? 'fill-lime-accento' : 'fill-brand-950'} />
        <path d="M13 47 32 15l19 32H40l-8-14-8 14Z" className={chiaro ? 'fill-brand-950' : 'fill-lime-accento'} />
      </svg>
      <span className={`font-display leading-none font-bold tracking-tight ${chiaro ? 'text-white' : 'text-brand-950'}`}>
        forma<span className={chiaro ? 'text-lime-accento' : 'text-brand-500'}>web</span>
      </span>
    </Link>
  )
}
