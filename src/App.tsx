import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { RedirectRuolo, RichiedeGestore, RichiedeLogin } from './auth/guards'
import { AreaLayout } from './components/AreaLayout'
import { PublicLayout } from './components/PublicLayout'
import { Caricamento } from './components/ui'
import Home from './pages/public/Home'

// Parte pubblica secondaria e area riservata caricate su richiesta
const Portfolio = lazy(() => import('./pages/public/Portfolio'))
const ProgettoDettaglio = lazy(() => import('./pages/public/ProgettoDettaglio'))
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
const AdminOpportunita = lazy(() => import('./pages/area/admin/AdminOpportunita'))
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
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route path="login" element={<Login />} />
            <Route path="password-dimenticata" element={<PasswordDimenticata />} />
            <Route path="reimposta-password" element={<ReimpostaPassword />} />

            <Route path="area" element={<RichiedeLogin />}>
              <Route element={<AreaLayout />}>
                <Route index element={<RedirectRuolo />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="dashboard/:assegnazioneId" element={<DettaglioAssegnazione />} />
                <Route path="vendite" element={<Vendite />} />
                <Route path="vendite/nuova" element={<NuovaVendita />} />
                <Route path="opportunita" element={<Opportunita />} />
                <Route path="prezzi" element={<Prezzi />} />
                <Route path="profilo" element={<Profilo />} />

                <Route path="admin" element={<RichiedeGestore />}>
                  <Route index element={<AdminRiepilogo />} />
                  <Route path="progetti" element={<AdminProgetti />} />
                  <Route path="progetti/nuovo" element={<AdminProgettoForm />} />
                  <Route path="progetti/:id" element={<AdminProgettoForm />} />
                  <Route path="pagamenti" element={<AdminPagamenti />} />
                  <Route path="vendite" element={<AdminVendite />} />
                  <Route path="opportunita" element={<AdminOpportunita />} />
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
