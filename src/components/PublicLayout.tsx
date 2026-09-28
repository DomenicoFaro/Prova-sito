import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AGENZIA } from '../config'
import { Icon } from './Icon'
import { useAuth } from '../auth/AuthProvider'

const VOCI = [
  { to: '/', label: 'Home', end: true },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/contatti', label: 'Contatti' },
]

export function Logo({ chiaro = false }: { chiaro?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-extrabold tracking-tight">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-sm text-white shadow-sm shadow-brand-600/30">
        {AGENZIA.nome.slice(0, 1).toUpperCase()}
      </span>
      <span className={chiaro ? 'text-white' : 'text-slate-900'}>{AGENZIA.nome}</span>
    </Link>
  )
}

export function PublicLayout() {
  const [aperto, setAperto] = useState(false)
  const [scrollato, setScrollato] = useState(false)
  const { pathname } = useLocation()
  const { session } = useAuth()

  useEffect(() => {
    setAperto(false)
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    const onScroll = () => setScrollato(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header
        className={`sticky top-0 z-40 border-b transition ${scrollato || aperto ? 'border-slate-200/80 bg-white/90 backdrop-blur-md' : 'border-transparent bg-white/0'}`}
      >
        <div className="container-sito flex h-16 items-center justify-between gap-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigazione principale">
            {VOCI.map((v) => (
              <NavLink
                key={v.to}
                to={v.to}
                end={v.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'text-brand-700' : 'text-slate-600 hover:text-slate-900'}`
                }
              >
                {v.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to={session ? '/area' : '/login'} className="btn-secondary hidden py-2 sm:inline-flex">
              <Icon name="lock" className="h-4 w-4" /> Area riservata
            </Link>
            <button
              className="btn-ghost p-2 md:hidden"
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
                  `rounded-lg px-3 py-2.5 text-base font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700'}`
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

      <footer className="bg-slate-950 text-slate-400">
        <div className="container-sito grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo chiaro />
            <p className="mt-4 max-w-sm text-sm leading-relaxed">{AGENZIA.descrizione}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Esplora</p>
            <ul className="mt-3 space-y-2 text-sm">
              {VOCI.map((v) => (
                <li key={v.to}>
                  <Link to={v.to} className="hover:text-white">
                    {v.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/login" className="hover:text-white">
                  Area riservata
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Contatti</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href={`mailto:${AGENZIA.email}`} className="hover:text-white">
                  {AGENZIA.email}
                </a>
              </li>
              <li>
                <a href={`tel:${AGENZIA.telefono.replace(/\s/g, '')}`} className="hover:text-white">
                  {AGENZIA.telefono}
                </a>
              </li>
              <li>
                <a href={`https://wa.me/${AGENZIA.whatsapp}`} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="container-sito py-5 text-xs">
            © {new Date().getFullYear()} {AGENZIA.nome}. Tutti i diritti riservati.
          </div>
        </div>
      </footer>
    </div>
  )
}
