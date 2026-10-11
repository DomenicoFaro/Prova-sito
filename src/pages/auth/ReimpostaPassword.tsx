import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { Seo } from '../../components/Seo'
import { Caricamento, MessaggioErrore, Spinner } from '../../components/ui'
import { messaggioErrore, supabase } from '../../lib/supabase'
import { AuthCard } from './AuthCard'

/** Usata sia per il reset della password sia per il primo accesso da invito. */
export default function ReimpostaPassword() {
  const { session, caricamento } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [conferma, setConferma] = useState('')
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  if (caricamento) return <Caricamento pieno />

  async function salva(e: FormEvent) {
    e.preventDefault()
    setErrore(null)
    if (password.length < 8) return setErrore('La password deve contenere almeno 8 caratteri.')
    if (password !== conferma) return setErrore('Le due password non coincidono.')
    setInvio(true)
    const { error } = await supabase.auth.updateUser({ password })
    setInvio(false)
    if (error) return setErrore(messaggioErrore(error))
    navigate('/area', { replace: true })
  }

  return (
    <AuthCard titolo="Imposta la password" sottotitolo="Scegli una nuova password per accedere all'area riservata.">
      <Seo titolo="Imposta la password" />
      {!session ? (
        <div className="space-y-4">
          <MessaggioErrore>Il link non è valido o è scaduto. Richiedine uno nuovo.</MessaggioErrore>
          <Link to="/password-dimenticata" className="btn-secondary w-full">Richiedi un nuovo link</Link>
        </div>
      ) : (
        <form onSubmit={salva} className="space-y-4">
          {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
          <p className="text-sm text-slate-500">Account: <strong className="text-slate-800">{session.user.email}</strong></p>
          <div>
            <label htmlFor="pw" className="label">Nuova password</label>
            <input id="pw" type="password" className="input" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pw2" className="label">Conferma password</label>
            <input id="pw2" type="password" className="input" autoComplete="new-password" minLength={8} required value={conferma} onChange={(e) => setConferma(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary w-full py-3" disabled={invio}>
            {invio && <Spinner className="h-4 w-4" />} Salva password
          </button>
        </form>
      )}
    </AuthCard>
  )
}
