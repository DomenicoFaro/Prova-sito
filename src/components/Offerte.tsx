import { Link } from 'react-router-dom'
import { dataEstesa, euroBreve, offerteAttive, type Impostazioni } from '../lib/configuratore'
import { esegui, useQuery } from '../lib/useQuery'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'

/** "fino all'8 dicembre 2026" · "fino al 31 dicembre 2026" */
export function finoAl(iso: string): string {
  const giorno = Number(iso.slice(8, 10))
  return `fino ${giorno === 8 || giorno === 11 ? 'all’' : 'al '}${dataEstesa(iso)}`
}

/** Le offerte valide oggi, lette dalle impostazioni che l'admin modifica in Preventivi → Offerte. */
export function useOfferte() {
  const { dati, caricamento } = useQuery(async () => {
    const righe = await esegui<{ chiave: string; valore: string }[]>(supabase.from('configuratore_impostazioni').select('chiave, valore'))
    return Object.fromEntries((Array.isArray(righe) ? righe : []).map((r) => [r.chiave, r.valore])) as Impostazioni
  })
  const attive = dati ? offerteAttive(dati) : { acquisto: null, prova: null }
  return { ...attive, nessuna: !attive.acquisto && !attive.prova, caricamento }
}

function Punti({ voci, chiaro = false }: { voci: string[]; chiaro?: boolean }) {
  return (
    <ul className={`mt-7 flex-1 space-y-2.5 text-sm ${chiaro ? 'text-brand-100' : 'text-slate-700'}`}>
      {voci.map((v) => (
        <li key={v} className="flex items-start gap-2.5">
          <Icon name="check" className={`mt-0.5 h-4 w-4 shrink-0 ${chiaro ? 'text-lime-accento' : 'text-brand-500'}`} /> {v}
        </li>
      ))}
    </ul>
  )
}

export function CarteOfferte({ acquisto, prova }: Pick<ReturnType<typeof useOfferte>, 'acquisto' | 'prova'>) {
  return (
    <div className={`grid gap-6 ${acquisto && prova ? 'lg:grid-cols-2' : 'mx-auto max-w-xl'}`}>
      {acquisto && (
        <article className="flex flex-col rounded-3xl bg-brand-900 p-8 text-white sm:p-10">
          <p className="self-start rounded-full bg-lime-accento px-3.5 py-1 text-xs font-bold text-brand-950">Offerta {finoAl(acquisto.scadenza)}</p>
          <h3 className="mt-6 text-2xl font-bold tracking-tight">Acquista un sito</h3>
          <p className="mt-3 font-display text-6xl font-extrabold tracking-tight text-lime-accento sm:text-7xl">−{acquisto.percentuale}%</p>
          <p className="mt-2 text-brand-100">di sconto sulla realizzazione del tuo sito.</p>
          <Punti
            chiaro
            voci={[
              'Crei il preventivo online e vedi subito il prezzo indicativo scontato',
              `Vale per le richieste inviate ${finoAl(acquisto.scadenza)}`,
              'Il prezzo finale lo confermiamo noi, prima di qualsiasi pagamento',
            ]}
          />
          <Link to="/preventivo" className="btn-accento btn-grande mt-9">
            Crea il tuo preventivo <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </article>
      )}
      {prova && (
        <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-8 sm:p-10">
          <p className="self-start rounded-full bg-nebbia px-3.5 py-1 text-xs font-bold text-brand-900">Offerta {finoAl(prova.scadenza)}</p>
          <h3 className="mt-6 text-2xl font-bold tracking-tight text-brand-950">Prova il tuo sito</h3>
          <p className="mt-3 font-display text-6xl font-extrabold tracking-tight text-brand-950 sm:text-7xl">{euroBreve(prova.prezzo)}</p>
          <p className="mt-2 text-slate-600">per un mese di prova del tuo sito.</p>
          <Punti
            voci={[
              prova.sconto > 0 ? `Pagine e funzioni aggiuntive a parte, scontate del ${prova.sconto}%` : 'Pagine e funzioni aggiuntive a parte',
              'Se ti piace, dopo il mese paghi il resto',
              'Se non ti convince, non devi altro',
            ]}
          />
          <Link to="/prova-un-mese" className="btn-primary btn-grande mt-9">
            Prova il tuo sito <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </article>
      )}
    </div>
  )
}

/** Sezione della home: compare solo se c'è almeno un'offerta valida. */
export function SezioneOfferte() {
  const offerte = useOfferte()
  if (offerte.nessuna) return null
  return (
    <section id="offerte" className="scroll-mt-20 pt-20 sm:pt-28">
      <div className="container-sito">
        <div className="mb-12 max-w-2xl">
          <p className="sopratitolo">Offerte</p>
          <h2 className="titolo-sezione mt-3">Il momento giusto per partire</h2>
        </div>
        <CarteOfferte {...offerte} />
      </div>
    </section>
  )
}
