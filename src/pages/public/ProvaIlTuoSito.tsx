import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Seo } from '../../components/Seo'

export default function ProvaIlTuoSito() {
  return (
    <>
      <Seo
        titolo="Prova il tuo sito"
        descrizione="Prova il tuo sito con Forma Web su formaweb.com: descrivi la tua attività, ricevi il preventivo e acquista il tuo sito web su misura online."
      />
      <section className="bg-black pt-10 pb-12 text-center text-white">
        <div className="container-sito">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Prova il tuo sito</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            Forma Web realizza siti web su misura per attività e professionisti. Raccontaci cosa fai e parti da qui: noi pensiamo al
            tuo sito.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/sito-su-misura" className="btn-primary px-6 py-3 text-base">
              <Icon name="cart" className="h-4 w-4" /> Acquista il tuo sito
            </Link>
            <Link to="/portfolio" className="btn px-6 py-3 text-base text-white ring-1 ring-white/25 hover:bg-white/10">
              Guarda il portfolio
            </Link>
          </div>
        </div>
      </section>
      <section className="container-sito max-w-3xl py-12">
        <h2 className="text-2xl font-bold text-slate-900">Come funziona</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-700">
          <li>Compili la richiesta descrivendo il sito che ti serve.</li>
          <li>Ricevi il preventivo.</li>
          <li>Leggi il contratto, accetti e paghi online.</li>
          <li>Ricevi il contratto firmato e il tuo sito viene realizzato.</li>
        </ol>
        <h2 className="mt-10 text-2xl font-bold text-slate-900">Nuovo indirizzo: formaweb.com</h2>
        <p className="mt-2 text-slate-700">
          Forma Web ha cambiato dominio: ora ci trovi su <strong>formaweb.com</strong>. Se ci cerchi su Google, scrivi «formaweb».
        </p>
      </section>
    </>
  )
}
