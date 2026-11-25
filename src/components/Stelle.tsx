const STELLA = 'M12 2.8l2.8 5.7 6.3.9-4.5 4.4 1 6.2L12 17l-5.6 3 1-6.2L2.9 9.4l6.3-.9L12 2.8Z'

function Stella({ piena, className }: { piena: boolean; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} ${piena ? 'text-amber-400' : 'text-slate-300'}`} fill="currentColor" aria-hidden="true">
      <path d={STELLA} />
    </svg>
  )
}

/** Voto da 1 a 5 in sola lettura. */
export function Stelle({ voto, className = 'h-5 w-5' }: { voto: number; className?: string }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${voto.toLocaleString('it-IT', { maximumFractionDigits: 1 })} stelle su 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Stella key={n} piena={n <= Math.round(voto)} className={className} />
      ))}
    </span>
  )
}

/** Scelta del voto (per scrivere la recensione). */
export function ScegliStelle({ voto, onScegli }: { voto: number; onScegli: (n: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Voto">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={voto === n}
          aria-label={n === 1 ? '1 stella' : `${n} stelle`}
          className="rounded-lg p-1 transition hover:scale-110"
          onClick={() => onScegli(n)}
        >
          <Stella piena={n <= voto} className="h-9 w-9" />
        </button>
      ))}
    </div>
  )
}
