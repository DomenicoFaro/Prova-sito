import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { SITO } from '../config'
import { Icon, type NomeIcona } from './Icon'
import { Seo } from './Seo'
import { Avatar } from './Avatar'

interface Voce {
  to: string
  label: string
  icona: NomeIcona
  end?: boolean
}

const VOCI_ADMIN: Voce[] = [
  { to: '/area/admin', label: 'Riepilogo', icona: 'chart', end: true },
  { to: '/area/admin/progetti', label: 'Progetti', icona: 'folder' },
  { to: '/area/admin/vendite', label: 'Vendite', icona: 'handshake' },
  { to: '/area/admin/pagamenti', label: 'Pagamenti', icona: 'wallet' },
  { to: '/area/admin/collaboratori', label: 'Collaboratori', icona: 'users' },
]

const VOCI_COLLABORATORE: Voce[] = [
  { to: '/area/dashboard', label: 'I miei siti', icona: 'chart' },
  { to: '/area/vendite', label: 'Vendite', icona: 'handshake' },
]

export function AreaLayout() {
  const { profilo, isAdmin, esci } = useAuth()
  const [aperto, setAperto] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setAperto(false), [pathname])

  const voci = [...(isAdmin ? VOCI_ADMIN : VOCI_COLLABORATORE), { to: '/area/profilo', label: 'Il mio profilo', icona: 'user' as const }]

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/" className="flex h-16 shrink-0 items-center gap-2.5 px-5 font-extrabold tracking-tight text-white">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500">
          <Icon name="folder" className="h-4 w-4" />
        </span>
        <span className="truncate">{SITO.titolo}</span>
      </Link>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Area riservata">
        {voci.map((v) => (
          <NavLink
            key={v.to}
            to={v.to}
            end={v.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`
            }
          >
            <Icon name={v.icona} className="h-5 w-5" />
            {v.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar nome={profilo?.nome ?? ''} url={profilo?.avatar_url} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{profilo?.nome}</p>
            <p className="truncate text-xs text-slate-400">{isAdmin ? 'Amministratore' : 'Collaboratore'}</p>
          </div>
          <button onClick={esci} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" title="Esci" aria-label="Esci">
            <Icon name="logout" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <Seo titolo="Area riservata" />
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-slate-950 lg:block">{sidebar}</aside>

      {/* Sidebar mobile */}
      {aperto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setAperto(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-slate-950 shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setAperto(true)} className="btn-ghost -ml-2 p-2" aria-label="Apri menu">
            <Icon name="menu" />
          </button>
          <span className="font-bold text-slate-900">Area riservata</span>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
