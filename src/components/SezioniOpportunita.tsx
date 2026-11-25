import { Icon } from './Icon'
import { Vuoto } from './ui'
import type { Sezione } from '../lib/opportunita'

/** Griglia di "cartelle" (categorie, le mie opportunità, persone) tra cui scegliere. */
export function GrigliaSezioni({ sezioni, onScegli }: { sezioni: Sezione[]; onScegli: (chiave: string) => void }) {
  if (sezioni.length === 0) {
    return (
      <div className="card">
        <Vuoto icona="pin" titolo="Nessuna categoria al momento" />
      </div>
    )
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sezioni.map((s) => (
        <li key={s.chiave}>
          <button
            onClick={() => onScegli(s.chiave)}
            className="card flex w-full items-center gap-4 p-4 text-left transition hover:border-brand-300 hover:shadow-md"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name={s.icona} className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-slate-900">{s.titolo}</span>
              {s.sottotitolo && <span className="block truncate text-xs text-slate-500">{s.sottotitolo}</span>}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-slate-700">{s.conteggio}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Barra "← Tutte le categorie · Nome sezione". */
export function BarraSezione({ titolo, onIndietro }: { titolo: string; onIndietro: () => void }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <button onClick={onIndietro} className="btn-secondary py-1.5">
        <Icon name="arrowLeft" className="h-4 w-4" /> Tutte le categorie
      </button>
      <h2 className="truncate text-lg font-semibold text-slate-900">{titolo}</h2>
    </div>
  )
}
