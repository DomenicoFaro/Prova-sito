import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CONTATTI, DOMANDE, FUNZIONI, PASSI, SERVIZI } from '../../config'
import { Icon } from '../../components/Icon'
import { Finestra, Telefono } from '../../components/Mockup'
import { ProjectCard, ProjectCardScheletro } from '../../components/ProjectCard'
import { quante, SezioneRecensioni, useRecensioni, votoInTesto } from '../../components/Recensioni'
import { Reveal } from '../../components/Reveal'
import { SezioneOfferte } from '../../components/Offerte'
import { Stelle } from '../../components/Stelle'
import { Seo } from '../../components/Seo'
import { ModuloContatto } from '../../components/ModuloContatto'
import { MessaggioErrore } from '../../components/ui'
import { dominio, useLavori, type Lavoro } from '../../data/lavori'

export default function Home() {
  const { dati, caricamento, errore, ricarica } = useLavori()
  const lavori = dati ?? []
  const { hash } = useLocation()
  const recensioni = useRecensioni()

  // I progetti arrivano dopo e allungano la pagina: si torna sulla sezione richiesta
  useEffect(() => {
    if (!caricamento && hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [caricamento, recensioni.elenco.length])

  return (
    <>
      <Seo />
      <Hero voto={recensioni.media} totale={recensioni.elenco.length} />
      <SezioneOfferte />
      <SezioneRecensioni {...recensioni} />
      <Clienti lavori={lavori} />
      <Servizi lavori={lavori} />

      {/* Lavori */}
      <section className="py-24 sm:py-32">
        <div className="container-sito">
          <Reveal className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="sopratitolo">Lavori</p>
              <h2 className="titolo-sezione mt-3">Siti veri, già online</h2>
            </div>
            <Link to="/portfolio" className="btn-secondary">
              Tutti i lavori <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </Reveal>
          <div className="mt-14">
            {errore ? (
              <MessaggioErrore onRiprova={ricarica}>Non è stato possibile caricare i progetti. {errore}</MessaggioErrore>
            ) : !caricamento && lavori.length === 0 ? (
              <p className="text-slate-500">Nessun progetto pubblicato.</p>
            ) : (
              <div className="grid gap-x-10 gap-y-16 md:grid-cols-2">
                {caricamento
                  ? [0, 1, 2, 3].map((i) => <ProjectCardScheletro key={i} />)
                  : lavori.slice(0, 4).map((p, i) => (
                      <Reveal key={p.id} ritardo={(i % 2) * 100}>
                        <ProjectCard progetto={p} />
                      </Reveal>
                    ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <Funzioni />
      <Metodo />
      <Domande />
      <Contatti />
    </>
  )
}

function Hero({ voto, totale }: { voto: number; totale: number }) {
  return (
    <section className="pt-16 sm:pt-24">
      <div className="container-sito text-center">
        <p className="sali inline-flex items-center gap-2 rounded-full bg-nebbia px-4 py-1.5 text-sm font-medium text-brand-900">
          <span className="h-2 w-2 rounded-full bg-brand-500" /> Web design e soluzioni digitali
        </p>
        <h1
          className="sali mx-auto mt-7 max-w-4xl text-5xl leading-[1.02] font-extrabold tracking-tight text-balance text-brand-950 sm:text-7xl"
          style={{ animationDelay: '0.08s' }}
        >
          Siti web che fanno <span className="evidenziato">lavorare</span> la tua attività.
        </h1>
        <p className="sali mx-auto mt-7 max-w-xl text-lg leading-relaxed text-pretty text-slate-600" style={{ animationDelay: '0.16s' }}>
          Forma Web realizza vetrine, negozi online, prenotazioni e gestionali su misura. Belli da vedere e semplici da usare, prima di tutto dal telefono.
        </p>
        <div className="sali mt-9 flex flex-col justify-center gap-3 sm:flex-row" style={{ animationDelay: '0.24s' }}>
          <Link to="/preventivo" className="btn-primary btn-grande">
            Crea il tuo preventivo <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
          <Link to="/prova-un-mese" className="btn-secondary btn-grande">
            <Icon name="clock" className="h-4 w-4" /> Prova il tuo sito
          </Link>
        </div>
        <Link to="/portfolio" className="sali mt-6 inline-block text-sm font-semibold text-brand-700 underline-offset-4 hover:underline" style={{ animationDelay: '0.3s' }}>
          oppure guarda i lavori
        </Link>
        {totale > 0 && (
          <div className="sali mt-6">
            <Link to="/#recensioni" className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-slate-200 bg-white px-5 py-2.5 shadow-sm transition hover:border-amber-300 hover:shadow-md">
              <Stelle voto={voto} />
              <span className="text-sm font-semibold text-brand-950">
                {votoInTesto(voto)} su 5 · {quante(totale)}
              </span>
            </Link>
          </div>
        )}
      </div>

      {/* Vetrina: tre siti realizzati, computer e telefono */}
      <div className="sali container-sito mt-16 sm:mt-20" style={{ animationDelay: '0.35s' }}>
        <div className="relative overflow-hidden rounded-[2rem] bg-brand-900 px-4 pt-8 pb-10 sm:rounded-[3rem] sm:px-20 sm:pt-16 sm:pb-20">
          <div className="pointer-events-none absolute -top-40 -right-32 h-96 w-96 rounded-full bg-lime-accento/25 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto max-w-3xl">
            <Finestra indirizzo="vogliadiparrucchieri.shop">
              <img src="/lavori/voglia.jpg" alt="Il sito Voglia di Parrucchieri su computer" width={1440} height={900} className="h-full w-full object-cover object-top" />
            </Finestra>
            <div className="absolute -bottom-6 -left-1 w-[22%] sm:-bottom-12 sm:-left-14">
              <div className="galleggia">
                <Telefono src="/lavori/pizza-m.jpg" alt="Il sito Epic Pizza su smartphone" />
              </div>
            </div>
            <div className="absolute -right-1 -bottom-6 w-[22%] sm:-right-14 sm:-bottom-12">
              <div className="galleggia" style={{ animationDelay: '-3.5s' }}>
                <Telefono src="/lavori/sogno-m.jpg" alt="Il sito Il Sogno della Bellezza su smartphone" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Fila con i nomi dei progetti pubblicati. */
function Clienti({ lavori }: { lavori: Lavoro[] }) {
  return (
    <section className="py-16 sm:py-20" aria-label="Progetti realizzati">
      <div className="container-sito min-h-20 text-center">
        {lavori.length > 0 && (
          <>
            <p className="text-sm text-slate-500">Hanno già un sito fatto da noi</p>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {lavori.map((p) => (
                <li key={p.id}>
                  <Link to={`/portfolio/${p.id}`} className="font-display text-xl font-semibold text-slate-400 transition hover:text-brand-950 sm:text-2xl">
                    {p.nome}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}

function Servizi({ lavori }: { lavori: Lavoro[] }) {
  return (
    <section id="servizi" className="scroll-mt-20 bg-nebbia py-24 sm:py-32">
      <div className="container-sito">
        <Reveal className="max-w-2xl">
          <p className="sopratitolo">Servizi</p>
          <h2 className="titolo-sezione mt-3">Quello che serve alla tua attività</h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">Partiamo da come lavori tu e costruiamo solo quello che ti è utile.</p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVIZI.map((s, i) => {
            const esempio = lavori.find((p) => dominio(p.url) === s.esempio)
            return (
              <Reveal key={s.titolo} ritardo={(i % 3) * 80}>
                <article className="flex h-full flex-col rounded-3xl bg-white p-8">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lime-accento text-brand-950">
                    <Icon name={s.icona} className="h-6 w-6" />
                  </span>
                  <h3 className="mt-7 text-2xl font-bold tracking-tight text-brand-950">{s.titolo}</h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{s.testo}</p>
                  <ul className="mt-6 flex-1 space-y-2.5 text-sm text-slate-700">
                    {s.punti.map((p) => (
                      <li key={p} className="flex items-center gap-2.5">
                        <Icon name="check" className="h-4 w-4 shrink-0 text-brand-500" /> {p}
                      </li>
                    ))}
                  </ul>
                  {esempio && (
                    <Link to={`/portfolio/${esempio.id}`} className="mt-7 inline-flex items-center gap-1.5 border-t border-slate-100 pt-5 text-sm font-semibold text-brand-900 hover:text-brand-500">
                      Esempio: {esempio.nome} <Icon name="arrowRight" className="h-4 w-4 shrink-0" />
                    </Link>
                  )}
                </article>
              </Reveal>
            )
          })}
          <Reveal ritardo={160}>
            <Link to="/portfolio" className="group flex h-full min-h-64 flex-col justify-between rounded-3xl bg-brand-900 p-8 text-white transition hover:bg-brand-800">
              <p className="font-display text-3xl leading-tight font-bold tracking-tight">Ti serve qualcos’altro? Guarda cosa abbiamo già fatto.</p>
              <span className="mt-8 grid h-14 w-14 place-items-center self-end rounded-full bg-lime-accento text-brand-950 transition group-hover:translate-x-1">
                <Icon name="arrowRight" className="h-6 w-6" />
              </span>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function Funzioni() {
  return (
    <section className="bg-brand-950 py-24 text-white sm:py-32">
      <div className="container-sito grid items-center gap-16 lg:grid-cols-[1fr_17rem] lg:gap-24">
        <div>
          <Reveal>
            <p className="text-sm font-semibold tracking-wide text-lime-accento">Non solo belli</p>
            <h2 className="mt-3 max-w-xl text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl">
              Il sito lavora anche quando tu sei occupato
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2">
            {FUNZIONI.map((f, i) => (
              <Reveal key={f.titolo} ritardo={(i % 2) * 80}>
                <Icon name={f.icona} className="h-7 w-7 text-lime-accento" />
                <h3 className="mt-4 text-xl font-semibold">{f.titolo}</h3>
                <p className="mt-2 leading-relaxed text-brand-200">{f.testo}</p>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal ritardo={120} className="mx-auto w-60 lg:w-full">
          <Telefono src="/lavori/voglia-m.jpg" alt="Prenotazione dal telefono sul sito Voglia di Parrucchieri" className="ring-1 ring-white/15" />
        </Reveal>
      </div>
    </section>
  )
}

function Metodo() {
  return (
    <section id="metodo" className="scroll-mt-20 py-24 sm:py-32">
      <div className="container-sito">
        <Reveal className="max-w-2xl">
          <p className="sopratitolo">Come lavoriamo</p>
          <h2 className="titolo-sezione mt-3">Dall’idea al sito online, in quattro passi</h2>
        </Reveal>
        <ol className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {PASSI.map((p, i) => (
            <li key={p.titolo}>
              <Reveal ritardo={i * 80} className="h-full border-t-2 border-brand-950 pt-6">
                <span className="font-display text-5xl font-extrabold text-brand-300">{i + 1}</span>
                <h3 className="mt-5 text-xl font-bold text-brand-950">{p.titolo}</h3>
                <p className="mt-2 leading-relaxed text-slate-600">{p.testo}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Domande() {
  return (
    <section id="domande" className="scroll-mt-20 border-t border-slate-900/5 py-24 sm:py-32">
      <div className="container-sito grid gap-12 lg:grid-cols-[1fr_1.5fr]">
        <Reveal>
          <p className="sopratitolo">Domande</p>
          <h2 className="titolo-sezione mt-3">Prima di iniziare</h2>
        </Reveal>
        <Reveal ritardo={80} className="divide-y divide-slate-900/10 border-y border-slate-900/10">
          {DOMANDE.map((d) => (
            <details key={d.domanda} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-lg font-semibold text-brand-950 [&::-webkit-details-marker]:hidden">
                {d.domanda}
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-nebbia transition group-open:rotate-45 group-open:bg-lime-accento">
                  <Icon name="plus" className="h-4 w-4" />
                </span>
              </summary>
              <p className="-mt-1 pr-14 pb-6 leading-relaxed text-slate-600">{d.risposta}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

/** Invito finale con il modulo per scriverci. WhatsApp compare se compilato in config.ts. */
function Contatti() {
  const { whatsapp } = CONTATTI
  return (
    <section id="contatti" className="scroll-mt-20 pb-24 sm:pb-32">
      <div className="container-sito">
        <Reveal>
          <div className="grid items-center gap-12 rounded-[2rem] bg-lime-accento px-4 py-10 text-brand-950 sm:rounded-[3rem] sm:px-12 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:px-16">
            <div className="px-2 text-center sm:px-0 lg:text-left">
              <p className="text-sm font-semibold tracking-wide text-brand-800">Contatti</p>
              <h2 className="mt-3 text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl">Il prossimo sito può essere il tuo.</h2>
              <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-brand-900 lg:mx-0">
                Hai una domanda o un’idea? Raccontaci cosa ti serve: apriamo un ticket e ti rispondiamo in chat, qui sul sito.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap lg:justify-start">
                <Link to="/preventivo" className="btn-primary btn-grande">
                  Crea il tuo preventivo <Icon name="arrowRight" className="h-4 w-4" />
                </Link>
                <Link to="/prova-un-mese" className="btn-secondary btn-grande">
                  <Icon name="clock" className="h-4 w-4" /> Prova il tuo sito
                </Link>
                {whatsapp && (
                  <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-grande">
                    <Icon name="chat" className="h-5 w-5" /> Scrivici su WhatsApp
                  </a>
                )}
              </div>
            </div>
            <div className="rounded-3xl bg-white p-6 text-slate-800 shadow-2xl shadow-brand-950/30 sm:p-8">
              <ModuloContatto />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
