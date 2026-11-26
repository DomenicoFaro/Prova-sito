import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { CarteOfferte, useOfferte } from '../../components/Offerte'
import { Seo } from '../../components/Seo'
import { Caricamento } from '../../components/ui'

export default function Offerte() {
  const offerte = useOfferte()
  return (
    <>
      <Seo titolo="Offerte" descrizione="Le offerte di Forma Web: sconto sul tuo nuovo sito web e prova di un mese a prezzo ridotto." />
      <section className="bg-brand-950 pt-12 pb-14 text-center text-white">
        <div className="container-sito">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Offerte</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">Le occasioni del momento per avere il tuo sito. Ogni offerta ha una scadenza.</p>
        </div>
      </section>

      <div className="container-sito py-14 sm:py-20">
        {offerte.caricamento ? (
          <Caricamento testo="Carico le offerte…" />
        ) : offerte.nessuna ? (
          <div className="mx-auto max-w-md text-center">
            <p className="text-lg font-semibold text-slate-900">Al momento non ci sono offerte attive</p>
            <p className="mt-2 text-slate-600">Puoi comunque creare il tuo preventivo: è gratuito e non ti impegna.</p>
            <Link to="/preventivo" className="btn-primary btn-grande mt-6">
              Crea il tuo preventivo <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <CarteOfferte {...offerte} />
        )}
      </div>
    </>
  )
}
