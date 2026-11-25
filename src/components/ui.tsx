import { useEffect, type ReactNode } from 'react'
import { Icon, type NomeIcona } from './Icon'
import {
  ETICHETTE_ESITO_OPPORTUNITA,
  ETICHETTE_STATO_PAGAMENTO,
  ETICHETTE_STATO_PROGETTO,
  ETICHETTE_STATO_RICHIESTA,
  ETICHETTE_STATO_VENDITA,
} from '../lib/format'
import type { EsitoOpportunita, StatoPagamento, StatoProgetto, StatoRichiesta, StatoVendita } from '../lib/types'

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Caricamento({ testo = 'Caricamento…', pieno = false }: { testo?: string; pieno?: boolean }) {
  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-3 text-sm text-slate-500 ${pieno ? 'min-h-[60vh]' : 'py-16'}`}
    >
      <Spinner className="h-5 w-5 text-brand-600" />
      {testo}
    </div>
  )
}

export function MessaggioErrore({ children, onRiprova }: { children: ReactNode; onRiprova?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex-1">{children}</div>
      {onRiprova && (
        <button onClick={onRiprova} className="font-semibold underline underline-offset-2 hover:no-underline">
          Riprova
        </button>
      )}
    </div>
  )
}

export function MessaggioSuccesso({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
      <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export function Vuoto({ icona = 'folder', titolo, children }: { icona?: NomeIcona; titolo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon name={icona} className="h-6 w-6" />
      </div>
      <p className="font-semibold text-slate-700">{titolo}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-500">{children}</div>}
    </div>
  )
}

export function StatCard({
  etichetta,
  valore,
  icona,
  nota,
  tono = 'brand',
}: {
  etichetta: string
  valore: ReactNode
  icona: NomeIcona
  nota?: ReactNode
  tono?: 'brand' | 'verde' | 'ambra' | 'slate'
}) {
  const toni = {
    brand: 'bg-brand-50 text-brand-600',
    verde: 'bg-emerald-50 text-emerald-600',
    ambra: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  }
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{etichetta}</p>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toni[tono]}`}>
          <Icon name={icona} className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-2xl">{valore}</p>
      {nota && <p className="mt-1 text-xs text-slate-500">{nota}</p>}
    </div>
  )
}

function Pill({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  )
}

export function BadgeStatoProgetto({ stato }: { stato: StatoProgetto }) {
  const c = {
    in_lavorazione: 'bg-blue-50 text-blue-700',
    consegnato: 'bg-emerald-50 text-emerald-700',
    manutenzione: 'bg-violet-50 text-violet-700',
  }[stato]
  return <Pill className={c}>{ETICHETTE_STATO_PROGETTO[stato]}</Pill>
}

export function BadgeStatoPagamento({ stato }: { stato: StatoPagamento }) {
  const c = {
    pagato: 'bg-emerald-50 text-emerald-700',
    parziale: 'bg-amber-50 text-amber-700',
    da_pagare: 'bg-red-50 text-red-700',
  }[stato]
  return <Pill className={c}>{ETICHETTE_STATO_PAGAMENTO[stato]}</Pill>
}

export function BadgeStatoRichiesta({ stato }: { stato: StatoRichiesta }) {
  const c = {
    nuova: 'bg-brand-50 text-brand-700',
    letta: 'bg-slate-100 text-slate-700',
    gestita: 'bg-emerald-50 text-emerald-700',
  }[stato]
  return <Pill className={c}>{ETICHETTE_STATO_RICHIESTA[stato]}</Pill>
}

export function BadgeStatoVendita({ stato }: { stato: StatoVendita }) {
  const c = {
    in_attesa: 'bg-amber-50 text-amber-700',
    approvata: 'bg-emerald-50 text-emerald-700',
    rifiutata: 'bg-red-50 text-red-700',
  }[stato]
  return <Pill className={c}>{ETICHETTE_STATO_VENDITA[stato]}</Pill>
}

export function BadgeEsitoOpportunita({ esito }: { esito: EsitoOpportunita | null }) {
  if (!esito) return <Pill className="bg-slate-100 text-slate-600">Da fare</Pill>
  const c = {
    venduto: 'bg-emerald-50 text-emerald-700',
    interessato: 'bg-amber-50 text-amber-700',
    non_interessato: 'bg-red-50 text-red-700',
  }[esito]
  return <Pill className={c}>{ETICHETTE_ESITO_OPPORTUNITA[esito]}</Pill>
}

export function IntestazionePagina({
  titolo,
  sottotitolo,
  azioni,
}: {
  titolo: string
  sottotitolo?: ReactNode
  azioni?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{titolo}</h1>
        {sottotitolo && <p className="mt-1 text-sm text-slate-500">{sottotitolo}</p>}
      </div>
      {azioni && <div className="flex flex-wrap gap-2">{azioni}</div>}
    </div>
  )
}

export function Modale({
  aperta,
  titolo,
  onChiudi,
  children,
  larga = false,
}: {
  aperta: boolean
  titolo: string
  onChiudi: () => void
  children: ReactNode
  larga?: boolean
}) {
  useEffect(() => {
    if (!aperta) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onChiudi()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [aperta, onChiudi])

  if (!aperta) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={titolo}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onChiudi} />
      <div
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${larga ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{titolo}</h2>
          <button onClick={onChiudi} className="btn-ghost -mr-2 p-2" aria-label="Chiudi">
            <Icon name="close" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

/** Tabella che scorre orizzontalmente su mobile. */
export function TabellaScroll({ children }: { children: ReactNode }) {
  return <div className="-mx-px overflow-x-auto">{children}</div>
}
