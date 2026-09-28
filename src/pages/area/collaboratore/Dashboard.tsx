import { useAuth } from '../../../auth/AuthProvider'
import { IntestazionePagina } from '../../../components/ui'
import { DashboardCollaboratoreView } from './DashboardCollaboratore'

export default function Dashboard() {
  const { profilo } = useAuth()
  if (!profilo) return null
  return (
    <>
      <IntestazionePagina titolo={`Ciao ${profilo.nome.split(' ')[0]} 👋`} sottotitolo="Ecco i tuoi progetti e i tuoi guadagni." />
      <DashboardCollaboratoreView collaboratoreId={profilo.id} linkDettaglio={(id) => `/area/dashboard/${id}`} />
    </>
  )
}
