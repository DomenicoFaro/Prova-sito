import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { SITO } from '../config'
import { Icon } from './Icon'
import { Logo } from './Logo'
import { useAuth } from '../auth/AuthProvider'

const VOCI = [
  { to: '/#servizi', label: 'Servizi' },
  { to: '/portfolio', label: 'Lavori' },
  { to: '/#metodo', label: 'Come lavoriamo' },
  { to: '/#domande', label: 'Domande' },
]

const ORDINA = [
  { to: '/sito-su-misura', label: 'Acquista il tuo sito' },
  { to: '/prova-un-mese', label: 'Prova il tuo sito' },
]

export function PublicLayout() {
  const [aperto, setAperto] = useState(false)
  const { pathname, hash, key } = useLocation()
  const chiudiMenu = () => setAperto(false)
  const { session } = useAuth()
  const areaRiservata = session ? '/area' : '/login'

  // Con un'ancora si rilegge anche `key`, così il link funziona pure al secondo clic.
  // Senza ancora no: cambiare filtro nel portfolio non deve riportare in cima.
  const clicAncora = hash ? key : ''
  useEffect(() => {
    setAperto(false)
    const sezione = hash ? document.getElementById(hash.slice(1)) : null
    if (sezione) sezione.scrollIntoView()
    else window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash, clicAncora])

  return (
    <div className="flex min-h-screen flex-col bg-carta">
      <header className="sticky top-0 z-40 border-b border-slate-900/5 bg-carta/85 backdrop-blur-lg">
        <nav className="container-sito flex h-20 items-center justify-between gap-4" aria-label="Navigazione principale">
          <Logo />
          <div className="hidden items-center gap-6 lg:flex xl:gap-8">
            {VOCI.map((v) => (
              <Link
                key={v.to}
                to={v.to}
                aria-current={pathname.startsWith(v.to) ? 'page' : undefined}
                className="text-sm font-medium text-slate-600 transition hover:text-brand-950 aria-[current=page]:font-semibold aria-[current=page]:text-brand-950"
              >
                {v.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/prova-un-mese" className="btn-ghost hidden px-3 lg:inline-flex">
              Prova il tuo sito
            </Link>
            <Link to="/sito-su-misura" className="btn-primary hidden sm:inline-flex">
              Acquista il tuo sito
            </Link>
            <Link to={areaRiservata} className="btn-secondary hidden p-2.5 sm:inline-flex" title="Area riservata" aria-label="Area riservata">
              <Icon name="lock" className="h-5 w-5" />
            </Link>
            <button
              className="btn p-2.5 text-brand-950 hover:bg-nebbia lg:hidden"
              onClick={() => setAperto((a) => !a)}
              aria-expanded={aperto}
              aria-label={aperto ? 'Chiudi menu' : 'Apri menu'}
            >
              <Icon name={aperto ? 'close' : 'menu'} className="h-6 w-6" />
            </button>
          </div>
        </nav>
        {aperto && (
          <nav className="container-sito flex flex-col pb-6 lg:hidden" aria-label="Navigazione mobile">
            {VOCI.map((v) => (
              <Link key={v.to} to={v.to} onClick={chiudiMenu} className="border-b border-slate-900/5 py-4 font-display text-2xl font-semibold text-brand-950">
                {v.label}
              </Link>
            ))}
            {ORDINA.map((v, i) => (
              <Link key={v.to} to={v.to} onClick={chiudiMenu} className={`btn-grande ${i === 0 ? 'btn-primary mt-6' : 'btn-accento mt-3'}`}>
                {v.label}
              </Link>
            ))}
            <Link to={areaRiservata} className="btn-secondary btn-grande mt-3">
              <Icon name="lock" className="h-4 w-4" /> Area riservata
            </Link>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-brand-950 text-brand-200">
        <div className="container-sito py-14 sm:py-16">
          <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
            <div>
              <Logo chiaro className="text-2xl" />
              <p className="mt-5 max-w-xs leading-relaxed">{SITO.descrizione}</p>
            </div>
            <nav className="grid grid-cols-2 gap-x-14 gap-y-3 text-sm" aria-label="Navigazione secondaria">
              {[...VOCI, ...ORDINA].map((v) => (
                <Link key={v.to} to={v.to} className="hover:text-white">
                  {v.label}
                </Link>
              ))}
              <Link to={areaRiservata} className="hover:text-white">
                Area riservata
              </Link>
            </nav>
          </div>
          <p className="mt-12 border-t border-white/10 pt-6 text-xs text-brand-300">
            © {new Date().getFullYear()} {SITO.titolo} · {SITO.dominio}
          </p>
        </div>
      </footer>
    </div>
  )
}
