import { useMemo, useState } from 'react'
import { formatEuro } from '../lib/format'
import { dataRiferimento } from '../lib/periodo'
import type { Guadagno } from '../lib/types'

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

/** Arrotonda il massimo dell'asse a un valore "tondo" (1, 2, 2.5, 5 × 10^n). */
function scalaTonda(max: number) {
  if (max <= 0) return 100
  const pot = 10 ** Math.floor(Math.log10(max))
  for (const m of [1, 2, 2.5, 5, 10]) if (max <= m * pot) return m * pot
  return 10 * pot
}

function euroCompatto(v: number) {
  if (v >= 1000) return `${(v / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k €`
  return `${v.toLocaleString('it-IT')} €`
}

/** Grafico a barre dei guadagni maturati mese per mese (ultimi 12 mesi). */
export function GraficoMensile({ righe, mesi = 12 }: { righe: Guadagno[]; mesi?: number }) {
  const [attivo, setAttivo] = useState<number | null>(null)

  const dati = useMemo(() => {
    const oggi = new Date()
    const bucket = Array.from({ length: mesi }, (_, i) => {
      const d = new Date(oggi.getFullYear(), oggi.getMonth() - (mesi - 1 - i), 1)
      return { anno: d.getFullYear(), mese: d.getMonth(), guadagno: 0, progetti: 0 }
    })
    for (const r of righe) {
      const d = dataRiferimento(r)
      const b = bucket.find((x) => x.anno === d.getFullYear() && x.mese === d.getMonth())
      if (b) {
        b.guadagno += Number(r.guadagno)
        b.progetti += 1
      }
    }
    return bucket
  }, [righe, mesi])

  const max = scalaTonda(Math.max(...dati.map((d) => d.guadagno)))
  const tacche = [0, 0.5, 1].map((f) => max * f)
  const totale = dati.reduce((s, d) => s + d.guadagno, 0)

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-slate-900">Guadagni mese per mese</h2>
        <p className="text-sm text-slate-500">
          Ultimi {mesi} mesi: <strong className="text-slate-900 tabular-nums">{formatEuro(totale)}</strong>
        </p>
      </div>
      <p className="mt-0.5 text-xs text-slate-500">Guadagno maturato per mese di consegna del progetto.</p>

      <div className="relative mt-6 flex h-52 gap-2" role="img" aria-label={`Grafico dei guadagni degli ultimi ${mesi} mesi, totale ${formatEuro(totale)}`}>
        {/* Asse Y */}
        <div className="relative w-10 shrink-0 text-right text-[11px] text-slate-400 tabular-nums">
          {tacche.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(t / max) * 100}%` }}>
              {euroCompatto(t)}
            </span>
          ))}
        </div>
        {/* Area del grafico */}
        <div className="relative flex-1">
          {tacche.map((t) => (
            <div key={t} className={`absolute inset-x-0 border-t ${t === 0 ? 'border-slate-300' : 'border-dashed border-slate-100'}`} style={{ bottom: `${(t / max) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end">
            {dati.map((d, i) => {
              const h = (d.guadagno / max) * 100
              const sel = attivo === i
              return (
                <div
                  key={`${d.anno}-${d.mese}`}
                  className="relative flex h-full flex-1 cursor-default items-end justify-center"
                  onMouseEnter={() => setAttivo(i)}
                  onMouseLeave={() => setAttivo(null)}
                  onClick={() => setAttivo(sel ? null : i)}
                >
                  <div
                    className={`w-[55%] max-w-7 rounded-t transition-colors ${sel ? 'bg-brand-700' : 'bg-brand-500'}`}
                    style={{ height: `${h}%`, minHeight: d.guadagno > 0 ? 2 : 0 }}
                  />
                  {sel && (
                    <div
                      className={`pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg ${i < 2 ? 'left-0' : i > dati.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}
                      style={{ bottom: `${Math.min(h, 85)}%` }}
                    >
                      <p className="font-semibold capitalize">{MESI[d.mese]} {d.anno}</p>
                      <p className="tabular-nums">{formatEuro(d.guadagno)}</p>
                      <p className="text-slate-400">{d.progetti} {d.progetti === 1 ? 'progetto' : 'progetti'}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {/* Asse X */}
      <div className="mt-2 flex pl-12">
        {dati.map((d, i) => (
          <span key={`${d.anno}-${d.mese}`} className={`flex-1 text-center text-[11px] text-slate-400 ${i % 2 === 1 ? 'max-sm:invisible' : ''}`}>
            {MESI[d.mese]}
          </span>
        ))}
      </div>

      {/* Versione tabellare per screen reader */}
      <table className="sr-only">
        <caption>Guadagni mensili</caption>
        <thead>
          <tr><th>Mese</th><th>Guadagno</th></tr>
        </thead>
        <tbody>
          {dati.map((d) => (
            <tr key={`${d.anno}-${d.mese}`}><td>{MESI[d.mese]} {d.anno}</td><td>{formatEuro(d.guadagno)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
