import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { Seo } from '../../components/Seo'
import { Caricamento, MessaggioErrore, Spinner } from '../../components/ui'
import { messaggioErrore, supabase, supabaseConfigurato } from '../../lib/supabase'
import { AuthCard } from './AuthCard'

export default function Login() {
  const { session, profilo, caricamento, esci } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const da = (location.state as { da?: string } | null)?.da

  if (caricamento) return <Caricamento pieno />
  if (session && profilo?.attivo) return <Navigate to={da && da.startsWith('/area') ? da : '/area'} replace />

  async function accedi(e: FormEvent) {
    e.preventDefault()
    setErrore(null)
    setInvio(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setInvio(false)
    if (error) setErrore(messaggioErrore(error))
  }

  const disattivato = session && profilo && !profilo.attivo
  const senzaProfilo = session && !profilo

  return (
    <AuthCard titolo="Area riservata" sottotitolo="Accedi con le credenziali ricevute dall'agenzia.">
      <Seo titolo="Accedi" noindex />
      {!supabaseConfigurato && (
        <div className="mb-4">
          <MessaggioErrore>Supabase non è configurato: imposta le variabili VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</MessaggioErrore>
        </div>
      )}
      {(disattivato || senzaProfilo) && (
        <div className="mb-4">
          <MessaggioErrore>
            {disattivato ? 'Il tuo account è stato disattivato. Contatta l’amministratore.' : 'Profilo non trovato per questo account.'}{' '}
            <button className="font-semibold underline" onClick={esci}>Esci</button>
          </MessaggioErrore>
        </div>
      )}
      <form onSubmit={accedi} className="space-y-4">
        {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="label">Password</label>
            <Link to="/password-dimenticata" className="mb-1.5 text-sm font-semibold text-brand-700 hover:underline">
              Password dimenticata?
            </Link>
          </div>
          <input id="password" type="password" className="input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary w-full py-3" disabled={invio}>
          {invio && <Spinner className="h-4 w-4" />} {invio ? 'Accesso in corso…' : 'Accedi'}
        </button>
        <p className="text-center text-xs text-slate-500">Gli account vengono creati solo dall'amministratore.</p>
      </form>
    </AuthCard>
  )
}
