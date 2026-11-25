import { Link, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Finestra, Telefono } from '../../components/Mockup'
import { Reveal } from '../../components/Reveal'
import { Screenshot } from '../../components/Screenshot'
import { Seo } from '../../components/Seo'
import { Caricamento, MessaggioErrore, Vuoto } from '../../components/ui'
import { caricaLavoro } from '../../data/lavori'
import { formatData, hostname } from '../../lib/format'
import { useQuery } from '../../lib/useQuery'

const UUID_RE = /^[0-9a-f-]{36}$/i

export default function ProgettoDettaglio() {
  const { id = '' } = useParams()
  const { dati: p, caricamento, errore, ricarica } = useQuery(
    () => (UUID_RE.test(id) ? caricaLavoro(id) : Promise.resolve(null)),
    [id],
  )

  if (caricamento) return <Caricamento pieno />
  if (errore)
    return (
      <div className="container-sito py-16">
        <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>
      </div>
    )
  if (!p)
    return (
      <div className="container-sito py-16">
        <Seo titolo="Progetto non trovato" />
        <Vuoto titolo="Progetto non trovato">
          <Link to="/portfolio" className="font-semibold text-brand-700">
            Torna ai lavori
          </Link>
        </Vuoto>
      </div>
    )

  const galleria = (p.galleria ?? []).filter(Boolean)

  return (
    <>
      <Seo titolo={p.nome} />
      <section className="container-sito pt-10 sm:pt-14">
        <Link to="/portfolio" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-950">
          <Icon name="arrowLeft" className="h-4 w-4" /> Tutti i lavori
        </Link>

        <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="sali">
            {p.categoria && <p className="sopratitolo">{p.categoria}</p>}
            <h1 className="mt-3 text-5xl leading-[1.02] font-extrabold tracking-tight break-words text-brand-950 sm:text-6xl">{p.nome}</h1>
            {p.cliente && p.cliente !== p.nome && <p className="mt-4 text-slate-500">Cliente: {p.cliente}</p>}
          </div>
          {p.url && (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn-primary btn-grande w-full sm:w-auto sm:self-start lg:self-auto">
              Visita il sito <Icon name="external" className="h-4 w-4" />
            </a>
          )}
        </div>

        <div className="sali mt-12 rounded-[2rem] bg-brand-900 px-4 py-8 sm:rounded-[3rem] sm:px-16 sm:py-16" style={{ animationDelay: '0.15s' }}>
          <div className={`relative mx-auto max-w-4xl ${p.telefono_url ? 'mb-4 sm:mb-0 sm:pr-16' : ''}`}>
            <Finestra indirizzo={hostname(p.url)}>
              <Screenshot src={p.screenshot_url} nome={p.nome} />
            </Finestra>
            {p.telefono_url && (
              <div className="absolute -right-1 -bottom-8 w-[24%] sm:-right-6 sm:-bottom-10 sm:w-[22%]">
                <Telefono src={p.telefono_url} alt={`Il sito ${p.nome} su smartphone`} />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="container-sito py-20 sm:py-24">
        <div className="grid gap-14 lg:grid-cols-[2fr_1fr] lg:gap-20">
          <Reveal>
            <h2 className="text-3xl font-bold tracking-tight text-brand-950">Il progetto</h2>
            <p className="mt-5 text-lg leading-relaxed whitespace-pre-line text-slate-600">{p.descrizione || 'Descrizione in arrivo.'}</p>

            {p.funzionalita?.length > 0 && (
              <>
                <h2 className="mt-14 text-3xl font-bold tracking-tight text-brand-950">Cosa abbiamo realizzato</h2>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {p.funzionalita.map((f) => (
                    <li key={f} className="flex items-start gap-3 rounded-2xl bg-nebbia p-4 text-slate-800">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lime-accento text-brand-950">
                        <Icon name="check" className="h-3.5 w-3.5" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Reveal>

          <Reveal ritardo={100}>
            <aside className="divide-y divide-slate-900/10 border-y border-slate-900/10">
              {p.tecnologie?.length > 0 && (
                <div className="py-6">
                  <h2 className="text-sm font-semibold text-slate-500">Tecnologie</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.tecnologie.map((t) => (
                      <span key={t} className="rounded-full bg-nebbia px-3.5 py-1.5 text-sm font-medium text-brand-900">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {p.data_consegna && (
                <div className="py-6">
                  <h2 className="text-sm font-semibold text-slate-500">Consegna</h2>
                  <p className="mt-1 font-semibold text-brand-950">{formatData(p.data_consegna)}</p>
                </div>
              )}
              {p.url && (
                <div className="py-6">
                  <h2 className="text-sm font-semibold text-slate-500">Sito</h2>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 font-semibold break-all text-brand-700 hover:underline">
                    {hostname(p.url)} <Icon name="external" className="h-4 w-4 shrink-0" />
                  </a>
                </div>
              )}
            </aside>
          </Reveal>
        </div>

        {galleria.length > 0 && (
          <div className="mt-20">
            <h2 className="text-3xl font-bold tracking-tight text-brand-950">Galleria</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {galleria.map((src) => (
                <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-3xl bg-nebbia">
                  <img src={src} alt={`Schermata di ${p.nome}`} loading="lazy" className="w-full transition duration-500 hover:scale-[1.02]" />
                </a>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  )
}
