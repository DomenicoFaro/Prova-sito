import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../../../components/Avatar'
import { Icon } from '../../../components/Icon'
import { Caricamento, MessaggioErrore } from '../../../components/ui'
import { supabase } from '../../../lib/supabase'
import type { Profilo } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'
import { DashboardCollaboratoreView } from '../collaboratore/DashboardCollaboratore'
import { DettaglioAssegnazioneView } from '../collaboratore/DettaglioAssegnazione'

function useCollaboratore(id: string) {
  return useQuery(() => esegui<Profilo | null>(supabase.from('profiles').select('*').eq('id', id).maybeSingle()), [id])
}

function Banner({ p }: { p: Profilo }) {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-3">
        <Avatar nome={p.nome} url={p.avatar_url} />
        <div>
          <p className="text-sm font-semibold text-amber-900">
            <Icon name="eye" className="mr-1 inline h-4 w-4" /> Stai vedendo l'area riservata come <strong>{p.nome}</strong>
          </p>
          <p className="text-xs text-amber-800">Sono gli stessi dati, in sola lettura, che vede il collaboratore.</p>
        </div>
      </div>
      <Link to="/area/admin/collaboratori" className="btn-secondary py-2">Esci dalla vista</Link>
    </div>
  )
}

export default function AdminVistaCome() {
  const { id = '' } = useParams()
  const { dati: p, caricamento, errore, ricarica } = useCollaboratore(id)

  if (caricamento) return <Caricamento />
  if (errore) return <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>
  if (!p) return <MessaggioErrore>Collaboratore non trovato.</MessaggioErrore>

  return (
    <>
      <Banner p={p} />
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Ciao {p.nome.split(' ')[0]} 👋</h1>
      <p className="mb-6 text-sm text-slate-500">Ecco i tuoi progetti e i tuoi guadagni.</p>
      <DashboardCollaboratoreView collaboratoreId={p.id} linkDettaglio={(aid) => `/area/admin/collaboratori/${p.id}/progetti/${aid}`} />
    </>
  )
}

export function AdminVistaComeDettaglio() {
  const { id = '', assegnazioneId = '' } = useParams()
  const { dati: p, caricamento } = useCollaboratore(id)
  if (caricamento) return <Caricamento />
  return (
    <>
      {p && <Banner p={p} />}
      <DettaglioAssegnazioneView assegnazioneId={assegnazioneId} linkIndietro={`/area/admin/collaboratori/${id}`} />
    </>
  )
}
