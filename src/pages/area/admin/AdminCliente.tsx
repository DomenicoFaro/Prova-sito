import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Accessi, ValoreSegreto } from '../../../components/Accessi'
import { Icon } from '../../../components/Icon'
import { Caricamento, IntestazionePagina, MessaggioErrore, MessaggioSuccesso, Modale, Spinner, Vuoto } from '../../../components/ui'
import {
  apriCassaforte,
  apriComeAdmin,
  chiaveAdminAperta,
  chiudiCassaforte,
  creaCassaforte,
  creaCassaforteCliente,
  leggiCassaforte,
  leggiCassaforteCliente,
} from '../../../lib/cassaforte'
import { formatData } from '../../../lib/format'
import { messaggioErrore, supabase } from '../../../lib/supabase'
import type { Profilo, SitoCliente } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

export default function AdminCliente() {
  const { id = '' } = useParams()
  const { dati: c, caricamento, errore, ricarica } = useQuery(
    () => esegui<Profilo | null>(supabase.from('profiles').select('*').eq('id', id).maybeSingle()),
    [id],
  )
  const [msg, setMsg] = useState<{ ok: boolean; testo: string } | null>(null)
  const [password, setPassword] = useState<string | null>(null)

  async function cambiaStato() {
    if (!c) return
    const { error } = await supabase.from('profiles').update({ attivo: !c.attivo }).eq('id', c.id)
    setMsg(error ? { ok: false, testo: messaggioErrore(error) } : { ok: true, testo: c.attivo ? 'Account disattivato: il cliente non vede più i suoi dati.' : 'Account riattivato.' })
    ricarica()
  }

  async function cambiaPassword(e: FormEvent) {
    e.preventDefault()
    if ((password ?? '').length < 8) return setMsg({ ok: false, testo: 'La password deve contenere almeno 8 caratteri.' })
    const { error } = await supabase.rpc('admin_imposta_password', { p_user_id: id, p_password: password })
    setMsg(error ? { ok: false, testo: messaggioErrore(error) } : { ok: true, testo: 'Password cambiata.' })
    if (!error) setPassword(null)
  }

  if (caricamento && !c) return <Caricamento />
  if (errore) return <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>
  if (!c || c.ruolo !== 'cliente') {
    return (
      <Vuoto icona="user" titolo="Cliente non trovato">
        <Link to="/area/admin/clienti" className="font-semibold text-brand-700">Torna ai clienti</Link>
      </Vuoto>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/area/admin/clienti" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
          <Icon name="arrowLeft" className="h-4 w-4" /> Clienti
        </Link>
        <IntestazionePagina
          titolo={c.nome}
          sottotitolo={`${c.email}${c.attivo ? '' : ' · account disattivato'}`}
          azioni={
            <>
              <button className="btn-secondary" onClick={() => { setMsg(null); setPassword('') }}>
                <Icon name="lock" className="h-4 w-4" /> Cambia password
              </button>
              <button className="btn-ghost" onClick={cambiaStato}>
                <Icon name={c.attivo ? 'ban' : 'check'} className="h-4 w-4" /> {c.attivo ? 'Disattiva' : 'Riattiva'}
              </button>
            </>
          }
        />
        {msg && (msg.ok ? <MessaggioSuccesso>{msg.testo}</MessaggioSuccesso> : <MessaggioErrore>{msg.testo}</MessaggioErrore>)}
      </div>

      <Siti clienteId={c.id} />
      <CassaforteAdmin clienteId={c.id} />

      <Modale aperta={password !== null} titolo="Nuova password del cliente" onChiudi={() => setPassword(null)}>
        <form onSubmit={cambiaPassword} className="space-y-4">
          {msg && !msg.ok && <MessaggioErrore>{msg.testo}</MessaggioErrore>}
          <div>
            <label className="label" htmlFor="npw">Password (almeno 8 caratteri)</label>
            <input id="npw" className="input" autoComplete="off" value={password ?? ''} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setPassword(null)}>Annulla</button>
            <button type="submit" className="btn-primary">Salva</button>
          </div>
        </form>
      </Modale>
    </div>
  )
}

type FormSito = Pick<SitoCliente, 'nome' | 'url' | 'data_acquisto' | 'note' | 'collaboratore_id'> & { id?: string }

