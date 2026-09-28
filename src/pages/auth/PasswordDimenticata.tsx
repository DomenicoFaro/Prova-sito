import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Seo } from '../../components/Seo'
import { MessaggioErrore, MessaggioSuccesso, Spinner } from '../../components/ui'
import { messaggioErrore, supabase } from '../../lib/supabase'
import { AuthCard } from './AuthCard'

export default function PasswordDimenticata() {
  const [email, setEmail] = useState('')
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [inviata, setInviata] = useState(false)

  async function invia(e: FormEvent) {
    e.preventDefault()
    setErrore(null)
    setInvio(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reimposta-password`,
    })
    setInvio(false)
    if (error) setErrore(messaggioErrore(error))
    else setInviata(true)
  }

  return (
    <AuthCard titolo="Password dimenticata" sottotitolo="Ti invieremo un link per impostarne una nuova.">
      <Seo titolo="Password dimenticata" noindex />
      {inviata ? (
        <div className="space-y-4">
          <MessaggioSuccesso>
            Se l'indirizzo è registrato riceverai a breve un'email con il link per reimpostare la password. Controlla anche lo spam.
          </MessaggioSuccesso>
          <Link to="/login" className="btn-secondary w-full">Torna al login</Link>
        </div>
      ) : (
        <form onSubmit={invia} className="space-y-4">
          {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary w-full py-3" disabled={invio}>
            {invio && <Spinner className="h-4 w-4" />} Invia link
          </button>
          <Link to="/login" className="block text-center text-sm font-semibold text-slate-500 hover:text-slate-900">Torna al login</Link>
        </form>
      )}
    </AuthCard>
  )
}
