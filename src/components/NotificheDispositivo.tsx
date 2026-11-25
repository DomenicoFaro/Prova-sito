import { useEffect, useState, type ReactNode } from 'react'
import { allineaPush, attivaPush, chiavePush, comeApp, disattivaPush, provaPush, pushPossibile, registraServizio, suIPhone } from '../lib/push'
import { messaggioErrore } from '../lib/supabase'
import { Icon } from './Icon'
import { MessaggioErrore, Spinner } from './ui'

type Stato = 'controllo' | 'installa' | 'nonSupportato' | 'bloccate' | 'spente' | 'attive'

/** Riquadro per ricevere le notifiche dei ticket anche con il sito chiuso. */
export function NotificheDispositivo() {
  const [stato, setStato] = useState<Stato>('controllo')
  const [chiave, setChiave] = useState('')
  const [lavoro, setLavoro] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [esito, setEsito] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      // Su iPhone le notifiche esistono solo per il sito aggiunto alla schermata Home
      if (suIPhone() && !comeApp()) return setStato('installa')
      if (!pushPossibile()) return setStato('nonSupportato')
      if (Notification.permission === 'denied') return setStato('bloccate')
      try {
        await registraServizio()
        if (await allineaPush()) return vivo && setStato('attive')
        const k = await chiavePush()
        if (!vivo) return
        setChiave(k)
        setStato('spente')
      } catch (e) {
        if (!vivo) return
        setErrore(messaggioErrore(e))
        setStato('spente')
      }
    })()
    return () => {
      vivo = false
    }
  }, [])

  async function esegui(azione: () => Promise<void>) {
    setErrore(null)
    setEsito('')
    setLavoro(true)
    try {
      await azione()
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setLavoro(false)
    }
  }

  const attiva = () =>
    esegui(async () => {
      const k = chiave || (await chiavePush())
      setStato((await attivaPush(k)) ? 'attive' : Notification.permission === 'denied' ? 'bloccate' : 'spente')
    })

  if (stato === 'controllo' || stato === 'nonSupportato') return null

  const riquadro = (titolo: string, testo: ReactNode, azioni?: ReactNode) => (
    <section className="card mb-5 p-4 sm:p-5" aria-label="Notifiche su questo dispositivo">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Icon name={stato === 'attive' ? 'check' : 'alert'} className="h-5 w-5 shrink-0 text-brand-600" /> {titolo}
          </h2>
          <div className="mt-1 text-sm text-slate-600">{testo}</div>
        </div>
        {azioni && <div className="flex shrink-0 flex-wrap gap-2">{azioni}</div>}
      </div>
      {errore && <div className="mt-3"><MessaggioErrore>{errore}</MessaggioErrore></div>}
      {esito && <p role="status" className="mt-3 text-sm font-medium text-brand-700">{esito}</p>}
    </section>
  )

  if (stato === 'installa') {
    return riquadro(
      'Ricevi le notifiche su iPhone',
      <ol className="list-decimal space-y-1 pl-5">
        <li>In Safari tocca <strong>Condividi</strong> (il quadrato con la freccia).</li>
        <li>Scegli <strong>Aggiungi alla schermata Home</strong>.</li>
        <li>Apri <strong>Forma Web</strong> dalla nuova icona, accedi e torna in questa pagina.</li>
      </ol>,
    )
  }
  if (stato === 'bloccate') {
    return riquadro(
      'Notifiche bloccate',
      suIPhone()
        ? 'Su iPhone apri Impostazioni → Notifiche → Forma Web e attiva «Consenti notifiche».'
        : 'Consenti le notifiche per questo sito dalle impostazioni del browser, poi ricarica la pagina.',
    )
  }
  if (stato === 'attive') {
    return riquadro(
      'Notifiche attive su questo dispositivo',
      'Arrivano anche con il sito chiuso.',
      <>
        <button
          className="btn-secondary"
          disabled={lavoro}
          onClick={() => esegui(async () => setEsito((await provaPush()) ? 'Notifica di prova inviata.' : 'Nessun dispositivo raggiunto: disattiva e riattiva.'))}
        >
          {lavoro && <Spinner className="h-4 w-4" />} Invia una prova
        </button>
        <button className="btn-ghost" disabled={lavoro} onClick={() => esegui(async () => { await disattivaPush(); setStato('spente') })}>
          Disattiva
        </button>
      </>,
    )
  }
  return riquadro(
    'Notifiche sul dispositivo',
    'Un avviso per ogni ticket e messaggio, anche con il sito chiuso. Si attivano su ogni telefono o computer che usi.',
    <button className="btn-primary" disabled={lavoro} onClick={attiva}>
      {lavoro && <Spinner className="h-4 w-4" />} Attiva le notifiche
    </button>,
  )
}
