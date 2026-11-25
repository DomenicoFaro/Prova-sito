import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from '../../../components/Avatar'
import { Icon } from '../../../components/Icon'
import { Caricamento, IntestazionePagina, MessaggioErrore, Modale, Spinner, Vuoto } from '../../../components/ui'
import { messaggioErrore, supabase } from '../../../lib/supabase'
import type { Profilo, SitoCliente } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

export default function AdminClienti() {
  const navigate = useNavigate()
  const [form, setForm] = useState<{ nome: string; email: string; password: string } | null>(null)
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const { dati, caricamento, errore: erroreCaricamento, ricarica } = useQuery(async () => {
    const [clienti, siti] = await Promise.all([
      esegui<Profilo[]>(supabase.from('profiles').select('*').eq('ruolo', 'cliente').order('nome')),
      esegui<SitoCliente[]>(supabase.from('siti_cliente').select('*')),
    ])
    return { clienti, siti }
  })

  async function crea(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setErrore(null)
    if (!form.nome.trim()) return setErrore('Il nome è obbligatorio.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setErrore('Email non valida.')
    if (form.password.length < 8) return setErrore('La password deve contenere almeno 8 caratteri.')
    setSalvataggio(true)
    try {
      const id = await esegui<string>(supabase.rpc('admin_crea_cliente', { p_nome: form.nome.trim(), p_email: form.email.trim(), p_password: form.password }))
      navigate(`/area/admin/clienti/${id}`)
    } catch (err) {
      setErrore(messaggioErrore(err))
      setSalvataggio(false)
    }
  }

  const campo = (nome: 'nome' | 'email' | 'password', etichetta: string, tipo = 'text') => (
    <div>
      <label className="label" htmlFor={`cl-${nome}`}>{etichetta}</label>
      <input id={`cl-${nome}`} type={tipo} className="input" autoComplete="off" value={form?.[nome] ?? ''} onChange={(e) => setForm((f) => f && { ...f, [nome]: e.target.value })} />
    </div>
  )

  return (
    <>
      <IntestazionePagina
        titolo="Clienti"
        sottotitolo="Un account per ogni cliente, con i suoi siti e gli accessi. Chi ha un sito registrato può lasciare la recensione."
        azioni={
          <button className="btn-primary" onClick={() => { setErrore(null); setForm({ nome: '', email: '', password: '' }) }}>
            <Icon name="plus" className="h-4 w-4" /> Nuovo cliente
          </button>
        }
      />
      {caricamento ? (
        <Caricamento />
      ) : erroreCaricamento ? (
        <MessaggioErrore onRiprova={ricarica}>{erroreCaricamento}</MessaggioErrore>
      ) : !dati?.clienti.length ? (
        <div className="card"><Vuoto icona="user" titolo="Nessun cliente">Premi «Nuovo cliente» per creare il primo account.</Vuoto></div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dati.clienti.map((c) => {
            const siti = dati.siti.filter((s) => s.cliente_id === c.id)
            return (
              <li key={c.id}>
                <Link to={`/area/admin/clienti/${c.id}`} className={`card flex items-center gap-3 p-5 hover:border-brand-300 ${c.attivo ? '' : 'opacity-70'}`}>
                  <Avatar nome={c.nome} url={c.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{c.nome}</p>
                    <p className="truncate text-sm text-slate-500">{c.email}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-brand-700">
                      {siti.length ? siti.map((s) => s.nome).join(', ') : 'Nessun sito registrato'}
                      {!c.attivo && <span className="ml-2 text-red-700">Disattivato</span>}
                    </p>
                  </div>
                  <Icon name="arrowRight" className="h-4 w-4 shrink-0 text-slate-400" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <Modale aperta={!!form} titolo="Nuovo cliente" onChiudi={() => setForm(null)}>
        <form onSubmit={crea} className="space-y-4">
          {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
          {campo('nome', 'Nome e cognome')}
          {campo('email', 'Email per accedere', 'email')}
          {campo('password', 'Password (almeno 8 caratteri)')}
          <p className="text-xs text-slate-500">Non viene inviata nessuna email: comunica tu al cliente email e password.</p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setForm(null)}>Annulla</button>
            <button type="submit" className="btn-primary" disabled={salvataggio}>
              {salvataggio && <Spinner className="h-4 w-4" />} Crea account
            </button>
          </div>
        </form>
      </Modale>
    </>
  )
}
