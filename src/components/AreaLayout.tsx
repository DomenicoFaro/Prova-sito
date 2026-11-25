import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Icon, type NomeIcona } from './Icon'
import { Seo } from './Seo'
import { Avatar } from './Avatar'
import { Logo } from './Logo'
import { useTicket } from '../lib/ticket'

interface Voce {
  to: string
  label: string
  icona: NomeIcona
  end?: boolean
}

const VOCI_ADMIN: Voce[] = [
  { to: '/area/admin', label: 'Riepilogo', icona: 'chart', end: true },
  { to: '/area/ticket', label: 'Ticket', icona: 'inbox' },
  { to: '/area/admin/progetti', label: 'Progetti', icona: 'folder' },
  { to: '/area/admin/vendite', label: 'Vendite', icona: 'handshake' },
  { to: '/area/admin/preventivi', label: 'Preventivi', icona: 'cart' },
  { to: '/area/admin/opportunita', label: 'Opportunità', icona: 'pin' },
  { to: '/area/admin/pagamenti', label: 'Pagamenti', icona: 'wallet' },
  { to: '/area/admin/clienti', label: 'Clienti', icona: 'user' },
  { to: '/area/admin/recensioni', label: 'Recensioni', icona: 'chat' },
  { to: '/area/admin/collaboratori', label: 'Collaboratori', icona: 'users' },
  { to: '/area/prezzi', label: 'Prezzi', icona: 'euro' },
]

const VOCI_COLLABORATORE: Voce[] = [
  { to: '/area/dashboard', label: 'I miei siti', icona: 'chart' },
  { to: '/area/ticket', label: 'Ticket', icona: 'inbox' },
  { to: '/area/vendite', label: 'Vendite', icona: 'handshake' },
  { to: '/area/opportunita', label: 'Opportunità', icona: 'pin' },
  { to: '/area/prezzi', label: 'Prezzi', icona: 'euro' },
]

const VOCI_CLIENTE: Voce[] = [
  { to: '/area/cliente', label: 'Il mio sito', icona: 'globe' },
  { to: '/area/ticket', label: 'Assistenza', icona: 'chat' },
]

export function AreaLayout() {
  const { profilo, isAdmin, isCliente, esci } = useAuth()
  const [aperto, setAperto] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setAperto(false), [pathname])

  // Ticket con messaggi da leggere: numero nel menu, nel titolo della scheda e avviso in pagina
  const ticket = useTicket(profilo?.id, profilo?.ruolo)
  useEffect(() => {
    const titolo = document.title.replace(/^\(\d+\) /, '')
    document.title = ticket.nonLetti ? `(${ticket.nonLetti}) ${titolo}` : titolo
  }, [ticket.nonLetti, pathname])

  const vociRuolo = isAdmin ? VOCI_ADMIN : isCliente ? VOCI_CLIENTE : VOCI_COLLABORATORE
  const voci = [...vociRuolo, { to: '/area/profilo', label: 'Il mio profilo', icona: 'user' as const }]

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo chiaro className="text-lg" />
      </div>
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
            {v.to === '/area/ticket' && ticket.nonLetti > 0 && (
              <span className="ml-auto rounded-full bg-lime-accento px-2 py-0.5 text-xs font-bold text-brand-950" aria-label={`${ticket.nonLetti} da leggere`}>
                {ticket.nonLetti}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar nome={profilo?.nome ?? ''} url={profilo?.avatar_url} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{profilo?.nome}</p>
            <p className="truncate text-xs text-slate-400">{isAdmin ? 'Amministratore' : isCliente ? 'Cliente' : 'Collaboratore'}</p>
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
      <Seo titolo="Area riservata" noindex />
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-brand-950 lg:block">{sidebar}</aside>

      {/* Sidebar mobile */}
      {aperto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setAperto(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-brand-950 shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setAperto(true)} className="btn-ghost -ml-2 p-2" aria-label="Apri menu">
            <Icon name="menu" />
          </button>
          <span className="font-bold text-slate-900">Area riservata</span>
          {ticket.nonLetti > 0 && (
            <Link to="/area/ticket" className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-lime-accento px-3 py-1 text-sm font-bold text-brand-950">
              <Icon name="chat" className="h-4 w-4" /> {ticket.nonLetti}
            </Link>
          )}
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {ticket.nonLetti > 0 && !pathname.startsWith('/area/ticket') && (
            <Link to="/area/ticket" role="status" className="mb-5 flex items-center gap-3 rounded-2xl bg-brand-900 p-4 text-sm font-semibold text-white hover:bg-brand-800">
              <Icon name="chat" className="h-5 w-5 shrink-0 text-lime-accento" />
              <span className="flex-1">
                {ticket.nonLetti === 1 ? 'Hai un ticket con un nuovo messaggio' : `Hai ${ticket.nonLetti} ticket con nuovi messaggi`}
              </span>
              <Icon name="arrowRight" className="h-4 w-4 shrink-0" />
            </Link>
          )}
          <Outlet context={ticket} />
        </main>
      </div>
    </div>
  )
}
