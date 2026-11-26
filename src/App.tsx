import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { RedirectRuolo, RichiedeAdmin, RichiedeCliente, RichiedeLogin, RichiedeStaff } from './auth/guards'
import { AreaLayout } from './components/AreaLayout'
import { PublicLayout } from './components/PublicLayout'
import { Caricamento } from './components/ui'
import Home from './pages/public/Home'

// Parte pubblica secondaria e area riservata caricate su richiesta
const Portfolio = lazy(() => import('./pages/public/Portfolio'))
const ProgettoDettaglio = lazy(() => import('./pages/public/ProgettoDettaglio'))
const SitoSuMisura = lazy(() => import('./pages/public/SitoSuMisura'))
const Ordine = lazy(() => import('./pages/public/Ordine'))
const Offerte = lazy(() => import('./pages/public/Offerte'))
const NotFound = lazy(() => import('./pages/public/NotFound'))
const Login = lazy(() => import('./pages/auth/Login'))
const PasswordDimenticata = lazy(() => import('./pages/auth/PasswordDimenticata'))
const ReimpostaPassword = lazy(() => import('./pages/auth/ReimpostaPassword'))
const Dashboard = lazy(() => import('./pages/area/collaboratore/Dashboard'))
const DettaglioAssegnazione = lazy(() => import('./pages/area/collaboratore/DettaglioAssegnazione'))
const Vendite = lazy(() => import('./pages/area/collaboratore/Vendite'))
const NuovaVendita = lazy(() => import('./pages/area/collaboratore/NuovaVendita'))
const Opportunita = lazy(() => import('./pages/area/collaboratore/Opportunita'))
const Prezzi = lazy(() => import('./pages/area/Prezzi'))
const Profilo = lazy(() => import('./pages/area/Profilo'))
const AdminRiepilogo = lazy(() => import('./pages/area/admin/AdminRiepilogo'))
const AdminProgetti = lazy(() => import('./pages/area/admin/AdminProgetti'))
const AdminProgettoForm = lazy(() => import('./pages/area/admin/AdminProgettoForm'))
const AdminPagamenti = lazy(() => import('./pages/area/admin/AdminPagamenti'))
const AdminCollaboratori = lazy(() => import('./pages/area/admin/AdminCollaboratori'))
const AdminVendite = lazy(() => import('./pages/area/admin/AdminVendite'))
const AdminPreventivi = lazy(() => import('./pages/area/admin/AdminPreventivi'))
const AdminOpportunita = lazy(() => import('./pages/area/admin/AdminOpportunita'))
const Assistenza = lazy(() => import('./pages/public/Assistenza'))
const Ticket = lazy(() => import('./pages/area/Ticket'))
const AdminClienti = lazy(() => import('./pages/area/admin/AdminClienti'))
const AdminCliente = lazy(() => import('./pages/area/admin/AdminCliente'))
const AdminRecensioni = lazy(() => import('./pages/area/admin/AdminRecensioni'))
const AreaCliente = lazy(() => import('./pages/area/cliente/AreaCliente'))
const AdminVistaCome = lazy(() => import('./pages/area/admin/AdminVistaCome'))
const AdminVistaComeDettaglio = lazy(() =>
  import('./pages/area/admin/AdminVistaCome').then((m) => ({ default: m.AdminVistaComeDettaglio })),
)

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Caricamento pieno />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<Home />} />
              <Route path="portfolio" element={<Portfolio />} />
              <Route path="portfolio/:id" element={<ProgettoDettaglio />} />
              {/* Il listino prezzi è solo per chi ha un account: dal pannello (Area riservata → Prezzi) */}
              <Route path="prezzi" element={<Navigate to="/area/prezzi" replace />} />
              <Route path="preventivo" element={<SitoSuMisura key="standard" />} />
              <Route path="offerte" element={<Offerte />} />
              <Route path="prova-un-mese" element={<SitoSuMisura key="prova" modo="prova" />} />
              {/* Vecchi indirizzi: restano validi per i link già condivisi */}
              <Route path="sito-su-misura" element={<Navigate to="/preventivo" replace />} />
              <Route path="acquista-sito-su-misura" element={<Navigate to="/preventivo" replace />} />
              <Route path="ordine/:token" element={<Ordine />} />
              <Route path="assistenza/:token" element={<Assistenza />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route path="login" element={<Login />} />
            <Route path="password-dimenticata" element={<PasswordDimenticata />} />
            <Route path="reimposta-password" element={<ReimpostaPassword />} />

            <Route path="area" element={<RichiedeLogin />}>
              <Route element={<AreaLayout />}>
                <Route index element={<RedirectRuolo />} />
                <Route element={<RichiedeStaff />}>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="dashboard/:assegnazioneId" element={<DettaglioAssegnazione />} />
                  <Route path="vendite" element={<Vendite />} />
                  <Route path="vendite/nuova" element={<NuovaVendita />} />
                  <Route path="opportunita" element={<Opportunita />} />
                  <Route path="prezzi" element={<Prezzi />} />
                </Route>
                <Route element={<RichiedeCliente />}>
                  <Route path="cliente" element={<AreaCliente />} />
                </Route>
                <Route path="ticket" element={<Ticket />} />
                <Route path="ticket/:id" element={<Ticket />} />
                <Route path="profilo" element={<Profilo />} />

                <Route path="admin" element={<RichiedeAdmin />}>
                  <Route index element={<AdminRiepilogo />} />
                  <Route path="progetti" element={<AdminProgetti />} />
                  <Route path="progetti/nuovo" element={<AdminProgettoForm />} />
                  <Route path="progetti/:id" element={<AdminProgettoForm />} />
                  <Route path="preventivi" element={<AdminPreventivi />} />
                  <Route path="pagamenti" element={<AdminPagamenti />} />
                  <Route path="vendite" element={<AdminVendite />} />
                  <Route path="opportunita" element={<AdminOpportunita />} />
                  <Route path="clienti" element={<AdminClienti />} />
                  <Route path="clienti/:id" element={<AdminCliente />} />
                  <Route path="recensioni" element={<AdminRecensioni />} />
                  <Route path="collaboratori" element={<AdminCollaboratori />} />
                  <Route path="collaboratori/:id" element={<AdminVistaCome />} />
                  <Route path="collaboratori/:id/progetti/:assegnazioneId" element={<AdminVistaComeDettaglio />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
