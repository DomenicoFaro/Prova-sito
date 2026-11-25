import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProjectCard, ProjectCardScheletro } from '../../components/ProjectCard'
import { Reveal } from '../../components/Reveal'
import { Seo } from '../../components/Seo'
import { MessaggioErrore, Vuoto } from '../../components/ui'
import { useLavori } from '../../data/lavori'

export default function Portfolio() {
  const [params, setParams] = useSearchParams()
  const filtro = params.get('categoria') ?? ''

  const { dati, caricamento, errore, ricarica } = useLavori()

  const categorie = useMemo(
    () => Array.from(new Set((dati ?? []).map((p) => p.categoria).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'it')),
    [dati],
  )
  const filtrati = (dati ?? []).filter((p) => !filtro || p.categoria === filtro)

  const scegli = (c: string) => {
    const next = new URLSearchParams(params)
    if (c) next.set('categoria', c)
    else next.delete('categoria')
    setParams(next, { replace: true })
  }

  return (
    <>
      <Seo titolo="Portfolio: siti web realizzati" descrizione="I siti web realizzati da Forma Web (formaweb.shop) per attività e professionisti. Guarda i progetti e prova il tuo sito." />
      <section className="container-sito pt-16 pb-10 sm:pt-24 sm:pb-14">
        <p className="sali sopratitolo">Lavori</p>
        <h1 className="sali mt-3 max-w-3xl text-5xl leading-[1.02] font-extrabold tracking-tight text-balance text-brand-950 sm:text-6xl">
          Ogni attività ha la sua <span className="evidenziato">forma</span>.
        </h1>
        <p className="sali mt-6 max-w-xl text-lg leading-relaxed text-slate-600">Scegli una categoria o apri un progetto per vederlo da vicino.</p>
      </section>

      <section className="container-sito pb-24 sm:pb-32">
        {categorie.length > 1 && (
          <div className="-mx-5 mb-12 flex gap-2 overflow-x-auto px-5 py-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtra per categoria">
            {['', ...categorie].map((c) => {
              const attivo = c === filtro
              return (
                <button
                  key={c || 'tutti'}
                  aria-pressed={attivo}
                  onClick={() => scegli(c)}
                  className={`btn shrink-0 ${attivo ? 'bg-brand-900 text-white' : 'bg-nebbia text-slate-700 hover:bg-brand-100'}`}
                >
                  {c || 'Tutti'}
                </button>
              )
            })}
          </div>
        )}

        {errore ? (
          <MessaggioErrore onRiprova={ricarica}>Non è stato possibile caricare il portfolio. {errore}</MessaggioErrore>
        ) : !caricamento && filtrati.length === 0 ? (
          <Vuoto titolo="Nessun progetto in questa categoria" />
        ) : (
          <div className="grid gap-x-10 gap-y-16 md:grid-cols-2">
            {caricamento
              ? [0, 1, 2, 3].map((i) => <ProjectCardScheletro key={i} />)
              : filtrati.map((p, i) => (
                  <Reveal key={p.id} ritardo={(i % 2) * 100}>
                    <ProjectCard progetto={p} />
                  </Reveal>
                ))}
          </div>
        )}
      </section>
    </>
  )
}
