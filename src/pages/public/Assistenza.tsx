import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Chat } from '../../components/Chat'
import { Icon } from '../../components/Icon'
import { Seo } from '../../components/Seo'
import { Caricamento, MessaggioErrore, Vuoto } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { ATTESA_CHAT, useAggiornamento } from '../../lib/ticket'
import type { TicketPubblico } from '../../lib/types'
import { esegui, useQuery } from '../../lib/useQuery'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Chat privata di chi ha scritto senza account: si apre solo con il link segreto. */
export default function Assistenza() {
  const { token = '' } = useParams()
  const { dati: t, caricamento, errore, ricarica, setDati } = useQuery(
    () => (UUID.test(token) ? esegui<TicketPubblico | null>(supabase.rpc('leggi_ticket', { p_token: token })) : Promise.resolve(null)),
    [token],
  )
  const [copiato, setCopiato] = useState(false)

  const aggiorna = async () => {
    const { data } = await supabase.rpc('leggi_ticket', { p_token: token })
    if (data?.messaggi) setDati(data as TicketPubblico)
  }
  useAggiornamento(aggiorna, ATTESA_CHAT, !!t)

  async function invia(testo: string) {
    await esegui(supabase.rpc('scrivi_ticket', { p_token: token, p_testo: testo }))
    await aggiorna()
  }

  async function copia() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiato(true)
    } catch {
      setCopiato(false)
    }
  }

  return (
    <div className="container-sito max-w-3xl py-12 sm:py-16">
      <Seo titolo="La tua richiesta" noindex />
      {caricamento && !t ? (
        <Caricamento />
      ) : errore ? (
        <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>
      ) : !t ? (
        <Vuoto icona="chat" titolo="Chat non trovata">
          Controlla il link oppure{' '}
          <Link to="/#contatti" className="font-semibold text-brand-700">
            scrivici di nuovo
          </Link>
          .
        </Vuoto>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="sopratitolo">
                Ticket n. {t.numero} · {t.stato === 'aperto' ? 'aperto' : 'chiuso'}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight break-words text-brand-950">{t.oggetto}</h1>
            </div>
            <button type="button" className="btn-secondary self-start" onClick={copia}>
              <Icon name={copiato ? 'check' : 'file'} className="h-4 w-4" /> {copiato ? 'Link copiato' : 'Copia il link'}
            </button>
          </div>
          <Chat
            messaggi={t.messaggi}
            mio="richiedente"
            onInvia={invia}
            avviso={t.stato === 'chiuso' ? 'Il ticket è chiuso: scrivendo lo riapri.' : undefined}
          />
          <p className="text-sm text-slate-500">
            Questa è la tua chat privata: salva il link per leggere le risposte quando vuoi. Chi ha il link può leggerla, non condividerlo.
          </p>
        </div>
      )}
    </div>
  )
}
