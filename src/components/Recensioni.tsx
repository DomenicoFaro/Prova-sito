import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { RecensionePubblica } from '../lib/types'
import { esegui, useQuery } from '../lib/useQuery'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Reveal } from './Reveal'
import { Stelle } from './Stelle'

/** Recensioni pubblicate. Se non si leggono (o non ce ne sono) il sito non mostra nulla. */
export function useRecensioni() {
  const { dati } = useQuery(() =>
    esegui<RecensionePubblica[]>(supabase.from('recensioni_pubbliche').select('*').order('created_at', { ascending: false }).limit(60)),
  )
  const elenco = Array.isArray(dati) ? dati : []
  const media = elenco.length ? elenco.reduce((s, r) => s + r.stelle, 0) / elenco.length : 0
  return { elenco, media }
}

export const votoInTesto = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const quante = (n: number) => (n === 1 ? '1 recensione' : `${n} recensioni`)

function Scheda({ r }: { r: RecensionePubblica }) {
  return (
    <figure className="flex h-full flex-col rounded-3xl bg-white p-7 text-slate-800 shadow-xl shadow-black/20 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <Stelle voto={r.stelle} className="h-6 w-6" />
        <span className="-mt-3 font-display text-7xl leading-none font-extrabold text-lime-accento" aria-hidden="true">”</span>
      </div>
      <blockquote className="mt-2 flex-1 text-lg leading-relaxed break-words whitespace-pre-line">{r.testo}</blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
        <Avatar nome={r.firma} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-brand-950">{r.firma}</p>
          {r.attivita && <p className="truncate text-sm text-slate-500">{r.attivita}</p>}
        </div>
      </figcaption>
    </figure>
  )
}

/** Sezione delle recensioni nella home. */
export function SezioneRecensioni({ elenco, media }: { elenco: RecensionePubblica[]; media: number }) {
  if (!elenco.length) return null
  // Con tante recensioni scorrono da sole; la copia serve a non avere buchi
  const scorre = elenco.length >= 4
  return (
    <section id="recensioni" className="scroll-mt-20 overflow-hidden bg-brand-950 py-20 text-white sm:py-28">
      <div className="container-sito">
        <Reveal className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-wide text-lime-accento">Recensioni dei clienti</p>
            <h2 className="mt-3 max-w-xl text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl">Chi ha già un sito con noi lo racconta così</h2>
          </div>
          <div className="flex items-center gap-5 rounded-3xl bg-white/10 px-7 py-5">
            <p className="font-display text-6xl font-extrabold text-lime-accento sm:text-7xl">{votoInTesto(media)}</p>
            <div>
              <Stelle voto={media} className="h-6 w-6" />
              <p className="mt-1 text-sm text-brand-200">su 5 · {quante(elenco.length)}</p>
            </div>
          </div>
        </Reveal>
      </div>

      {scorre ? (
        <div className="scorrimento mt-14" tabIndex={0} aria-label="Recensioni, in scorrimento">
          <div className="nastro" style={{ animationDuration: `${elenco.length * 9}s` }}>
            {[false, true].map((copia) => (
              <ul key={String(copia)} className="flex shrink-0 gap-6 pr-6" aria-hidden={copia || undefined}>
                {elenco.map((r) => (
                  <li key={r.id} className="w-[19rem] shrink-0 sm:w-[24rem]">
                    <Scheda r={r} />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      ) : (
        <ul className={`container-sito mt-14 grid gap-6 ${elenco.length > 1 ? 'md:grid-cols-2' : ''} ${elenco.length === 3 ? 'lg:grid-cols-3' : ''}`}>
          {elenco.map((r) => (
            <li key={r.id} className={elenco.length === 1 ? 'mx-auto w-full max-w-2xl' : ''}>
              <Scheda r={r} />
            </li>
          ))}
        </ul>
      )}

      <p className="container-sito mt-12 text-center text-sm text-brand-200">
        Sei nostro cliente?{' '}
        <Link to="/area/cliente" className="inline-flex items-center gap-1.5 font-semibold text-lime-accento hover:underline">
          Lascia la tua recensione <Icon name="arrowRight" className="h-4 w-4" />
        </Link>
      </p>
    </section>
  )
}
