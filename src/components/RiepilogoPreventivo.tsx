import { formatPrezzoVoce, type Preventivo } from '../lib/configuratore'
import { formatEuro } from '../lib/format'

interface Props {
  preventivo: Preventivo
  urgenzaRichiesta: boolean
  /** Testo sotto il totale (es. «Preventivo indicativo, soggetto a conferma…»). */
  avviso?: string
}

/** Riepilogo del preventivo indicativo calcolato dal configuratore (richiesta del cliente). */
export function RiepilogoPreventivo({ preventivo: p, urgenzaRichiesta, avviso }: Props) {
  const parziale = p.approvazione_manuale
  return (
    <div>
      <dl className="divide-y divide-slate-100 text-sm">
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-slate-700">
            <span className="font-semibold text-slate-900">{p.tipologia.nome}</span>
            <span className="block text-xs text-slate-500">Prezzo base</span>
          </dt>
          <dd className="shrink-0 font-semibold tabular-nums">
            {p.tipologia.modalita === 'preventivo' ? 'Su preventivo' : formatPrezzoVoce({ prezzo: p.tipologia.prezzo, modalita: p.tipologia.modalita })}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-slate-700">
            Pagine: {p.pagine}
            <span className="block text-xs text-slate-500">
              {p.pagine_extra > 0 ? `${p.pagine_incluse} incluse + ${p.pagine_extra} aggiuntive` : `${p.pagine_incluse} incluse`}
            </span>
          </dt>
          <dd className="shrink-0 tabular-nums">{p.pagine_extra_importo > 0 ? formatEuro(p.pagine_extra_importo) : '—'}</dd>
        </div>
        {p.righe.map((r) => (
          <div key={r.codice} className="flex justify-between gap-4 py-2">
            <dt className="text-slate-700">
              {r.nome}
              {r.quantita > 1 ? ` × ${r.quantita}` : ''}
              {r.modalita !== 'fisso' && !r.incluso && <span className="block text-xs text-amber-700">Prezzo indicativo, da confermare</span>}
            </dt>
            <dd className="shrink-0 tabular-nums">{r.incluso ? <span className="text-emerald-700">Inclusa</span> : formatEuro(r.importo)}</dd>
          </div>
        ))}
        {urgenzaRichiesta && (
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-slate-700">
              Consegna urgente
              <span className="block text-xs text-slate-500">
                {p.urgenza_confermata ? `Supplemento del ${p.urgenza_percentuale}% confermato` : `Supplemento del ${p.urgenza_percentuale}% richiesto: solo previa conferma di FormaWeb`}
              </span>
            </dt>
            <dd className="shrink-0 tabular-nums text-slate-500">{p.urgenza_confermata ? formatEuro(p.urgenza_importo) : `circa ${formatEuro(p.urgenza_importo)}`}</dd>
          </div>
        )}
      </dl>
      <div className="mt-2 flex items-baseline justify-between gap-4 rounded-xl bg-slate-900 px-4 py-3 text-white">
        <span className="font-semibold">Totale indicativo{parziale ? ' (parziale)' : ''}</span>
        <span className="text-xl font-extrabold tabular-nums">
          {parziale ? 'da ' : ''}
          {formatEuro(p.totale)}
        </span>
      </div>
      {avviso && <p className="mt-2 text-xs text-slate-500">{avviso}</p>}
    </div>
  )
}
