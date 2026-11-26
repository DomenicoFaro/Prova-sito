import { useState, type FormEvent } from 'react'
import { Caricamento, MessaggioErrore, MessaggioSuccesso, Spinner } from '../../../components/ui'
import { oggiInItalia, prezzoStima, type Impostazioni } from '../../../lib/configuratore'
import { formatData, parseNumero } from '../../../lib/format'
import { messaggioErrore, supabase } from '../../../lib/supabase'
import { esegui, useQuery } from '../../../lib/useQuery'

function StatoOfferta({ attiva, scadenza }: { attiva: boolean; scadenza: string }) {
  const [classe, testo] = !attiva
    ? ['bg-slate-100 text-slate-600', 'Spenta']
    : scadenza < oggiInItalia()
      ? ['bg-amber-50 text-amber-700', `Scaduta il ${formatData(scadenza)}`]
      : ['bg-emerald-50 text-emerald-700', `Online fino al ${formatData(scadenza)}`]
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${classe}`}>{testo}</span>
}

function Modulo({ impostazioni, onSalvato }: { impostazioni: Impostazioni; onSalvato: () => void }) {
  const [ribasso, setRibasso] = useState(impostazioni.ribasso_stima ?? '0')
  const [sconto, setSconto] = useState(impostazioni.offerta_sconto ?? '0')
  const [scadenza, setScadenza] = useState(impostazioni.offerta_scadenza ?? '')
  const [scadenzaProva, setScadenzaProva] = useState(impostazioni.prova_offerta_scadenza ?? '')
  const [attesa, setAttesa] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const r = parseNumero(ribasso)
  const s = parseNumero(sconto)
  const valida = (n: number) => Number.isFinite(n) && n >= 0 && n <= 99
  const esempio = valida(r) ? prezzoStima(300, r) : null

  async function salva(e: FormEvent) {
    e.preventDefault()
    setErrore(null)
    setOk(false)
    if (!valida(r)) return setErrore('Il ribasso dei prezzi mostrati deve essere tra 0 e 99.')
    if (!valida(s)) return setErrore('Lo sconto dell’offerta deve essere tra 0 e 99.')
    if (s > 0 && !scadenza) return setErrore('Indica fino a quando vale lo sconto.')
    setAttesa(true)
    try {
      // Il database accetta al massimo due cifre intere: si salva con due decimali al più
      const testo = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
      await esegui(
        supabase.from('configuratore_impostazioni').upsert([
          { chiave: 'ribasso_stima', valore: testo(r) },
          { chiave: 'offerta_sconto', valore: testo(s) },
          { chiave: 'offerta_scadenza', valore: scadenza },
          { chiave: 'prova_offerta_scadenza', valore: scadenzaProva },
        ]),
      )
      setOk(true)
      onSalvato()
    } catch (err) {
      setErrore(messaggioErrore(err))
    } finally {
      setAttesa(false)
    }
  }

  return (
    <form onSubmit={salva} className="max-w-3xl space-y-5">
      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">Sconto sull&apos;acquisto del sito</h3>
          <StatoOfferta attiva={Number(parseNumero(impostazioni.offerta_sconto ?? '0')) > 0} scadenza={impostazioni.offerta_scadenza ?? ''} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Sconto (%)</span>
            <input value={sconto} onChange={(e) => setSconto(e.target.value)} inputMode="decimal" className="input" />
            <span className="mt-1 block text-xs text-slate-500">0 = offerta spenta. Non si applica alla prova.</span>
          </label>
          <label className="block">
            <span className="label">Valido fino al (compreso)</span>
            <input type="date" value={scadenza} onChange={(e) => setScadenza(e.target.value)} className="input" />
            <span className="mt-1 block text-xs text-slate-500">Dal giorno dopo sparisce da sola dal sito.</span>
          </label>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">Offerta «Prova il tuo sito»</h3>
          <StatoOfferta attiva={Boolean(impostazioni.prova_offerta_scadenza)} scadenza={impostazioni.prova_offerta_scadenza ?? ''} />
        </div>
        <label className="block max-w-xs">
          <span className="label">In evidenza tra le offerte fino al</span>
          <input type="date" value={scadenzaProva} onChange={(e) => setScadenzaProva(e.target.value)} className="input" />
        </label>
        <p className="text-xs text-slate-500">
          Il prezzo della prova si cambia in <strong>Listino prezzi e servizi → Impostazioni</strong>. Dopo la scadenza sparisce solo il riquadro
          dell&apos;offerta: la prova resta ordinabile al prezzo impostato, finché non lo cambi.
        </p>
      </section>

      <section className="card space-y-4 p-5">
        <h3 className="font-semibold text-slate-900">Prezzi mostrati ai clienti</h3>
        <label className="block max-w-xs">
          <span className="label">Ribasso rispetto al listino (%)</span>
          <input value={ribasso} onChange={(e) => setRibasso(e.target.value)} inputMode="decimal" className="input" />
        </label>
        <p className="text-sm text-slate-600">
          I clienti vedono prezzi indicativi («circa»).
          {esempio != null && (
            <>
              {' '}
              Esempio: una voce da 300 € a listino compare come <strong>circa {esempio} €</strong>.
            </>
          )}{' '}
          Il prezzo finale lo scrivi tu su ogni preventivo.
        </p>
      </section>

      {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
      {ok && <MessaggioSuccesso>Offerte salvate. Sono già visibili sul sito e valgono per le nuove richieste.</MessaggioSuccesso>}
      <button className="btn-primary" disabled={attesa}>
        {attesa && <Spinner className="h-4 w-4" />} Salva offerte
      </button>
    </form>
  )
}

/** Preventivi → Offerte: sconti, scadenze e ribasso dei prezzi mostrati. Solo admin. */
export function AdminOfferte() {
  const { dati, caricamento, errore, ricarica } = useQuery(async () => {
    const righe = await esegui<{ chiave: string; valore: string }[]>(supabase.from('configuratore_impostazioni').select('chiave, valore'))
    return Object.fromEntries(righe.map((r) => [r.chiave, r.valore])) as Impostazioni
  })
  // Il modulo resta montato mentre si ricarica dopo il salvataggio, così il messaggio di conferma non sparisce
  if (caricamento && !dati) return <Caricamento />
  if (errore || !dati) {
    return (
      <MessaggioErrore onRiprova={ricarica}>
        {errore} Hai eseguito <code>supabase/configuratore.sql</code>?
      </MessaggioErrore>
    )
  }
  return (
    <>
      {dati.ribasso_stima === undefined && (
        <div className="mb-5">
          <MessaggioErrore>
            Per attivare offerte e prezzi «circa» esegui di nuovo <code>supabase/configuratore.sql</code> nell&apos;SQL Editor di Supabase.
          </MessaggioErrore>
        </div>
      )}
      <Modulo impostazioni={dati} onSalvato={ricarica} />
    </>
  )
}
