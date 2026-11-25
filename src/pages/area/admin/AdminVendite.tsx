import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AllegatiContratto } from '../../../components/AllegatiContratto'
import { Icon } from '../../../components/Icon'
import { ScaricaModello } from '../../../components/ScaricaModello'
import {
  BadgeStatoVendita,
  Caricamento,
  IntestazionePagina,
  MessaggioErrore,
  MessaggioSuccesso,
  Modale,
  Spinner,
  Vuoto,
} from '../../../components/ui'
import { ACCEPT_MODELLO, caricaModello, eliminaFile, trovaModello } from '../../../lib/contratti'
import { ETICHETTE_STATO_VENDITA, formatData, formatDataOra, formatEuro } from '../../../lib/format'
import { messaggioErrore, supabase } from '../../../lib/supabase'
import type { Profilo, StatoVendita, Vendita } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

function Riga({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{etichetta}</dt>
      <dd className="mt-0.5 font-medium break-words text-slate-900">{children || '—'}</dd>
    </div>
  )
}

function urlDaDominio(dominio: string): string | null {
  let url = dominio.trim()
  if (!url) return null
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`
  return /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(url) ? url : null
}

export default function AdminVendite() {
  const navigate = useNavigate()
  const [filtro, setFiltro] = useState<StatoVendita | ''>('in_attesa')
  const [aperta, setAperta] = useState<Vendita | null>(null)
  const [daEliminare, setDaEliminare] = useState<Vendita | null>(null)
  const [azione, setAzione] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [successo, setSuccesso] = useState<string | null>(null)
  const [caricaModelloInCorso, setCaricaModelloInCorso] = useState(false)

  const { dati, caricamento, errore: erroreCaricamento, ricarica } = useQuery(async () => {
    const [vendite, profili, modello] = await Promise.all([
      esegui<Vendita[]>(supabase.from('vendite').select('*').order('created_at', { ascending: false })),
      esegui<Profilo[]>(supabase.from('profiles').select('*')),
      trovaModello().catch(() => null),
    ])
    return { vendite, profili: new Map(profili.map((p) => [p.id, p])), modello }
  })

  const conteggi = useMemo(() => {
    const c: Record<string, number> = { '': dati?.vendite.length ?? 0 }
    for (const v of dati?.vendite ?? []) c[v.stato] = (c[v.stato] ?? 0) + 1
    return c
  }, [dati])
  const filtrate = (dati?.vendite ?? []).filter((v) => !filtro || v.stato === filtro)
  const nomeCollab = (id: string) => dati?.profili.get(id)?.nome ?? '—'

  async function sostituisciModello(file: File | undefined) {
    if (!file) return
    setErrore(null)
    setSuccesso(null)
    setCaricaModelloInCorso(true)
    try {
      await caricaModello(file)
      setSuccesso('Modello di contratto caricato: i collaboratori possono già scaricarlo.')
      ricarica()
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setCaricaModelloInCorso(false)
    }
  }

  async function cambiaStato(v: Vendita, stato: StatoVendita) {
    setErrore(null)
    setAzione(true)
    try {
      await esegui(supabase.from('vendite').update({ stato }).eq('id', v.id))
      setAperta(null)
      setSuccesso(`Vendita "${v.sito_nome}" segnata come ${ETICHETTE_STATO_VENDITA[stato].toLowerCase()}.`)
      ricarica()
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setAzione(false)
    }
  }

  /** Gestore del progetto: il socio responsabile del venditore (o il socio stesso); altrimenti l'admin (null). */
  function gestoreDi(collaboratoreId: string): string | null {
    const p = dati?.profili.get(collaboratoreId)
    if (!p) return null
    if (p.ruolo === 'socio') return p.id
    return p.responsabile_id
  }

  /** Approva la vendita: crea il progetto e lo assegna al collaboratore con la sua % predefinita. */
  async function creaProgetto(v: Vendita) {
    setErrore(null)
    setAzione(true)
    try {
      const creato = await esegui<{ id: string }>(
        supabase
          .from('progetti')
          .insert({
            nome: v.sito_nome,
            cliente: v.cliente_nome,
            url: urlDaDominio(v.dominio),
            categoria: v.tipo_sito,
            descrizione: v.note,
            prezzo_totale: v.prezzo,
            incassato: Math.min(Number(v.acconto), Number(v.prezzo)),
            data_consegna: v.consegna_prevista,
            stato: 'in_lavorazione',
            pubblico: false,
            // Il progetto appartiene a chi gestisce il venditore (null = admin)
            gestore_id: gestoreDi(v.collaboratore_id),
          })
          .select('id')
          .single(),
      )
      const perc = Number(dati?.profili.get(v.collaboratore_id)?.percentuale_default ?? 0)
      if (perc > 0) {
        await esegui(
          supabase.from('assegnazioni').insert({
            progetto_id: creato.id,
            collaboratore_id: v.collaboratore_id,
            percentuale: perc,
            ruolo_nel_progetto: 'Vendita',
          }),
        )
      }
      await esegui(supabase.from('vendite').update({ stato: 'approvata', progetto_id: creato.id }).eq('id', v.id))
      navigate(`/area/admin/progetti/${creato.id}`)
    } catch (e) {
      setErrore(messaggioErrore(e))
      setAzione(false)
    }
  }

  async function elimina() {
    if (!daEliminare) return
    setErrore(null)
    setAzione(true)
    try {
      await esegui(supabase.from('vendite').delete().eq('id', daEliminare.id))
      await eliminaFile(daEliminare.allegati).catch(() => {})
      setSuccesso(`Vendita "${daEliminare.sito_nome}" eliminata.`)
      setDaEliminare(null)
      setAperta(null)
      ricarica()
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setAzione(false)
    }
  }

  return (
    <>
      <IntestazionePagina titolo="Vendite" sottotitolo="I siti venduti dai collaboratori, con i dati del cliente e il contratto firmato." />

      <div className="mb-4 space-y-3">
        {successo && <MessaggioSuccesso>{successo}</MessaggioSuccesso>}
        {errore && !aperta && !daEliminare && <MessaggioErrore>{errore}</MessaggioErrore>}
      </div>

      {caricamento ? (
        <Caricamento />
      ) : erroreCaricamento ? (
        <MessaggioErrore onRiprova={ricarica}>{erroreCaricamento}</MessaggioErrore>
      ) : (
        <div className="space-y-6">
          <section className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <Icon name="file" />
            </span>
            <div className="flex-1">
              <h2 className="font-semibold text-slate-900">Modello di contratto</h2>
              <p className="text-sm text-slate-500">
                {dati?.modello
                  ? 'Caricato. I collaboratori lo scaricano con il pulsante "Scarica contratto".'
                  : 'Non ancora caricato: carica il PDF o il Word da far firmare ai clienti.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {dati?.modello && <ScaricaModello />}
              <label className={`btn-primary cursor-pointer ${caricaModelloInCorso ? 'pointer-events-none opacity-60' : ''}`}>
                {caricaModelloInCorso ? <Spinner className="h-4 w-4" /> : <Icon name="upload" className="h-4 w-4" />}
                {dati?.modello ? 'Sostituisci' : 'Carica modello'}
                <input
                  type="file"
                  className="sr-only"
                  accept={ACCEPT_MODELLO}
                  onChange={(e) => {
                    sostituisciModello(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </section>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtra per stato">
            {(['in_attesa', 'approvata', 'rifiutata', ''] as const).map((s) => (
              <button
                key={s || 'tutte'}
                role="tab"
                aria-selected={filtro === s}
                onClick={() => setFiltro(s)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${filtro === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
              >
                {s ? ETICHETTE_STATO_VENDITA[s] : 'Tutte'} <span className="opacity-60">{conteggi[s] ?? 0}</span>
              </button>
            ))}
          </div>

          <section className="card overflow-hidden">
            {filtrate.length === 0 ? (
              <Vuoto icona="handshake" titolo="Nessuna vendita" />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Firmato il</th>
                      <th>Sito</th>
                      <th>Collaboratore</th>
                      <th className="text-right">Prezzo</th>
                      <th>Stato</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtrate.map((v) => (
                      <tr key={v.id} className="cursor-pointer hover:bg-slate-50" onClick={() => { setErrore(null); setAperta(v) }}>
                        <td className="whitespace-nowrap">{formatData(v.data_firma)}</td>
                        <td>
                          <p className="font-semibold text-slate-900">{v.sito_nome}</p>
                          <p className="text-xs text-slate-500">{v.cliente_nome}{v.tipo_sito && ` · ${v.tipo_sito}`}</p>
                        </td>
                        <td className="whitespace-nowrap">{nomeCollab(v.collaboratore_id)}</td>
                        <td className="text-right font-semibold whitespace-nowrap tabular-nums">{formatEuro(v.prezzo)}</td>
                        <td><BadgeStatoVendita stato={v.stato} /></td>
                        <td className="text-right">
                          <span className="btn-ghost p-2" aria-hidden="true"><Icon name="arrowRight" className="h-4 w-4" /></span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      <Modale aperta={!!aperta} titolo={aperta?.sito_nome ?? ''} onChiudi={() => setAperta(null)} larga>
        {aperta && (
          <div className="space-y-6">
            {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <BadgeStatoVendita stato={aperta.stato} />
              <span>Inviata da <strong className="text-slate-800">{nomeCollab(aperta.collaboratore_id)}</strong> il {formatDataOra(aperta.created_at)}</span>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Cliente</h3>
              <dl className="grid gap-4 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <Riga etichetta="Nome / ragione sociale">{aperta.cliente_nome}</Riga>
                <Riga etichetta="P. IVA / codice fiscale">{aperta.cliente_codice}</Riga>
                <Riga etichetta="Email">
                  {aperta.cliente_email && <a href={`mailto:${aperta.cliente_email}`} className="text-brand-700 hover:underline">{aperta.cliente_email}</a>}
                </Riga>
                <Riga etichetta="Telefono">
                  {aperta.cliente_telefono && <a href={`tel:${aperta.cliente_telefono.replace(/\s/g, '')}`} className="text-brand-700 hover:underline">{aperta.cliente_telefono}</a>}
                </Riga>
                <div className="sm:col-span-2"><Riga etichetta="Indirizzo / sede">{aperta.cliente_indirizzo}</Riga></div>
              </dl>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Sito e accordi</h3>
              <dl className="grid gap-4 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
                <Riga etichetta="Tipo di sito">{aperta.tipo_sito}</Riga>
                <Riga etichetta="Dominio">{aperta.dominio}</Riga>
                <Riga etichetta="Data firma">{formatData(aperta.data_firma)}</Riga>
                <Riga etichetta="Prezzo">{formatEuro(aperta.prezzo)}</Riga>
                <Riga etichetta="Acconto ricevuto">{formatEuro(aperta.acconto)}</Riga>
                <Riga etichetta="Consegna prevista">{aperta.consegna_prevista ? formatData(aperta.consegna_prevista) : ''}</Riga>
                {aperta.note && <div className="sm:col-span-3"><Riga etichetta="Note"><span className="whitespace-pre-line">{aperta.note}</span></Riga></div>}
              </dl>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Contratto firmato</h3>
              <AllegatiContratto vendita={aperta} />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
              <button className="btn-ghost text-red-600 sm:mr-auto" onClick={() => setDaEliminare(aperta)} disabled={azione}>
                <Icon name="trash" className="h-4 w-4" /> Elimina
              </button>
              {aperta.stato === 'in_attesa' && (
                <>
                  <button className="btn-secondary" onClick={() => cambiaStato(aperta, 'rifiutata')} disabled={azione}>
                    <Icon name="ban" className="h-4 w-4" /> Rifiuta
                  </button>
                  <button className="btn-primary" onClick={() => creaProgetto(aperta)} disabled={azione}>
                    {azione ? <Spinner className="h-4 w-4" /> : <Icon name="check" className="h-4 w-4" />} Approva e crea progetto
                  </button>
                </>
              )}
              {aperta.stato === 'rifiutata' && (
                <button className="btn-secondary" onClick={() => cambiaStato(aperta, 'in_attesa')} disabled={azione}>
                  Rimetti in attesa
                </button>
              )}
              {aperta.stato === 'approvata' && aperta.progetto_id && (
                <Link to={`/area/admin/progetti/${aperta.progetto_id}`} className="btn-primary">
                  <Icon name="folder" className="h-4 w-4" /> Apri progetto
                </Link>
              )}
            </div>
            {aperta.stato === 'in_attesa' && (
              <p className="text-xs text-slate-500">
                "Approva e crea progetto" crea il progetto con questi dati (non visibile nel portfolio) e lo assegna a {nomeCollab(aperta.collaboratore_id)} con la sua % predefinita. Potrai modificarlo subito dopo.
              </p>
            )}
          </div>
        )}
      </Modale>

      <Modale aperta={!!daEliminare} titolo="Eliminare la vendita?" onChiudi={() => setDaEliminare(null)}>
        {errore && <div className="mb-4"><MessaggioErrore>{errore}</MessaggioErrore></div>}
        <p className="text-sm text-slate-600">
          La vendita <strong>{daEliminare?.sito_nome}</strong> e i file del contratto firmato verranno eliminati definitivamente. L'eventuale progetto già creato resta.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDaEliminare(null)}>Annulla</button>
          <button className="btn-danger" onClick={elimina} disabled={azione}>
            {azione && <Spinner className="h-4 w-4" />} Elimina
          </button>
        </div>
      </Modale>
    </>
  )
}
