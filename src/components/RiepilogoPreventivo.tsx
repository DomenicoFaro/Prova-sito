import { formatPrezzoVoce, type Preventivo, type ProvaPreventivo } from '../lib/configuratore'
import { formatEuro } from '../lib/format'

interface Props {
  preventivo: Preventivo
  urgenzaRichiesta: boolean
  /** Testo sotto il totale (es. «Preventivo indicativo, soggetto a conferma…»). */
  avviso?: string
}

/** Come funziona la «Prova un mese»: cosa si paga adesso e cosa dopo il mese. */
export function PannelloProva({ prova, parziale = false }: { prova: ProvaPreventivo; parziale?: boolean }) {
  const da = parziale ? 'da ' : ''
  return (
    <div className="space-y-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
      <p className="font-semibold text-slate-900">Come funziona la prova di un mese</p>
      <dl className="divide-y divide-brand-100 text-sm">
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-slate-700">Mese di prova</dt>
          <dd className="shrink-0 tabular-nums">{formatEuro(prova.prezzo_base)}</dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-slate-700">
            Pagine e funzionalità aggiuntive
            {prova.extra_pieno > 0 && <span className="block text-xs text-emerald-700">Sconto del {prova.sconto_percentuale}% per la prova: risparmi {formatEuro(prova.risparmio)}</span>}
          </dt>
          <dd className="shrink-0 tabular-nums">
            {prova.extra_pieno > 0 ? (
              <>
                <s className="mr-1.5 text-slate-400">{formatEuro(prova.extra_pieno)}</s>
                {formatEuro(prova.extra_scontati)}
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
      </dl>
      <div className="flex items-baseline justify-between gap-4 rounded-xl bg-slate-900 px-4 py-3 text-white">
        <span className="font-semibold">Da pagare ora</span>
        <span className="text-xl font-extrabold tabular-nums" aria-live="polite">
          {da}
          {formatEuro(prova.da_pagare_ora)}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="text-sm text-slate-700">
          Dopo il mese, <strong>solo se il sito ti è piaciuto</strong>
          <span className="block text-xs text-slate-500">Prezzo pieno del sito: {formatEuro(prova.totale_sito)}</span>
        </span>
        <span className="text-lg font-bold tabular-nums text-slate-900">
          {da}
          {formatEuro(prova.resto_dopo)}
        </span>
      </div>
      <p className="text-xs text-slate-500">Se alla fine del mese non ti convince, non paghi il resto.</p>
    </div>
  )
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
      {p.prova ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-baseline justify-between gap-4 rounded-xl bg-slate-100 px-4 py-2.5 text-sm text-slate-700">
            <span className="font-semibold">Prezzo pieno del sito{parziale ? ' (parziale)' : ''}</span>
            <span className="font-bold tabular-nums">
              {parziale ? 'da ' : ''}
              {formatEuro(p.totale)}
            </span>
          </div>
          <PannelloProva prova={p.prova} parziale={parziale} />
        </div>
      ) : (
        <div className="mt-2 flex items-baseline justify-between gap-4 rounded-xl bg-slate-900 px-4 py-3 text-white">
          <span className="font-semibold">Totale indicativo{parziale ? ' (parziale)' : ''}</span>
          <span className="text-xl font-extrabold tabular-nums">
            {parziale ? 'da ' : ''}
            {formatEuro(p.totale)}
          </span>
        </div>
      )}
      {avviso && <p className="mt-2 text-xs text-slate-500">{avviso}</p>}
    </div>
  )
}
