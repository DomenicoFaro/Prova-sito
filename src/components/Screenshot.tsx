import { useState } from 'react'

const SFONDI = [
  'bg-brand-900 text-lime-accento',
  'bg-lime-accento text-brand-950',
  'bg-brand-600 text-white',
  'bg-brand-100 text-brand-900',
]

function hash(s: string) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

/** Screenshot del sito, con un segnaposto con il nome se l'immagine manca. */
export function Screenshot({ src, nome, className = '' }: { src: string | null | undefined; nome: string; className?: string }) {
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
    <div className={`grid h-full w-full place-items-center p-6 text-center ${SFONDI[hash(nome) % SFONDI.length]} ${className}`} aria-label={`Anteprima di ${nome}`}>
      <span className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{nome}</span>
    </div>
  )
}
