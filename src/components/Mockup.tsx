import type { ReactNode } from 'react'

/** Cornice di un browser attorno a una schermata. */
export function Finestra({ indirizzo, children, className = '' }: { indirizzo?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl bg-white shadow-2xl ring-1 shadow-brand-950/20 ring-black/5 sm:rounded-2xl ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2 sm:px-4 sm:py-2.5">
        <span className="h-2 w-2 rounded-full bg-slate-200 sm:h-2.5 sm:w-2.5" />
        <span className="h-2 w-2 rounded-full bg-slate-200 sm:h-2.5 sm:w-2.5" />
        <span className="h-2 w-2 rounded-full bg-slate-200 sm:h-2.5 sm:w-2.5" />
        {indirizzo && (
          <span className="ml-2 truncate rounded-full bg-slate-100 px-3 py-0.5 text-[10px] text-slate-500 sm:text-xs">{indirizzo}</span>
        )}
      </div>
      <div className="aspect-[16/10] bg-slate-100">{children}</div>
    </div>
  )
}

/** Cornice di uno smartphone. */
export function Telefono({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[14%/6.5%] border-[3px] border-slate-900 bg-slate-900 shadow-2xl shadow-black/30 sm:border-[6px] ${className}`}>
      <img src={src} alt={alt} width={780} height={1688} loading="lazy" className="aspect-[390/844] w-full rounded-[11%/5%] object-cover object-top" />
    </div>
  )
}
