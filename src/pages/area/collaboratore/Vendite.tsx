import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { AllegatiContratto } from '../../../components/AllegatiContratto'
import { Icon } from '../../../components/Icon'
import { ScaricaModello } from '../../../components/ScaricaModello'
import { BadgeStatoVendita, Caricamento, IntestazionePagina, MessaggioErrore, MessaggioSuccesso, Vuoto } from '../../../components/ui'
import { formatData, formatEuro } from '../../../lib/format'
import { supabase } from '../../../lib/supabase'
import type { Vendita } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

export default function Vendite() {
  const { profilo } = useAuth()
  const location = useLocation()
  const inviata = (location.state as { inviata?: boolean } | null)?.inviata

  const { dati, caricamento, errore, ricarica } = useQuery(
    () =>
      esegui<Vendita[]>(
        supabase.from('vendite').select('*').eq('collaboratore_id', profilo?.id ?? '').order('created_at', { ascending: false }),
      ),
    [profilo?.id],
  )

  return (
    <>
      <IntestazionePagina
        titolo="Le mie vendite"
        sottotitolo="Segnala un sito venduto e carica il contratto firmato dal cliente."
        azioni={
          <>
            <ScaricaModello />
            <Link to="/area/vendite/nuova" className="btn-primary">
              <Icon name="handshake" className="h-4 w-4" /> Sito venduto
            </Link>
          </>
        }
      />

      {inviata && (
        <div className="mb-4">
          <MessaggioSuccesso>Vendita inviata! L'amministratore la controllerà a breve.</MessaggioSuccesso>
        </div>
      )}

      {caricamento ? (
        <Caricamento />
      ) : errore ? (
        <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>
      ) : !dati?.length ? (
        <div className="card">
          <Vuoto icona="handshake" titolo="Nessuna vendita registrata">
            Hai venduto un sito? Premi <strong>Sito venduto</strong> e carica il contratto firmato.
          </Vuoto>
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {dati.map((v) => (
            <li key={v.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{v.sito_nome}</p>
                  <p className="truncate text-sm text-slate-500">
                    {v.cliente_nome}
                    {v.tipo_sito && ` · ${v.tipo_sito}`}
                  </p>
                </div>
                <BadgeStatoVendita stato={v.stato} />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Prezzo</dt>
                  <dd className="font-semibold tabular-nums">{formatEuro(v.prezzo)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Acconto</dt>
                  <dd className="font-semibold tabular-nums">{formatEuro(v.acconto)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Firmato il</dt>
                  <dd className="font-semibold">{formatData(v.data_firma)}</dd>
                </div>
              </dl>
              <div className="mt-4">
                <AllegatiContratto vendita={v} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
