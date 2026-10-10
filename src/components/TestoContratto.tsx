import { blocchiContratto } from '../lib/ordini'

/** Mostra il testo di un contratto (titoli "# …" e paragrafi) in un riquadro leggibile. */
export function TestoContratto({ testo, className = 'max-h-96' }: { testo: string; className?: string }) {
  return (
    <div className={`overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700 ${className}`} tabIndex={0}>
      {blocchiContratto(testo).map((b, i) =>
        b.titolo ? (
          <h3 key={i} className="mt-5 mb-1 text-sm font-bold text-slate-900 first:mt-0">
            {b.testo}
          </h3>
        ) : (
          <p key={i} className="mt-1">
            {b.testo}
          </p>
        ),
      )}
    </div>
  )
}
