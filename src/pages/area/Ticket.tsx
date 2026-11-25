import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { Chat } from '../../components/Chat'
import { NotificheDispositivo } from '../../components/NotificheDispositivo'
import { Icon } from '../../components/Icon'
import { Caricamento, IntestazionePagina, MessaggioErrore, Modale, Spinner, Vuoto } from '../../components/ui'
import { formatDataOra } from '../../lib/format'
import { notificaTicket } from '../../lib/push'
import { messaggioErrore, supabase } from '../../lib/supabase'
import { ATTESA_CHAT, ticketCambiati, useAggiornamento, type useTicket } from '../../lib/ticket'
import type { MessaggioTicket, Profilo, SitoCliente, Ticket as RigaTicket } from '../../lib/types'
import { esegui, useQuery } from '../../lib/useQuery'

type Contesto = ReturnType<typeof useTicket>

/** Elenco dei ticket: ognuno vede i suoi (lo decide il database). */
export default function Ticket() {
  const { id } = useParams()
  return id ? <Conversazione id={id} /> : <Elenco />
}

function Elenco() {
  const { profilo, isAdmin, isCliente } = useAuth()
  const { ticket, errore, nuovo: daLeggere, ricarica } = useOutletContext<Contesto>()
  const [filtro, setFiltro] = useState<'aperto' | 'chiuso'>('aperto')
  const [nuovo, setNuovo] = useState(false)

  const visibili = (ticket ?? []).filter((t) => t.stato === filtro)

  return (
    <>
      <IntestazionePagina
        titolo={isCliente ? 'Assistenza' : 'Ticket'}
        sottotitolo={
          isCliente ? 'Scrivi a Forma Web: ti risponde qui in chat.' : isAdmin || profilo?.vede_tutti_ticket ? 'Tutte le richieste arrivate dal sito. Rispondi in chat.' : 'Le richieste dei siti che segui. Rispondi in chat.'
        }
        azioni={
          isCliente && (
            <button className="btn-primary" onClick={() => setNuovo(true)}>
              <Icon name="plus" className="h-4 w-4" /> Nuovo ticket
            </button>
          )
        }
      />

      <NotificheDispositivo />

      <div className="mb-4 flex gap-2" role="group" aria-label="Stato">
        {(['aperto', 'chiuso'] as const).map((s) => (
          <button
            key={s}
            aria-pressed={filtro === s}
            onClick={() => setFiltro(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${filtro === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
          >
            {s === 'aperto' ? 'Aperti' : 'Chiusi'} ({(ticket ?? []).filter((t) => t.stato === s).length})
          </button>
        ))}
      </div>

      {errore && !ticket ? (
        <MessaggioErrore onRiprova={ricarica}>Non è stato possibile caricare i ticket.</MessaggioErrore>
      ) : !ticket ? (
        <Caricamento />
      ) : !visibili.length ? (
        <div className="card">
          <Vuoto icona="chat" titolo={filtro === 'aperto' ? 'Nessun ticket aperto' : 'Nessun ticket chiuso'} />
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100 overflow-hidden">
          {visibili.map((t) => {
            const nonLetto = daLeggere(t)
            return (
              <li key={t.id}>
                <Link to={`/area/ticket/${t.id}`} className={`flex items-center gap-3 px-4 py-4 hover:bg-slate-50 sm:px-6 ${nonLetto ? 'bg-brand-50' : ''}`}>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${nonLetto ? 'bg-brand-500' : 'bg-transparent'}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-slate-900 ${nonLetto ? 'font-bold' : 'font-semibold'}`}>{t.oggetto}</p>
                    <p className="truncate text-sm text-slate-500">
                      n. {t.numero} · {isCliente ? t.sito_nome || 'Richiesta' : `${t.nome}${t.sito_nome ? ` · ${t.sito_nome}` : t.cliente_id ? '' : ' · dal sito'}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {nonLetto && <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-bold text-white">Nuovo</span>}
                    <p className="mt-1 text-xs text-slate-500">{formatDataOra(t.ultimo_messaggio_il)}</p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {isCliente && <NuovoTicket aperta={nuovo} onChiudi={() => setNuovo(false)} />}
    </>
  )
}

function NuovoTicket({ aperta, onChiudi }: { aperta: boolean; onChiudi: () => void }) {
  const { profilo } = useAuth()
  const navigate = useNavigate()
  const siti = useQuery(() => esegui<SitoCliente[]>(supabase.from('siti_cliente').select('*').eq('cliente_id', profilo?.id ?? '').order('data_acquisto')), [profilo?.id])
  const [form, setForm] = useState({ sito_id: '', oggetto: '', messaggio: '' })
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function apri(e: FormEvent) {
    e.preventDefault()
    setErrore(null)
    if (form.messaggio.trim().length < 10) return setErrore('Scrivi un messaggio di almeno 10 caratteri.')
    setInvio(true)
    const { data, error } = await supabase.rpc('apri_ticket', { p: form })
    setInvio(false)
    if (error || !data?.id) return setErrore(messaggioErrore(error))
    notificaTicket()
    setForm({ sito_id: '', oggetto: '', messaggio: '' })
    onChiudi()
    ticketCambiati()
    navigate(`/area/ticket/${data.id}`)
  }

  return (
    <Modale aperta={aperta} titolo="Nuovo ticket" onChiudi={onChiudi}>
      <form onSubmit={apri} className="space-y-4">
        {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
        {(siti.dati?.length ?? 0) > 1 && (
          <div>
            <label className="label" htmlFor="ts">Per quale sito?</label>
            <select id="ts" className="input" value={form.sito_id} onChange={(e) => setForm({ ...form, sito_id: e.target.value })}>
              {siti.dati!.map((s, i) => (
                <option key={s.id} value={i === 0 ? '' : s.id}>{s.nome}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="to">Oggetto</label>
          <input id="to" maxLength={120} className="input" placeholder="es. Cambiare gli orari" value={form.oggetto} onChange={(e) => setForm({ ...form, oggetto: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="tm">Messaggio</label>
          <textarea id="tm" rows={5} maxLength={4000} className="input" value={form.messaggio} onChange={(e) => setForm({ ...form, messaggio: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onChiudi}>Annulla</button>
          <button type="submit" className="btn-primary" disabled={invio}>{invio && <Spinner className="h-4 w-4" />} Invia</button>
        </div>
      </form>
    </Modale>
  )
}

function Conversazione({ id }: { id: string }) {
  const { isAdmin, isCliente } = useAuth()
  const navigate = useNavigate()
  const { dati, caricamento, errore, ricarica, setDati } = useQuery(async () => {
    const [ticket, messaggi, persone] = await Promise.all([
      esegui<RigaTicket | null>(supabase.from('tickets').select('*').eq('id', id).maybeSingle()),
      esegui<MessaggioTicket[]>(supabase.from('ticket_messaggi').select('*').eq('ticket_id', id).order('created_at')),
      isAdmin ? esegui<Profilo[]>(supabase.from('profiles').select('*').neq('ruolo', 'cliente').order('nome')) : Promise.resolve<Profilo[]>([]),
    ])
    return { ticket, messaggi, persone }
  }, [id, isAdmin])
  const [erroreAzione, setErroreAzione] = useState<string | null>(null)
  const [daEliminare, setDaEliminare] = useState(false)

  async function aggiorna() {
    const [t, m] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', id).maybeSingle(),
      supabase.from('ticket_messaggi').select('*').eq('ticket_id', id).order('created_at'),
    ])
    if (!t.error && !m.error && t.data) setDati((d) => d && { ...d, ticket: t.data as RigaTicket, messaggi: m.data as MessaggioTicket[] })
  }
  useAggiornamento(aggiorna, ATTESA_CHAT, !!dati?.ticket)

  // Aprendo la chat (e quando arriva un messaggio) il ticket risulta letto
  const quanti = dati?.messaggi.length ?? 0
  useEffect(() => {
    if (!quanti) return
    supabase.rpc('segna_letto_ticket', { p_ticket: id }).then(() => ticketCambiati())
  }, [id, quanti])

  async function azione(q: PromiseLike<{ error: unknown }>) {
    setErroreAzione(null)
    const { error } = await q
    if (error) setErroreAzione(messaggioErrore(error))
    await aggiorna()
    ticketCambiati()
  }

  if (caricamento && !dati) return <Caricamento />
  if (errore) return <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>
  const t = dati?.ticket
  if (!t) {
    return (
      <Vuoto icona="chat" titolo="Ticket non trovato">
        <Link to="/area/ticket" className="font-semibold text-brand-700">Torna all'elenco</Link>
      </Vuoto>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link to="/area/ticket" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
        <Icon name="arrowLeft" className="h-4 w-4" /> Tutti i ticket
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight break-words text-slate-900">{t.oggetto}</h1>
        <p className="mt-1 text-sm break-words text-slate-500">
          n. {t.numero} · {t.stato === 'aperto' ? 'Aperto' : 'Chiuso'}
          {t.sito_nome && ` · ${t.sito_nome}`}
          {!isCliente && (
            <>
              {' · '}{t.nome} · <a href={`mailto:${t.email}`} className="text-brand-700 hover:underline">{t.email}</a>
              {t.telefono && <> · <a href={`tel:${t.telefono.replace(/\s/g, '')}`} className="text-brand-700 hover:underline">{t.telefono}</a></>}
            </>
          )}
        </p>
      </div>

      {erroreAzione && <MessaggioErrore>{erroreAzione}</MessaggioErrore>}

      {!isCliente && (
        <div className="flex flex-wrap items-end gap-3">
          {isAdmin && (
            <label className="block">
              <span className="label">Collaboratore</span>
              <select className="input" value={t.collaboratore_id ?? ''} onChange={(e) => azione(supabase.rpc('assegna_ticket', { p_ticket: t.id, p_collaboratore: e.target.value || null })).then(notificaTicket)}>
                <option value="">Nessuno (solo io)</option>
                {dati!.persone.filter((p) => p.attivo || p.id === t.collaboratore_id).map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </label>
          )}
          <button className="btn-secondary" onClick={() => azione(supabase.rpc('imposta_stato_ticket', { p_ticket: t.id, p_stato: t.stato === 'aperto' ? 'chiuso' : 'aperto' }))}>
            <Icon name={t.stato === 'aperto' ? 'check' : 'chat'} className="h-4 w-4" /> {t.stato === 'aperto' ? 'Chiudi ticket' : 'Riapri'}
          </button>
          {isAdmin && (
            <button className="btn-ghost text-red-600" onClick={() => setDaEliminare(true)}>
              <Icon name="trash" className="h-4 w-4" /> Elimina
            </button>
          )}
        </div>
      )}

      <Chat
        messaggi={dati!.messaggi}
        mio={isCliente ? 'richiedente' : 'staff'}
        onInvia={async (testo) => {
          await esegui(supabase.rpc('rispondi_ticket', { p_ticket: t.id, p_testo: testo }))
          notificaTicket()
          await aggiorna()
          ticketCambiati()
        }}
        avviso={
          !isCliente && !t.cliente_id
            ? 'Chi scrive non ha un account: legge la risposta aprendo il suo link privato sul sito. Se è urgente, contattalo anche via email o telefono.'
            : undefined
        }
      />

      <Modale aperta={daEliminare} titolo="Eliminare il ticket?" onChiudi={() => setDaEliminare(false)}>
        <p className="text-sm text-slate-600">Il ticket e tutti i messaggi verranno eliminati per sempre.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDaEliminare(false)}>Annulla</button>
          <button
            className="btn-danger"
            onClick={async () => {
              const { error } = await supabase.from('tickets').delete().eq('id', t.id)
              setDaEliminare(false)
              if (error) return setErroreAzione(messaggioErrore(error))
              ticketCambiati()
              navigate('/area/ticket')
            }}
          >
            Elimina
          </button>
        </div>
      </Modale>
    </div>
  )
}
