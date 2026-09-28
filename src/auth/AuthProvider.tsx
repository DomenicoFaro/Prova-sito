import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profilo } from '../lib/types'

interface AuthContextValue {
  session: Session | null
  profilo: Profilo | null
  /** true finché sessione e profilo non sono stati caricati */
  caricamento: boolean
  errore: string | null
  isAdmin: boolean
  ricaricaProfilo: () => Promise<void>
  esci: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profilo, setProfilo] = useState<Profilo | null>(null)
  const [inizializzato, setInizializzato] = useState(false)
  // id dell'utente per cui il profilo è stato caricato (evita stati intermedi dopo il login)
  const [profiloPer, setProfiloPer] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  const caricaProfilo = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfilo(null)
      setProfiloPer(null)
      return
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) {
      setErrore(error.message)
      setProfilo(null)
    } else {
      setErrore(null)
      setProfilo(data as Profilo | null)
    }
    setProfiloPer(userId)
  }, [])

  useEffect(() => {
    let attivo = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!attivo) return
      setSession(data.session)
      await caricaProfilo(data.session?.user.id)
      if (attivo) setInizializzato(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((evento, nuovaSessione) => {
      setSession(nuovaSessione)
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') {
        // Non si può fare await dentro il callback (deadlock noto di supabase-js)
        setTimeout(() => {
          caricaProfilo(nuovaSessione?.user.id)
        }, 0)
      }
      if (evento === 'PASSWORD_RECOVERY' && !window.location.pathname.startsWith('/reimposta-password')) {
        window.location.assign('/reimposta-password')
      }
    })

    return () => {
      attivo = false
      sub.subscription.unsubscribe()
    }
  }, [caricaProfilo])

  const esci = useCallback(async () => {
    await supabase.auth.signOut()
    setProfilo(null)
    setSession(null)
  }, [])

  const caricamento = !inizializzato || (session !== null && profiloPer !== session.user.id)

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profilo,
      caricamento,
      errore,
      isAdmin: profilo?.ruolo === 'admin' && profilo.attivo,
      ricaricaProfilo: () => caricaProfilo(session?.user.id),
      esci,
    }),
    [session, profilo, caricamento, errore, caricaProfilo, esci],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth va usato dentro <AuthProvider>')
  return ctx
}
