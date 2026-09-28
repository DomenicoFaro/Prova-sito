import { useState } from 'react'
import { hostname } from '../lib/format'

const GRADIENTI = [
  'from-brand-500 to-violet-600',
  'from-sky-500 to-brand-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-rose-500',
  'from-fuchsia-500 to-brand-600',
]

function hash(s: string) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

/** Screenshot del sito, con un segnaposto elegante se l'immagine manca. */
export function Screenshot({
  src,
  nome,
  url,
  className = '',
}: {
  src: string | null | undefined
  nome: string
  url?: string | null
  className?: string
}) {
  const [errore, setErrore] = useState(false)

  if (src && !errore) {
    return (
      <img
        src={src}
        alt={`Screenshot del sito ${nome}`}
        loading="lazy"
        onError={() => setErrore(true)}
        className={`h-full w-full object-cover object-top ${className}`}
      />
    )
  }

  return (
    <div
      className={`flex h-full w-full flex-col bg-gradient-to-br ${GRADIENTI[hash(nome) % GRADIENTI.length]} ${className}`}
      aria-label={`Anteprima di ${nome}`}
    >
      <div className="flex items-center gap-1.5 bg-black/10 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-white/60" />
        <span className="h-2 w-2 rounded-full bg-white/60" />
        <span className="h-2 w-2 rounded-full bg-white/60" />
        {url && <span className="ml-2 truncate text-[10px] font-medium text-white/80">{hostname(url)}</span>}
      </div>
      <div className="grid flex-1 place-items-center p-4 text-center">
        <span className="text-xl font-bold tracking-tight text-white drop-shadow-sm sm:text-2xl">{nome}</span>
      </div>
    </div>
  )
}
