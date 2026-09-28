import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Caricamento } from '../components/ui'
import { useAuth } from './AuthProvider'

/** Richiede un utente loggato e attivo; altrimenti rimanda al login. */
export function RichiedeLogin() {
  const { session, profilo, caricamento } = useAuth()
  const location = useLocation()

  if (caricamento) return <Caricamento pieno testo="Verifica dell'accesso…" />
  if (!session || !profilo || !profilo.attivo) {
    return <Navigate to="/login" replace state={{ da: location.pathname + location.search }} />
  }
  return <Outlet />
}

/** Solo admin: un collaboratore viene rimandato alla sua dashboard. */
export function RichiedeAdmin() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/area/dashboard" replace />
  return <Outlet />
}

/** Reindirizza /area alla dashboard giusta in base al ruolo. */
export function RedirectRuolo() {
  const { isAdmin } = useAuth()
  return <Navigate to={isAdmin ? '/area/admin' : '/area/dashboard'} replace />
}
