import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Reveal } from '../../components/Reveal'
import { Seo } from '../../components/Seo'
import { Caricamento, MessaggioErrore, Vuoto } from '../../components/ui'
import { formatPrezzoListino } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Prezzo, TipoPrezzo } from '../../lib/types'
import { esegui, useQuery } from '../../lib/useQuery'

const SEZIONI: { tipo: TipoPrezzo; titolo: string; testo: string }[] = [
  { tipo: 'sito', titolo: 'Siti web', testo: 'Realizzati su misura, pronti da usare.' },
  { tipo: 'servizio', titolo: 'Servizi', testo: 'Interventi e lavori una tantum.' },
  { tipo: 'abbonamento', titolo: 'Abbonamenti', testo: 'Assistenza e servizi continuativi.' },
]

export default function Prezzi() {
  const { dati, caricamento, errore, ricarica } = useQuery(() =>
    esegui<Prezzo[]>(supabase.from('prezzi').select('*').eq('attivo', true).order('ordine').order('prezzo')),
  )

  const sezioni = SEZIONI.map((s) => ({ ...s, voci: (dati ?? []).filter((p) => p.tipo === s.tipo) })).filter((s) => s.voci.length > 0)

  return (
    <>
      <Seo titolo="Prezzi" />
      <section className="border-b border-slate-100 bg-gradient-to-b from-brand-50/60 to-white">
        <div className="container-sito py-14 sm:py-20">
          <Reveal>
            <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">Prezzi</p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Il nostro listino</h1>
            <p className="mt-4 max-w-2xl text-slate-600">
              Siti web, servizi e abbonamenti, con i prezzi chiari. Per un sito fatto su misura puoi chiedere un preventivo.
            </p>
            <Link to="/sito-su-misura" className="btn-primary mt-6 inline-flex">
              Acquista il tuo sito <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="container-sito py-10 sm:py-14">
        {caricamento ? (
          <Caricamento testo="Carico il listino…" />
        ) : errore ? (
          <MessaggioErrore onRiprova={ricarica}>Non è stato possibile caricare i prezzi. {errore}</MessaggioErrore>
        ) : sezioni.length === 0 ? (
          <Vuoto icona="euro" titolo="Il listino verrà pubblicato a breve" />
        ) : (
          <div className="space-y-14">
            {sezioni.map(({ tipo, titolo, testo, voci }) => (
              <section key={tipo} aria-labelledby={`prezzi-${tipo}`}>
                <div className="mb-5">
                  <h2 id={`prezzi-${tipo}`} className="text-2xl font-extrabold tracking-tight text-slate-900">{titolo}</h2>
                  <p className="mt-1 text-slate-600">{testo}</p>
                </div>
                <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {voci.map((p, i) => (
                    <li key={p.id}>
                      <Reveal ritardo={(i % 3) * 80}>
                        <article className={`card flex h-full flex-col p-6 ${p.in_evidenza ? 'ring-2 ring-brand-500/40' : ''}`}>
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-semibold text-slate-900">{p.nome}</h3>
                            {p.in_evidenza && (
                              <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">Consigliato</span>
                            )}
                          </div>
                          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums">{formatPrezzoListino(p)}</p>
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
                      </Reveal>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
