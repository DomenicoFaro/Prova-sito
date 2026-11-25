import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../../auth/AuthProvider'
import { Accessi } from '../../../components/Accessi'
import { Icon } from '../../../components/Icon'
import { ScegliStelle } from '../../../components/Stelle'
import { Caricamento, IntestazionePagina, MessaggioErrore, MessaggioSuccesso, Spinner, Vuoto } from '../../../components/ui'
import { apriComeCliente, leggiCassaforteCliente } from '../../../lib/cassaforte'
import { formatData } from '../../../lib/format'
import { messaggioErrore, supabase } from '../../../lib/supabase'
import type { Recensione, SitoCliente } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

export default function AreaCliente() {
  const { profilo } = useAuth()
  const id = profilo?.id ?? ''
  const { dati, caricamento, errore, ricarica } = useQuery(async () => {
    const [siti, recensione] = await Promise.all([
      esegui<SitoCliente[]>(supabase.from('siti_cliente').select('*').eq('cliente_id', id).order('data_acquisto')),
      esegui<Recensione | null>(supabase.from('recensioni').select('*').eq('cliente_id', id).maybeSingle()),
    ])
    return { siti, recensione }
  }, [id])

  return (
    <div className="space-y-8">
      <IntestazionePagina titolo={`Ciao ${profilo?.nome.split(' ')[0] ?? ''}`} sottotitolo="Qui trovi il tuo sito, i suoi accessi e la tua recensione." />
      {caricamento && !dati ? (
        <Caricamento />
      ) : errore ? (
        <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>
      ) : dati ? (
        <>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Il tuo sito</h2>
            {!dati.siti.length ? (
              <div className="card"><Vuoto icona="globe" titolo="Nessun sito ancora">Comparirà qui appena Forma Web lo registra nel tuo account.</Vuoto></div>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {dati.siti.map((s) => (
                  <li key={s.id} className="card flex flex-col p-5">
                    <p className="font-semibold break-words text-slate-900">{s.nome}</p>
                    <p className="mt-1 text-xs text-slate-500">Acquistato il {formatData(s.data_acquisto)}</p>
                    {s.note && <p className="mt-3 text-sm break-words whitespace-pre-line text-slate-600">{s.note}</p>}
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 self-start">
                        Apri il sito <Icon name="external" className="h-4 w-4" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <CassaforteCliente clienteId={id} />

          {dati.siti.length > 0 && <MiaRecensione recensione={dati.recensione} nome={profilo?.nome ?? ''} onSalvata={ricarica} />}
        </>
      ) : null}
    </div>
  )
}

function CassaforteCliente({ clienteId }: { clienteId: string }) {
  const { dati: riga, caricamento, errore, ricarica } = useQuery(() => leggiCassaforteCliente(clienteId), [clienteId])
  const [codice, setCodice] = useState('')
  const [chiave, setChiave] = useState<CryptoKey | null>(null)
  const [lavoro, setLavoro] = useState(false)
  const [sbagliato, setSbagliato] = useState<string | null>(null)

  async function apri(e: FormEvent) {
    e.preventDefault()
    if (!riga) return
    setSbagliato(null)
    setLavoro(true)
    try {
      setChiave(await apriComeCliente(codice, riga))
      setCodice('')
    } catch (err) {
      setSbagliato(messaggioErrore(err))
    } finally {
      setLavoro(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Gli accessi del tuo sito</h2>
        {chiave && (
          <button className="btn-secondary" onClick={() => setChiave(null)}>
            <Icon name="lock" className="h-4 w-4" /> Chiudi
          </button>
        )}
      </div>
      {caricamento ? (
        <Caricamento />
      ) : errore ? (
        <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>
      ) : !riga ? (
        <div className="card"><Vuoto icona="lock" titolo="Nessun accesso salvato" /></div>
      ) : chiave ? (
        <Accessi clienteId={clienteId} chiave={chiave} />
      ) : (
        <form onSubmit={apri} className="card max-w-lg space-y-4 p-5 sm:p-6">
          <p className="text-sm text-slate-600">Email e password sono protette. Scrivi il <strong>codice</strong> che ti ha dato Forma Web.</p>
          {sbagliato && <MessaggioErrore>{sbagliato}</MessaggioErrore>}
          <div>
            <label className="label" htmlFor="codice">Il tuo codice</label>
            <input id="codice" className="input font-mono uppercase" autoComplete="off" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" value={codice} onChange={(e) => setCodice(e.target.value)} />
          </div>
          <button className="btn-primary" disabled={lavoro || !codice.trim()}>
            {lavoro ? <Spinner className="h-4 w-4" /> : <Icon name="lock" className="h-4 w-4" />} Mostra gli accessi
          </button>
        </form>
      )}
    </section>
  )
}

function MiaRecensione({ recensione, nome, onSalvata }: { recensione: Recensione | null; nome: string; onSalvata: () => void }) {
  const [stelle, setStelle] = useState(0)
  const [testo, setTesto] = useState('')
  const [firma, setFirma] = useState('')
  const [invio, setInvio] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; testo: string } | null>(null)

  useEffect(() => {
    setStelle(recensione?.stelle ?? 0)
    setTesto(recensione?.testo ?? '')
    setFirma(recensione?.firma ?? nome)
  }, [recensione, nome])

  async function invia(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!stelle) return setMsg({ ok: false, testo: 'Scegli da 1 a 5 stelle.' })
    if (testo.trim().length < 10) return setMsg({ ok: false, testo: 'Scrivi almeno 10 caratteri.' })
    if (firma.trim().length < 2) return setMsg({ ok: false, testo: 'Scrivi il nome con cui firmare.' })
    setInvio(true)
    const { error } = await supabase.rpc('lascia_recensione', { p_stelle: stelle, p_testo: testo, p_firma: firma })
    setInvio(false)
    if (error) return setMsg({ ok: false, testo: messaggioErrore(error) })
    setMsg({ ok: true, testo: recensione ? 'Recensione aggiornata.' : 'Grazie! La tua recensione è online.' })
    onSalvata()
  }

  return (
    <section id="recensione" className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">La tua recensione</h2>
      <form onSubmit={invia} className="card max-w-2xl space-y-4 p-5 sm:p-6">
        {msg && (msg.ok ? <MessaggioSuccesso>{msg.testo}</MessaggioSuccesso> : <MessaggioErrore>{msg.testo}</MessaggioErrore>)}
        {recensione && !recensione.visibile && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Al momento la tua recensione non è visibile sul sito.</p>}
        <ScegliStelle voto={stelle} onScegli={setStelle} />
        <div>
          <label className="label" htmlFor="rtesto">Com'è andata?</label>
          <textarea id="rtesto" rows={5} maxLength={800} className="input" value={testo} onChange={(e) => setTesto(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="rfirma">Firma</label>
          <input id="rfirma" maxLength={80} className="input" value={firma} onChange={(e) => setFirma(e.target.value)} />
        </div>
        <p className="text-xs text-slate-500">Voto, testo, firma e nome del sito saranno visibili a tutti sul sito di Forma Web.</p>
        <button className="btn-primary" disabled={invio}>
          {invio && <Spinner className="h-4 w-4" />} {recensione ? 'Aggiorna recensione' : 'Pubblica recensione'}
        </button>
      </form>
    </section>
  )
}
