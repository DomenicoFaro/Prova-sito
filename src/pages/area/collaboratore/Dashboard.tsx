import { Link } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { Icon } from '../../../components/Icon'
import { ScaricaModello } from '../../../components/ScaricaModello'
import { IntestazionePagina } from '../../../components/ui'
import { DashboardCollaboratoreView } from './DashboardCollaboratore'

export default function Dashboard() {
  const { profilo } = useAuth()
  if (!profilo) return null
  return (
    <>
      <IntestazionePagina
        titolo={`Ciao ${profilo.nome.split(' ')[0]} 👋`}
        sottotitolo="Ecco i tuoi progetti e i tuoi guadagni."
        azioni={
          <>
            <ScaricaModello />
            <Link to="/area/vendite/nuova" className="btn-primary">
              <Icon name="handshake" className="h-4 w-4" /> Sito venduto
            </Link>
          </>
        }
      />
      <DashboardCollaboratoreView collaboratoreId={profilo.id} linkDettaglio={(id) => `/area/dashboard/${id}`} />
    </>
  )
}
