import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../components/PublicLayout'
import { Icon } from '../../components/Icon'

export function AuthCard({ titolo, sottotitolo, children }: { titolo: string; sottotitolo?: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 px-4 py-12">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-brand-200/50 blur-3xl" aria-hidden="true" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card p-6 shadow-xl shadow-slate-900/5 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{titolo}</h1>
          {sottotitolo && <p className="mt-1 text-sm text-slate-500">{sottotitolo}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <Link to="/" className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
          <Icon name="arrowLeft" className="h-4 w-4" /> Torna al sito
        </Link>
      </div>
    </div>
  )
}
