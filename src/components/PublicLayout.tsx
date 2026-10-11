import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { SITO } from '../config'
import { Icon } from './Icon'
import { useAuth } from '../auth/AuthProvider'

const VOCI = [
  { to: '/', label: 'Home', end: true },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/sito-su-misura', label: 'Acquista il tuo sito' },
  { to: '/prova-un-mese', label: 'Prova un mese' },
]

/** Logo su fondo nero: va messo su superfici nere, dove si fonde con lo sfondo. */
export function Logo({ className = 'h-11' }: { className?: string }) {
  return (
    <Link to="/" className="inline-flex shrink-0" aria-label={`${SITO.titolo} – Home`}>
      <img src="/logo-compatto.jpg" alt={SITO.titolo} width={480} height={154} className={`w-auto ${className}`} />
    </Link>
  )
}

export function PublicLayout() {
  const [aperto, setAperto] = useState(false)
  const { pathname } = useLocation()
  const { session } = useAuth()

  useEffect(() => {
    setAperto(false)
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black">
        <div className="container-sito flex h-16 items-center justify-between gap-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigazione principale">
            {VOCI.map((v) => (
              <NavLink
                key={v.to}
                to={v.to}
                end={v.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'text-sky-400' : 'text-slate-300 hover:text-white'}`
                }
              >
                {v.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to={session ? '/area' : '/login'} className="btn hidden py-2 text-white ring-1 ring-white/20 hover:bg-white/10 sm:inline-flex">
              <Icon name="lock" className="h-4 w-4" /> Area riservata
            </Link>
            <button
              className="btn p-2 text-slate-200 hover:bg-white/10 md:hidden"
              onClick={() => setAperto((a) => !a)}
              aria-expanded={aperto}
              aria-label={aperto ? 'Chiudi menu' : 'Apri menu'}
            >
              <Icon name={aperto ? 'close' : 'menu'} />
            </button>
          </div>
        </div>
        {aperto && (
          <nav className="container-sito flex flex-col gap-1 pb-4 md:hidden" aria-label="Navigazione mobile">
            {VOCI.map((v) => (
              <NavLink
                key={v.to}
                to={v.to}
                end={v.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2.5 text-base font-semibold ${isActive ? 'bg-white/10 text-sky-400' : 'text-slate-200'}`
                }
              >
                {v.label}
              </NavLink>
            ))}
            <Link to={session ? '/area' : '/login'} className="btn-primary mt-2">
              <Icon name="lock" className="h-4 w-4" /> Area riservata
            </Link>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-100">
        <div className="container-sito flex flex-wrap items-center justify-between gap-3 py-6 text-sm text-slate-500">
          <nav className="flex gap-4" aria-label="Navigazione secondaria">
            {VOCI.map((v) => (
              <Link key={v.to} to={v.to} className="hover:text-slate-900">
                {v.label}
              </Link>
            ))}
            <Link to={session ? '/area' : '/login'} className="hover:text-slate-900">
              Area riservata
            </Link>
          </nav>
          <span>Sito privato</span>
        </div>
      </footer>
    </div>
  )
}
