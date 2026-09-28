import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../components/PublicLayout'
import { Icon } from '../../components/Icon'

export function AuthCard({ titolo, sottotitolo, children }: { titolo: string; sottotitolo?: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-4 py-12">
      <div className="bagliore h-[340px] w-[620px] max-w-[140vw]" aria-hidden="true" />
      <div className="relative w-full max-w-md">
        <div className="logo-entrata mb-8 flex justify-center">
          <Logo className="h-20" />
        </div>
        <div className="card dissolvenza p-6 shadow-2xl shadow-blue-950/40 sm:p-8" style={{ animationDelay: '0.4s' }}>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{titolo}</h1>
          {sottotitolo && <p className="mt-1 text-sm text-slate-500">{sottotitolo}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <Link to="/" className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-slate-400 hover:text-white">
          <Icon name="arrowLeft" className="h-4 w-4" /> Torna al sito
        </Link>
      </div>
    </div>
  )
}
