import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { Avatar } from '../../../components/Avatar'
import { Icon } from '../../../components/Icon'
import { Caricamento, IntestazionePagina, MessaggioErrore, MessaggioSuccesso, Modale, Spinner, Vuoto } from '../../../components/ui'
import { formatEuro, formatPercentuale, parseNumero } from '../../../lib/format'
import { messaggioErrore, supabase } from '../../../lib/supabase'
import type { Guadagno, Profilo, Ruolo } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

interface FormCollab {
  nome: string
  email: string
  ruolo: Ruolo
  percentuale_default: string
  attivo: boolean
  password: string
}

const VUOTO: FormCollab = { nome: '', email: '', ruolo: 'collaboratore', percentuale_default: '0', attivo: true, password: '' }

export default function AdminCollaboratori() {
  const { profilo: io } = useAuth()
  const [modale, setModale] = useState<'nuovo' | Profilo | null>(null)
  const [form, setForm] = useState<FormCollab>(VUOTO)
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [successo, setSuccesso] = useState<string | null>(null)

  const { dati, caricamento, errore: erroreCaricamento, ricarica } = useQuery(async () => {
    const [profili, guadagni] = await Promise.all([
      esegui<Profilo[]>(supabase.from('profiles').select('*').order('ruolo').order('nome')),
      esegui<Guadagno[]>(supabase.from('v_guadagni').select('collaboratore_id, guadagno, pagato, residuo, progetto_id')),
    ])
    return { profili, guadagni }
  })

  const totali = useMemo(() => {
    const m = new Map<string, { guadagno: number; pagato: number; residuo: number; progetti: number }>()
    for (const g of dati?.guadagni ?? []) {
      const t = m.get(g.collaboratore_id) ?? { guadagno: 0, pagato: 0, residuo: 0, progetti: 0 }
      t.guadagno += Number(g.guadagno)
      t.pagato += Number(g.pagato)
      t.residuo += Number(g.residuo)
      t.progetti += 1
      m.set(g.collaboratore_id, t)
    }
    return m
  }, [dati])

  function apriNuovo() {
    setErrore(null)
    setForm(VUOTO)
    setModale('nuovo')
  }

  function apriModifica(p: Profilo) {
    setErrore(null)
    setForm({ nome: p.nome, email: p.email, ruolo: p.ruolo, percentuale_default: String(p.percentuale_default), attivo: p.attivo, password: '' })
    setModale(p)
  }

  async function salva(e: FormEvent) {
    e.preventDefault()
    setErrore(null)
    setSuccesso(null)
    const perc = parseNumero(form.percentuale_default)
    if (!form.nome.trim()) return setErrore('Il nome è obbligatorio.')
    if (!Number.isFinite(perc) || perc < 0 || perc > 100) return setErrore('La percentuale deve essere tra 0 e 100.')
    if ((modale === 'nuovo' || form.password) && form.password.length < 8) {
      return setErrore('La password deve contenere almeno 8 caratteri.')
    }

    setSalvataggio(true)
    try {
      if (modale === 'nuovo') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) throw new Error('Email non valida.')
        // Funzione SQL admin_crea_account (supabase/account.sql): crea l'utente già confermato
        await esegui(
          supabase.rpc('admin_crea_account', {
            p_nome: form.nome.trim(),
            p_email: form.email.trim(),
            p_password: form.password,
            p_ruolo: form.ruolo,
            p_percentuale: perc,
          }),
        )
        setSuccesso(`Account creato: ${form.email.trim()} può già accedere con la password che hai scelto.`)
      } else if (modale) {
        if (modale.id === io?.id && (form.ruolo !== 'admin' || !form.attivo)) {
          throw new Error('Non puoi togliere a te stesso il ruolo di admin o disattivare il tuo account.')
        }
        await esegui(
          supabase
            .from('profiles')
            .update({ nome: form.nome.trim(), ruolo: form.ruolo, percentuale_default: perc, attivo: form.attivo })
            .eq('id', modale.id),
        )
        if (form.password) {
          await esegui(supabase.rpc('admin_imposta_password', { p_user_id: modale.id, p_password: form.password }))
        }
        setSuccesso(form.password ? 'Account aggiornato e password cambiata.' : 'Account aggiornato.')
      }
      setModale(null)
      ricarica()
    } catch (err) {
      setErrore(messaggioErrore(err))
    } finally {
      setSalvataggio(false)
    }
  }

  async function toggleAttivo(p: Profilo) {
    setErrore(null)
    setSuccesso(null)
    if (p.id === io?.id) return setErrore('Non puoi disattivare il tuo account.')
    const { error } = await supabase.from('profiles').update({ attivo: !p.attivo }).eq('id', p.id)
    if (error) return setErrore(messaggioErrore(error))
    setSuccesso(p.attivo ? `${p.nome} è stato disattivato: non potrà più accedere ai dati.` : `${p.nome} è di nuovo attivo.`)
    ricarica()
  }

  return (
    <>
      <IntestazionePagina
        titolo="Collaboratori"
        sottotitolo="Crea account, imposta le percentuali e guarda cosa vede ogni collaboratore."
        azioni={
          <button className="btn-primary" onClick={apriNuovo}>
            <Icon name="plus" className="h-4 w-4" /> Nuovo account
          </button>
        }
      />

      <div className="mb-4 space-y-3">
        {successo && <MessaggioSuccesso>{successo}</MessaggioSuccesso>}
        {errore && !modale && <MessaggioErrore>{errore}</MessaggioErrore>}
      </div>

      {caricamento ? (
        <Caricamento />
      ) : erroreCaricamento ? (
        <MessaggioErrore onRiprova={ricarica}>{erroreCaricamento}</MessaggioErrore>
      ) : !dati?.profili.length ? (
        <div className="card"><Vuoto icona="users" titolo="Nessun account" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dati.profili.map((p) => {
            const t = totali.get(p.id) ?? { guadagno: 0, pagato: 0, residuo: 0, progetti: 0 }
            return (
              <div key={p.id} className={`card flex flex-col p-5 ${p.attivo ? '' : 'opacity-70'}`}>
                <div className="flex items-start gap-3">
                  <Avatar nome={p.nome} url={p.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{p.nome}</p>
                    <p className="truncate text-sm text-slate-500">{p.email}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.ruolo === 'admin' ? 'bg-slate-900 text-white' : 'bg-brand-50 text-brand-700'}`}>
                        {p.ruolo === 'admin' ? 'Admin' : 'Collaboratore'}
                      </span>
                      {!p.attivo && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Disattivato</span>}
                    </div>
                  </div>
                  <button className="btn-ghost -mt-1 -mr-2 p-2" onClick={() => apriModifica(p)} aria-label={`Modifica ${p.nome}`}>
                    <Icon name="edit" className="h-4 w-4" />
                  </button>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">% predefinita</dt>
                    <dd className="font-semibold tabular-nums">{formatPercentuale(p.percentuale_default)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Progetti</dt>
                    <dd className="font-semibold tabular-nums">{t.progetti}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Guadagnato</dt>
                    <dd className="font-semibold tabular-nums">{formatEuro(t.guadagno)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Da pagare</dt>
                    <dd className={`font-semibold tabular-nums ${t.residuo > 0 ? 'text-amber-700' : ''}`}>{formatEuro(t.residuo)}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/area/admin/collaboratori/${p.id}`} className="btn-secondary flex-1 py-2">
                    <Icon name="eye" className="h-4 w-4" /> Vista come {p.nome.split(' ')[0]}
                  </Link>
                  {p.id !== io?.id && (
                    <button className="btn-ghost py-2" onClick={() => toggleAttivo(p)}>
                      <Icon name={p.attivo ? 'ban' : 'check'} className="h-4 w-4" /> {p.attivo ? 'Disattiva' : 'Riattiva'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modale aperta={modale !== null} titolo={modale === 'nuovo' ? 'Nuovo account' : 'Modifica account'} onChiudi={() => setModale(null)}>
        <form onSubmit={salva} className="space-y-4">
          {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
          <div>
            <label className="label" htmlFor="cn">Nome</label>
            <input id="cn" className="input" required value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="ce">Email</label>
            <input id="ce" type="email" className="input" required autoComplete="off" disabled={modale !== 'nuovo'} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            {modale === 'nuovo' && <p className="mt-1 text-xs text-slate-500">Serve per accedere. Non viene inviata nessuna email.</p>}
          </div>
          <div>
            <label className="label" htmlFor="cpw">{modale === 'nuovo' ? 'Password' : 'Nuova password'}</label>
            <input
              id="cpw"
              type="text"
              className="input"
              autoComplete="new-password"
              minLength={8}
              required={modale === 'nuovo'}
              placeholder={modale === 'nuovo' ? 'Almeno 8 caratteri' : 'Lascia vuoto per non cambiarla'}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="cr">Ruolo</label>
              <select id="cr" className="input" value={form.ruolo} onChange={(e) => setForm((f) => ({ ...f, ruolo: e.target.value as Ruolo }))}>
                <option value="collaboratore">Collaboratore</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="cp">% predefinita</label>
              <input id="cp" inputMode="decimal" className="input" value={form.percentuale_default} onChange={(e) => setForm((f) => ({ ...f, percentuale_default: e.target.value }))} />
            </div>
          </div>
          {modale !== 'nuovo' && (
            <label className="flex items-center gap-3">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.attivo} onChange={(e) => setForm((f) => ({ ...f, attivo: e.target.checked }))} />
              <span className="text-sm font-medium text-slate-700">Account attivo</span>
            </label>
          )}
          {modale === 'nuovo' && (
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              <strong>Admin</strong> vede e gestisce tutto. <strong>Collaboratore</strong> vede solo i progetti a cui lo assegni, i suoi guadagni e i pagamenti ricevuti.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModale(null)}>Annulla</button>
            <button type="submit" className="btn-primary" disabled={salvataggio}>
              {salvataggio && <Spinner className="h-4 w-4" />} {modale === 'nuovo' ? 'Crea account' : 'Salva'}
            </button>
          </div>
        </form>
      </Modale>
    </>
  )
}
