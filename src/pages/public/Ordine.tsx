import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { RiepilogoPreventivo } from '../../components/RiepilogoPreventivo'
import { Seo } from '../../components/Seo'
import { TestoContratto } from '../../components/TestoContratto'
import { Caricamento, MessaggioErrore, MessaggioSuccesso, Spinner } from '../../components/ui'
import { formatData, formatDataOra, formatEuro } from '../../lib/format'
import { avviaPagamento, ETICHETTE_STATO_ORDINE, linkOrdine, scaricaContratto, stampaContratto, type OrdineCliente } from '../../lib/ordini'
import { messaggioErrore, supabase } from '../../lib/supabase'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function Dato({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{etichetta}</dt>
      <dd className="mt-0.5 font-medium break-words text-slate-900">{valore || '—'}</dd>
    </div>
  )
}

export default function Ordine() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const tornatoDalPagamento = params.get('pagato') === '1'

  const [ordine, setOrdine] = useState<OrdineCliente | null>(null)
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [firmatario, setFirmatario] = useState('')
  const [accetto, setAccetto] = useState(false)
  const [inCorso, setInCorso] = useState(false)
  const [erroreAzione, setErroreAzione] = useState<string | null>(null)
  const [copiato, setCopiato] = useState(false)
  const tentativi = useRef(0)

  async function carica(silenzioso = false) {
    if (!UUID.test(token)) {
      setOrdine(null)
      setCaricamento(false)
      return
    }
    if (!silenzioso) setCaricamento(true)
    try {
      const { data, error } = await supabase.rpc('leggi_ordine', { p_token: token })
      if (error) throw error
      setOrdine((data as OrdineCliente | null) ?? null)
      setErrore(null)
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setCaricamento(false)
    }
  }

  useEffect(() => {
    carica()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Dopo il pagamento Stripe avvisa il sito con un webhook: finché lo stato non cambia si ricontrolla
  const inAttesaConferma = tornatoDalPagamento && ordine?.stato === 'preventivo_inviato'
  useEffect(() => {
    if (!inAttesaConferma) return
    const id = setInterval(() => {
      if (++tentativi.current > 30) return clearInterval(id)
      carica(true)
    }, 3000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inAttesaConferma])

  async function accettaEPaga() {
    setErroreAzione(null)
    setInCorso(true)
    try {
      window.location.assign(await avviaPagamento(token, firmatario.trim()))
    } catch (e) {
      setErroreAzione(e instanceof Error ? e.message : messaggioErrore(e))
      setInCorso(false)
    }
  }

  async function copiaLink() {
    try {
      await navigator.clipboard.writeText(linkOrdine(token))
      setCopiato(true)
      setTimeout(() => setCopiato(false), 2000)
    } catch {
      /* clipboard non disponibile */
    }
  }

  if (caricamento) return <Caricamento pieno testo="Carico il tuo ordine…" />
  if (errore) {
    return (
      <div className="container-sito py-12">
        <MessaggioErrore onRiprova={() => carica()}>{errore}</MessaggioErrore>
      </div>
    )
  }
  if (!ordine) {
    return (
      <div className="container-sito py-20 text-center">
        <p className="text-lg font-semibold text-slate-800">Ordine non trovato</p>
        <p className="mt-1 text-sm text-slate-500">Controlla di aver aperto il link completo che hai ricevuto.</p>
      </div>
    )
  }

  const inProva = ordine.tipo_ordine === 'prova'
  const daPagare = Number(ordine.acconto ?? ordine.prezzo ?? 0)
  const saldo = Number(ordine.prezzo ?? 0) - daPagare
  const nomeValido = firmatario.trim().length >= 2

  return (
    <>
      <Seo titolo={`Ordine ${ordine.numero_ordine}`} />
      <div className="container-sito max-w-3xl space-y-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-brand-600">
              Ordine {ordine.numero_ordine}
              {inProva && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">Prova di un mese</span>}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{ordine.nome_attivita || ordine.tipo_sito || 'Il tuo sito'}</h1>
            <p className="mt-1 text-sm text-slate-500">Stato: {ETICHETTE_STATO_ORDINE[ordine.stato]}</p>
          </div>
          <button onClick={copiaLink} className="btn-secondary text-xs">
            <Icon name={copiato ? 'check' : 'external'} className="h-4 w-4" /> {copiato ? 'Link copiato' : 'Copia il link di questo ordine'}
          </button>
        </div>

        {params.get('nuovo') === '1' && ordine.stato === 'richiesto' && (
          <MessaggioSuccesso>
            Richiesta inviata! <strong>Salva questo indirizzo</strong>: da qui vedrai il preventivo e potrai acquistare. Lo ritrovi anche sul tuo
            dispositivo nella pagina «Sito su misura».
          </MessaggioSuccesso>
        )}

        {ordine.stato === 'richiesto' && (
          <div className="card p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <Icon name="clock" className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-slate-900">
                  {ordine.approvazione_manuale ? 'La tua richiesta è in verifica manuale' : 'Stiamo confermando il tuo preventivo'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {ordine.approvazione_manuale
                    ? 'Il tuo progetto include una voce personalizzata o con prezzo «da»: FormaWeb deve verificarlo e confermarti l’importo definitivo. '
                    : 'FormaWeb sta verificando la tua richiesta e confermerà l’importo definitivo. '}
                  <strong>Il pagamento sarà disponibile solo dopo questa conferma.</strong> Appena è pronto lo trovi su questa pagina, insieme al
                  contratto da leggere. Ricontrolla qui tra poco.
                </p>
                <button onClick={() => carica()} className="btn-secondary mt-3 text-xs">
                  Aggiorna
                </button>
              </div>
            </div>
          </div>
        )}

        {ordine.stato === 'annullato' && <MessaggioErrore>Questo ordine è stato annullato. Se pensi sia un errore, contattaci.</MessaggioErrore>}

        {ordine.stato === 'preventivo_inviato' && (
          <>
            {inAttesaConferma ? (
              <div role="status" className="card flex items-center gap-3 p-5 text-sm text-slate-700">
                <Spinner className="h-5 w-5 text-brand-600" /> Pagamento ricevuto: sto confermando l'ordine e preparando il tuo contratto…
              </div>
            ) : (
              <>
                <div className="card p-5 sm:p-6">
                  <h2 className="text-lg font-bold text-slate-900">Il tuo preventivo</h2>
                  <p className="mt-1 text-sm text-emerald-700">Importo confermato da FormaWeb.</p>
                  <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                    <Dato etichetta={inProva ? 'Prezzo pieno del sito' : 'Prezzo del sito'} valore={formatEuro(ordine.prezzo)} />
                    <Dato etichetta={inProva ? 'Da pagare ora (mese di prova)' : 'Da pagare ora'} valore={formatEuro(daPagare)} />
                    <Dato etichetta="Consegna" valore={ordine.consegna_giorni ? `${ordine.consegna_giorni} giorni` : '—'} />
                  </dl>
                  {saldo > 0 && (
                    <p className="mt-3 text-sm text-slate-600">
                      {inProva
                        ? `Il resto di ${formatEuro(saldo)} lo paghi alla fine del mese di prova, solo se decidi di tenere il sito. Se non ti convince, non paghi altro.`
                        : `Il saldo di ${formatEuro(saldo)} è dovuto alla consegna del sito.`}
                    </p>
                  )}
                  {ordine.nota_preventivo && (
                    <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm whitespace-pre-line text-slate-700">{ordine.nota_preventivo}</p>
                  )}
                </div>

                <div className="card space-y-4 p-5 sm:p-6">
                  <h2 className="text-lg font-bold text-slate-900">Contratto</h2>
                  <p className="text-sm text-slate-600">Leggilo con calma: è già compilato con i tuoi dati e quelli del tuo ordine.</p>
                  {ordine.contratto ? (
                    <TestoContratto testo={ordine.contratto} />
                  ) : (
                    <MessaggioErrore>Il contratto non è disponibile. Contattaci.</MessaggioErrore>
                  )}
                  {ordine.contratto && (
                    <button type="button" className="btn-ghost text-xs" onClick={() => stampaContratto(ordine.contratto!, `Contratto ${ordine.numero_ordine}`)}>
                      <Icon name="download" className="h-4 w-4" /> Stampa / salva in PDF
                    </button>
                  )}

                  <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
                    <input type="checkbox" checked={accetto} onChange={(e) => setAccetto(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" />
                    Ho letto il contratto e lo accetto integralmente.
                  </label>
                  <label className="block">
                    <span className="label">Scrivi nome e cognome per firmare</span>
                    <input value={firmatario} onChange={(e) => setFirmatario(e.target.value)} maxLength={200} className="input" autoComplete="name" />
                  </label>

                  {erroreAzione && <MessaggioErrore>{erroreAzione}</MessaggioErrore>}

                  <button onClick={accettaEPaga} disabled={!accetto || !nomeValido || inCorso || !ordine.contratto} className="btn-primary w-full py-3 text-base sm:w-auto">
                    {inCorso ? <Spinner className="h-4 w-4" /> : <Icon name="lock" className="h-4 w-4" />} {inProva ? 'Accetta e paga la prova' : 'Accetta e paga'} {formatEuro(daPagare)}
                  </button>
                  <p className="text-xs text-slate-500">Pagamento sicuro con carta tramite Stripe. Dopo il pagamento ti arriva il contratto compilato.</p>
                </div>
              </>
            )}
          </>
        )}

        {ordine.stato === 'pagato' && (
          <>
            <MessaggioSuccesso>
              {ordine.metodo_pagamento === 'contanti' ? 'Pagamento in contanti registrato' : 'Pagamento ricevuto'}
              {ordine.pagato_il ? ` il ${formatDataOra(ordine.pagato_il)}` : ''}: {formatEuro(ordine.importo_pagato)}. Grazie!{' '}
              {ordine.metodo_pagamento === 'contanti'
                ? 'Il contratto compilato è qui sotto: puoi scaricarlo o stamparlo.'
                : `Il contratto compilato è qui sotto e te lo abbiamo inviato anche via email a ${ordine.cliente_email} (se non lo trovi, controlla lo spam).`}
            </MessaggioSuccesso>
            {inProva && ordine.prova_fino_al && (
              <div className="card p-5 sm:p-6">
                <h2 className="font-semibold text-slate-900">La tua prova di un mese</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Puoi provare il sito fino al <strong>{formatData(ordine.prova_fino_al)}</strong>. Se ti piace, alla fine del mese paghi il resto di{' '}
                  <strong>{formatEuro(ordine.saldo_dopo_prova)}</strong>; se non ti convince, non devi altro.
                </p>
              </div>
            )}
            {ordine.contratto && (
              <div className="card space-y-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-slate-900">Il tuo contratto</h2>
                  <div className="flex gap-2">
                    <button className="btn-secondary text-xs" onClick={() => scaricaContratto(ordine.contratto!, `Contratto ${ordine.numero_ordine}`)}>
                      <Icon name="download" className="h-4 w-4" /> Scarica
                    </button>
                    <button className="btn-secondary text-xs" onClick={() => stampaContratto(ordine.contratto!, `Contratto ${ordine.numero_ordine}`)}>
                      Stampa / PDF
                    </button>
                  </div>
                </div>
                <TestoContratto testo={ordine.contratto} className="max-h-[32rem]" />
              </div>
            )}
          </>
        )}

        {ordine.dettaglio_preventivo && ordine.stato !== 'annullato' && (
          <div className="card p-5 sm:p-6">
            <h2 className="font-semibold text-slate-900">
              {ordine.stato === 'richiesto' ? 'Preventivo indicativo' : 'Il preventivo indicativo della tua richiesta'}
            </h2>
            <div className="mt-3">
              <RiepilogoPreventivo
                preventivo={ordine.dettaglio_preventivo}
                urgenzaRichiesta={Boolean(ordine.urgenza_richiesta)}
                avviso={
                  ordine.stato === 'richiesto'
                    ? 'Preventivo indicativo, soggetto a conferma da parte di FormaWeb. L’importo da pagare è quello confermato da FormaWeb.'
                    : 'Stima iniziale della tua richiesta. L’importo da pagare è quello confermato da FormaWeb.'
                }
              />
            </div>
          </div>
        )}

        <div className="card p-5 sm:p-6">
          <h2 className="font-semibold text-slate-900">Cosa hai richiesto</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <Dato etichetta="Tipo di sito" valore={ordine.tipo_sito} />
            <Dato etichetta="Pagine" valore={ordine.pagine} />
            <Dato etichetta="Dominio" valore={ordine.dominio} />
            <Dato etichetta="Funzionalità" valore={ordine.funzionalita.join(', ')} />
            {ordine.scadenza && <Dato etichetta="Consegna" valore={ordine.scadenza} />}
            {ordine.budget && <Dato etichetta="Budget indicato" valore={ordine.budget} />}
            {Boolean(ordine.n_allegati) && <Dato etichetta="File allegati" valore={String(ordine.n_allegati)} />}
          </dl>
          <p className="mt-4 text-sm whitespace-pre-line text-slate-700">{ordine.descrizione}</p>
        </div>
      </div>
    </>
  )
}
