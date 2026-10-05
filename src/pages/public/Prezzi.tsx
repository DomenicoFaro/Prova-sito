import { Icon } from '../../components/Icon'
import { Reveal } from '../../components/Reveal'
import { Seo } from '../../components/Seo'
import { Caricamento, MessaggioErrore } from '../../components/ui'
import { formatPrezzoListino } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Prezzo, TipoPrezzo } from '../../lib/types'
import { esegui, useQuery } from '../../lib/useQuery'

const SEZIONI: { tipo: TipoPrezzo; titolo: string; testo: string }[] = [
  { tipo: 'sito', titolo: 'Siti web', testo: 'Il prezzo di ogni tipologia di sito, chiavi in mano.' },
  { tipo: 'servizio', titolo: 'Servizi', testo: 'Manutenzione, hosting e servizi aggiuntivi.' },
]

function Scheda({ p }: { p: Prezzo }) {
  const { prefisso, importo, suffisso } = formatPrezzoListino(p)
  return (
    <article
      className={`flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm ${p.in_evidenza ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200'}`}
    >
      {p.in_evidenza && (
        <span className="mb-3 inline-flex w-fit rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">Più richiesto</span>
      )}
      <h3 className="text-lg font-bold text-slate-900">{p.nome}</h3>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
        {prefisso && <span className="text-sm font-medium text-slate-500">{prefisso.trim()}</span>}
        <span className="text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums">{importo}</span>
        {suffisso && <span className="text-sm text-slate-500">{suffisso}</span>}
      </p>
      {p.descrizione && <p className="mt-3 text-sm text-slate-600">{p.descrizione}</p>}
      {p.caratteristiche.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {p.caratteristiche.map((c) => (
            <li key={c} className="flex items-start gap-2">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export default function Prezzi() {
  const { dati, caricamento, errore, ricarica } = useQuery(() =>
    esegui<Prezzo[]>(supabase.from('prezzi').select('*').order('ordine').order('prezzo')),
  )

  return (
    <>
      <Seo titolo="Prezzi" />
      <section className="border-b border-slate-100 bg-gradient-to-b from-brand-50/60 to-white">
        <div className="container-sito py-14 sm:py-20">
          <Reveal>
            <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">Prezzi</p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Listino siti e servizi</h1>
            <p className="mt-4 max-w-2xl text-slate-600">I prezzi sono indicativi e IVA esclusa, salvo diversa indicazione.</p>
          </Reveal>
        </div>
      </section>

      <div className="container-sito space-y-14 py-10 sm:py-14">
        {caricamento ? (
          <Caricamento testo="Carico i prezzi…" />
        ) : errore ? (
          <MessaggioErrore onRiprova={ricarica}>Non è stato possibile caricare i prezzi. {errore}</MessaggioErrore>
        ) : !dati || dati.length === 0 ? (
          <p className="text-slate-500">Il listino sarà disponibile a breve.</p>
        ) : (
          SEZIONI.map(({ tipo, titolo, testo }) => {
            const voci = dati.filter((p) => p.tipo === tipo)
            if (voci.length === 0) return null
            return (
              <section key={tipo} aria-labelledby={`prezzi-${tipo}`}>
                <Reveal>
                  <h2 id={`prezzi-${tipo}`} className="text-2xl font-bold tracking-tight text-slate-900">{titolo}</h2>
                  <p className="mt-1 text-slate-500">{testo}</p>
                </Reveal>
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {voci.map((p, i) => (
                    <Reveal key={p.id} ritardo={i * 60}>
                      <Scheda p={p} />
                    </Reveal>
                  ))}
                </div>
              </section>
            )
          })
        )}
      </div>
    </>
  )
}
