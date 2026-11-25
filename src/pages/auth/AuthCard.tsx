import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { Icon } from '../../components/Icon'

export function AuthCard({ titolo, sottotitolo, children }: { titolo: string; sottotitolo?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-950 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="sali mb-8 flex justify-center">
          <Logo chiaro className="text-2xl" />
        </div>
        <div className="sali rounded-3xl bg-white p-6 shadow-2xl shadow-black/30 sm:p-9" style={{ animationDelay: '0.1s' }}>
          <h1 className="text-3xl font-bold tracking-tight text-brand-950">{titolo}</h1>
          {sottotitolo && <p className="mt-2 text-sm text-slate-500">{sottotitolo}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <Link to="/" className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-brand-300 hover:text-white">
          <Icon name="arrowLeft" className="h-4 w-4" /> Torna al sito
        </Link>
      </div>
    </div>
  )
}