function Siti({ clienteId }: { clienteId: string }) {
  const { dati, caricamento, errore, ricarica } = useQuery(
    () => esegui<SitoCliente[]>(supabase.from('siti_cliente').select('*').eq('cliente_id', clienteId).order('data_acquisto')),
    [clienteId],
  )
  const persone = useQuery(() => esegui<Profilo[]>(supabase.from('profiles').select('*').neq('ruolo', 'cliente').order('nome')))
  const [form, setForm] = useState<FormSito | null>(null)
  const [daEliminare, setDaEliminare] = useState<SitoCliente | null>(null)
  const [salvataggio, setSalvataggio] = useState(false)
  const [erroreForm, setErroreForm] = useState<string | null>(null)

  async function salva(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    let url = form.url.trim()
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`
    if (!form.nome.trim()) return setErroreForm('Inserisci il nome del sito.')
    setSalvataggio(true)
    const valori = { nome: form.nome.trim(), url, data_acquisto: form.data_acquisto, note: form.note.trim(), collaboratore_id: form.collaboratore_id || null }
    const { error } = form.id
      ? await supabase.from('siti_cliente').update(valori).eq('id', form.id)
      : await supabase.from('siti_cliente').insert({ ...valori, cliente_id: clienteId })
    setSalvataggio(false)
    if (error) return setErroreForm(messaggioErrore(error))
    setForm(null)
    ricarica()
  }

  async function elimina() {
    if (!daEliminare) return
    const { error } = await supabase.from('siti_cliente').delete().eq('id', daEliminare.id)
    setDaEliminare(null)
    if (error) return setErroreForm(messaggioErrore(error))
    ricarica()
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Siti acquistati</h2>
        <button
          className="btn-primary"
          onClick={() => { setErroreForm(null); setForm({ nome: '', url: '', data_acquisto: new Date().toISOString().slice(0, 10), note: '', collaboratore_id: null }) }}
        >
          <Icon name="plus" className="h-4 w-4" /> Aggiungi sito
        </button>
      </div>
      {caricamento && !dati ? (
        <Caricamento />
      ) : errore ? (
        <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>
      ) : !dati?.length ? (
        <div className="card"><Vuoto icona="globe" titolo="Nessun sito">Finché non ne aggiungi uno, il cliente non può lasciare la recensione.</Vuoto></div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {dati.map((s) => (
            <li key={s.id} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold break-words text-slate-900">{s.nome}</p>
                  {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm break-all text-brand-700 hover:underline">{s.url}</a>}
                  <p className="mt-1 text-xs text-slate-500">
                    Acquistato il {formatData(s.data_acquisto)} · Lo segue: {persone.dati?.find((p) => p.id === s.collaboratore_id)?.nome ?? 'solo tu'}
                  </p>
                </div>
                <div className="flex shrink-0">
                  <button className="btn-ghost p-2" onClick={() => { setErroreForm(null); setForm(s) }} aria-label={`Modifica ${s.nome}`}><Icon name="edit" className="h-4 w-4" /></button>
                  <button className="btn-ghost p-2 text-red-600" onClick={() => setDaEliminare(s)} aria-label={`Elimina ${s.nome}`}><Icon name="trash" className="h-4 w-4" /></button>
                </div>
              </div>
              {s.note && <p className="mt-3 text-sm break-words whitespace-pre-line text-slate-600">{s.note}</p>}
            </li>
          ))}
        </ul>
      )}

      <Modale aperta={!!form} titolo={form?.id ? 'Modifica sito' : 'Nuovo sito'} onChiudi={() => setForm(null)}>
        {form && (
          <form onSubmit={salva} className="space-y-4">
            {erroreForm && <MessaggioErrore>{erroreForm}</MessaggioErrore>}
            <div>
              <label className="label" htmlFor="sn">Nome del sito o dell'attività</label>
              <input id="sn" className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="su">Indirizzo del sito</label>
              <input id="su" className="input" placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="sd">Data di acquisto</label>
              <input id="sd" type="date" required className="input" value={form.data_acquisto} onChange={(e) => setForm({ ...form, data_acquisto: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="scoll">Collaboratore che lo segue</label>
              <select id="scoll" className="input" value={form.collaboratore_id ?? ''} onChange={(e) => setForm({ ...form, collaboratore_id: e.target.value || null })}>
                <option value="">Nessuno (solo io)</option>
                {(persone.dati ?? []).filter((p) => p.attivo || p.id === form.collaboratore_id).map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">Riceve la notifica e può rispondere ai ticket del cliente per questo sito.</p>
            </div>
            <div>
              <label className="label" htmlFor="so">Note <span className="font-normal text-slate-400">(il cliente le vede: niente password qui)</span></label>
              <textarea id="so" rows={3} className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setForm(null)}>Annulla</button>
              <button type="submit" className="btn-primary" disabled={salvataggio}>{salvataggio && <Spinner className="h-4 w-4" />} Salva</button>
            </div>
          </form>
        )}
      </Modale>

      <Modale aperta={!!daEliminare} titolo="Eliminare il sito?" onChiudi={() => setDaEliminare(null)}>
        <p className="text-sm text-slate-600"><strong>{daEliminare?.nome}</strong> verrà tolto dall'account del cliente.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDaEliminare(null)}>Annulla</button>
          <button className="btn-danger" onClick={elimina}>Elimina</button>
        </div>
      </Modale>
    </section>
  )
}

/** Password principale → cassaforte del cliente → accessi. */
function CassaforteAdmin({ clienteId }: { clienteId: string }) {
  const [chiave, setChiave] = useState(chiaveAdminAperta)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [lavoro, setLavoro] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const base = useQuery(leggiCassaforte)
  const cliente = useQuery(async () => {
    const riga = await leggiCassaforteCliente(clienteId)
    return { riga, aperta: riga && chiave ? await apriComeAdmin(riga, chiave) : null }
  }, [clienteId, chiave])

  async function prova(azione: () => Promise<void>) {
    setErrore(null)
    setLavoro(true)
    try {
      await azione()
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setLavoro(false)
    }
  }

  function sblocca(e: FormEvent) {
    e.preventDefault()
    const nuova = !base.dati
    if (nuova && pw.length < 10) return setErrore('La password principale deve avere almeno 10 caratteri.')
    if (nuova && pw !== pw2) return setErrore('Le due password non coincidono.')
    prova(async () => {
      setChiave(nuova ? await creaCassaforte(pw) : await apriCassaforte(pw, base.dati!))
      setPw('')
      setPw2('')
      if (nuova) base.ricarica()
    })
  }

  const erroreCaricamento = base.errore ?? cliente.errore

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Accessi del sito (cassaforte)</h2>
        {chiave && (
          <button className="btn-secondary" onClick={() => { chiudiCassaforte(); setChiave(null) }}>
            <Icon name="lock" className="h-4 w-4" /> Blocca
          </button>
        )}
      </div>
      {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
      {erroreCaricamento ? (
        <MessaggioErrore onRiprova={() => { base.ricarica(); cliente.ricarica() }}>{erroreCaricamento}</MessaggioErrore>
      ) : base.caricamento || (cliente.caricamento && !cliente.dati) ? (
        <Caricamento />
      ) : !chiave ? (
        <form onSubmit={sblocca} className="card max-w-lg space-y-4 p-5 sm:p-6">
          {base.dati ? (
            <p className="text-sm text-slate-600">Scrivi la password principale per aprire la cassaforte.</p>
          ) : (
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              <strong>Crea la password principale.</strong> La conosci solo tu e protegge gli accessi di tutti i clienti. Non viene salvata da nessuna parte: <strong>se la dimentichi non si può recuperare</strong>. Scrivila in un posto sicuro.
            </div>
          )}
          <div>
            <label className="label" htmlFor="mp">Password principale</label>
            <input id="mp" type="password" className="input" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          {!base.dati && (
            <div>
              <label className="label" htmlFor="mp2">Ripetila</label>
              <input id="mp2" type="password" className="input" autoComplete="off" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
          )}
          <button className="btn-primary" disabled={lavoro || !pw}>
            {lavoro ? <Spinner className="h-4 w-4" /> : <Icon name="lock" className="h-4 w-4" />} {base.dati ? 'Apri la cassaforte' : 'Crea la cassaforte'}
          </button>
        </form>
      ) : !cliente.dati?.riga ? (
        <div className="card max-w-lg space-y-4 p-5 sm:p-6">
          <p className="text-sm text-slate-600">Questo cliente non ha ancora la sua cassaforte. Attivandola viene creato il codice con cui potrà leggere i propri accessi.</p>
          <button className="btn-primary" disabled={lavoro} onClick={() => prova(async () => { await creaCassaforteCliente(clienteId, chiave); cliente.ricarica() })}>
            {lavoro ? <Spinner className="h-4 w-4" /> : <Icon name="plus" className="h-4 w-4" />} Attiva per questo cliente
          </button>
        </div>
      ) : cliente.dati.aperta ? (
        <>
          <div className="card max-w-lg p-5">
            <dl>
              <ValoreSegreto etichetta="Codice del cliente" valore={cliente.dati.aperta.codice} nascosto />
            </dl>
            <p className="mt-2 text-xs text-slate-500">Consegnalo al cliente: gli serve, dopo l'accesso, per leggere email e password del suo sito.</p>
          </div>
          <Accessi clienteId={clienteId} chiave={cliente.dati.aperta.chiave} modificabile />
        </>
      ) : (
        <Caricamento />
      )}
    </section>
  )
}
