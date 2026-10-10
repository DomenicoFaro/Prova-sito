import { useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../../../auth/AuthProvider'
import { Icon } from '../../../components/Icon'
import { RiepilogoPreventivo } from '../../../components/RiepilogoPreventivo'
import { TestoContratto } from '../../../components/TestoContratto'
import { Caricamento, IntestazionePagina, MessaggioErrore, MessaggioSuccesso, Modale, Spinner, TabellaScroll, Vuoto } from '../../../components/ui'
import { BUCKET_ALLEGATI } from '../../../lib/configuratore'
import { formatData, formatDataOra, formatEuro, parseNumero } from '../../../lib/format'
import { ETICHETTE_STATO_ORDINE, linkOrdine, scaricaContratto, type OrdineSito, type StatoOrdine } from '../../../lib/ordini'
import { messaggioErrore, supabase } from '../../../lib/supabase'
import { esegui, useQuery } from '../../../lib/useQuery'
import { AdminListinoConfiguratore } from './AdminListinoConfiguratore'

const COLORI_STATO: Record<StatoOrdine, string> = {
  richiesto: 'bg-amber-50 text-amber-700',
  preventivo_inviato: 'bg-blue-50 text-blue-700',
  pagato: 'bg-emerald-50 text-emerald-700',
  annullato: 'bg-slate-100 text-slate-600',
}

function BadgeOrdine({ stato }: { stato: StatoOrdine }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${COLORI_STATO[stato]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {ETICHETTE_STATO_ORDINE[stato]}
    </span>
  )
}

const numeroOrdine = (o: OrdineSito) => `W-${String(o.numero).padStart(5, '0')}`

function Dato({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{etichetta}</dt>
      <dd className="mt-0.5 font-medium break-words text-slate-900">{valore || '—'}</dd>
    </div>
  )
}

const virgola = (n: number) => String(n).replace('.', ',')

function DettaglioOrdine({ ordine, onSalvato }: { ordine: OrdineSito; onSalvato: () => void }) {
  const modificabile = ordine.stato === 'richiesto' || ordine.stato === 'preventivo_inviato'
  const det = ordine.dettaglio_preventivo
  const [urgenzaOk, setUrgenzaOk] = useState(ordine.urgenza_confermata)
  // Totale suggerito dal configuratore (con l'urgenza solo se la confermi): è un aiuto, il prezzo lo decidi tu
  const suggerito = (conUrgenza: boolean) => (det ? Number(det.subtotale) + (conUrgenza ? Number(det.urgenza_importo) : 0) : null)
  // Prezzo iniziale: quello già confermato; altrimenti il suggerimento del listino, ma solo se è completo
  // (le richieste «da approvare a mano» partono vuote, così il prezzo lo decidi tu).
  const prezzoIniziale = ordine.prezzo != null ? virgola(ordine.prezzo) : det && !det.approvazione_manuale ? virgola(suggerito(ordine.urgenza_confermata) ?? 0) : ''
  const [prezzo, setPrezzo] = useState(prezzoIniziale)
  const [acconto, setAcconto] = useState(ordine.acconto != null ? String(ordine.acconto).replace('.', ',') : '')
  const [giorni, setGiorni] = useState(ordine.consegna_giorni != null ? String(ordine.consegna_giorni) : '')
  const [nota, setNota] = useState(ordine.nota_preventivo)
  const [notaInterna, setNotaInterna] = useState(ordine.nota_interna)
  const [attesa, setAttesa] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [esito, setEsito] = useState<string | null>(null)
  const [anteprima, setAnteprima] = useState<string | null>(null)

  const link = linkOrdine(ordine.token)

  async function salva(nuovoStato: StatoOrdine | null) {
    setErrore(null)
    setEsito(null)
    const p = parseNumero(prezzo)
    const a = acconto.trim() === '' ? null : parseNumero(acconto)
    const g = giorni.trim() === '' ? null : Number(giorni)
    if (nuovoStato === 'preventivo_inviato') {
      if (!(p > 0)) return setErrore('Inserisci il prezzo del sito.')
      if (g == null || !Number.isInteger(g) || g < 1) return setErrore('Inserisci i giorni di consegna (numero intero).')
    }
    if (prezzo.trim() !== '' && Number.isNaN(p)) return setErrore('Prezzo non valido.')
    if (a != null && (Number.isNaN(a) || a < 0 || (p > 0 && a > p))) return setErrore("L'acconto non può superare il prezzo.")
    setAttesa(true)
    try {
      const { error } = await supabase
        .from('ordini_siti')
        .update({
          prezzo: prezzo.trim() === '' ? null : p,
          acconto: a,
          consegna_giorni: g,
          nota_preventivo: nota,
          nota_interna: notaInterna,
          ...(det
            ? {
                urgenza_confermata: urgenzaOk,
                dettaglio_preventivo: {
                  ...det,
                  urgenza_confermata: urgenzaOk,
                  totale: Math.round(((suggerito(urgenzaOk) ?? 0) + Number.EPSILON) * 100) / 100,
                },
              }
            : {}),
          ...(nuovoStato ? { stato: nuovoStato } : {}),
          ...(nuovoStato === 'preventivo_inviato' ? { preventivo_il: new Date().toISOString() } : {}),
        })
        .eq('id', ordine.id)
      if (error) throw error
      setEsito(nuovoStato === 'preventivo_inviato' ? 'Preventivo inviato: copia il link e mandalo al cliente.' : 'Salvato.')
      onSalvato()
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setAttesa(false)
    }
  }

  async function mostraAnteprima() {
    setErrore(null)
    try {
      const { data, error } = await supabase.rpc('admin_anteprima_contratto', { p_id: ordine.id })
      if (error) throw error
      setAnteprima(String(data))
    } catch (e) {
      setErrore(messaggioErrore(e))
    }
  }

  function cambiaUrgenza(conferma: boolean) {
    // Se il prezzo è ancora quello suggerito, lo aggiorna insieme all'urgenza; se l'hai scritto tu, non lo tocca
    const precedente = suggerito(urgenzaOk)
    if (precedente != null && prezzo.trim() === virgola(precedente)) setPrezzo(virgola(suggerito(conferma)!))
    setUrgenzaOk(conferma)
  }

  async function apriAllegato(path: string) {
    setErrore(null)
    try {
      const { data, error } = await supabase.storage.from(BUCKET_ALLEGATI).createSignedUrl(path, 120)
      if (error) throw error
      window.open(data.signedUrl, '_blank', 'noopener')
    } catch (e) {
      setErrore(messaggioErrore(e))
    }
  }

  async function copia() {
    try {
      await navigator.clipboard.writeText(link)
      setEsito('Link copiato.')
    } catch {
      setEsito(link)
    }
  }

  const mail = `mailto:${ordine.cliente_email}?subject=${encodeURIComponent(`Il tuo preventivo – ordine ${numeroOrdine(ordine)}`)}&body=${encodeURIComponent(
    `Ciao ${ordine.cliente_nome},\n\nil tuo preventivo è pronto. Da questo link puoi vedere il prezzo, leggere il contratto e acquistare:\n${link}\n\nA presto`,
  )}`

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <Dato etichetta="Cliente" valore={ordine.cliente_nome} />
        <Dato etichetta="Email" valore={ordine.cliente_email} />
        <Dato etichetta="Telefono" valore={ordine.cliente_telefono} />
        <Dato etichetta="CF / P.IVA" valore={ordine.cliente_codice} />
        <Dato etichetta="Indirizzo" valore={ordine.cliente_indirizzo} />
        <Dato etichetta="Richiesta del" valore={formatDataOra(ordine.created_at)} />
        <Dato etichetta="Tipo di sito" valore={ordine.tipo_sito} />
        <Dato etichetta="Attività" valore={ordine.nome_attivita} />
        <Dato etichetta="Pagine" valore={ordine.pagine} />
        <Dato etichetta="Lingue" valore={ordine.lingue} />
        <Dato etichetta="Dominio" valore={ordine.dominio} />
        <Dato etichetta="Scadenza desiderata" valore={ordine.scadenza} />
        <Dato etichetta="Budget indicato" valore={ordine.budget} />
        <Dato etichetta="Funzionalità" valore={ordine.funzionalita.join(', ')} />
      </dl>
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-slate-500">Descrizione</p>
          <p className="mt-0.5 whitespace-pre-line text-slate-800">{ordine.descrizione}</p>
        </div>
        {ordine.stile && (
          <div>
            <p className="text-xs text-slate-500">Stile e riferimenti</p>
            <p className="mt-0.5 whitespace-pre-line text-slate-800">{ordine.stile}</p>
          </div>
        )}
      </div>

      {det && (
        <div className="space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">Configurazione scelta dal cliente</h3>
            {ordine.approvazione_manuale && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Richiede approvazione manuale</span>
            )}
          </div>
          <RiepilogoPreventivo preventivo={{ ...det, urgenza_confermata: urgenzaOk }} urgenzaRichiesta={ordine.urgenza_richiesta} />
          <p className="text-xs text-slate-500">
            È una stima calcolata dal listino. Il cliente paga <strong>solo l&apos;importo che confermi nel Preventivo qui sotto</strong>.
          </p>
          {ordine.urgenza_richiesta && modificabile && (
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={urgenzaOk} onChange={(e) => cambiaUrgenza(e.target.checked)} />
              Confermo la consegna urgente (+{det.urgenza_percentuale}%, circa {formatEuro(det.urgenza_importo)})
            </label>
          )}
        </div>
      )}

      {ordine.allegati?.length > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">Materiali caricati dal cliente</h3>
          <div className="flex flex-wrap gap-2">
            {ordine.allegati.map((path, i) => (
              <button key={path} type="button" className="btn-secondary py-1.5 text-xs" onClick={() => apriAllegato(path)}>
                <Icon name="file" className="h-4 w-4" /> {path.split('/').pop()?.replace(/^[0-9a-f]{8}-/, '') ?? `File ${i + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {ordine.stato === 'pagato' && (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p>
            Pagato {formatEuro(ordine.importo_pagato)} il {ordine.pagato_il ? formatDataOra(ordine.pagato_il) : '—'}. Contratto accettato da{' '}
            <strong>{ordine.firmatario}</strong> il {ordine.accettato_il ? formatDataOra(ordine.accettato_il) : '—'} (IP {ordine.accettato_ip || '—'}).
          </p>
          {ordine.contratto_finale && (
            <>
              <button className="btn-secondary text-xs" onClick={() => scaricaContratto(ordine.contratto_finale!, `Contratto ${numeroOrdine(ordine)}`)}>
                <Icon name="download" className="h-4 w-4" /> Scarica il contratto compilato
              </button>
              <TestoContratto testo={ordine.contratto_finale} className="max-h-64" />
            </>
          )}
        </div>
      )}

      <form
        className="space-y-4 rounded-xl border border-slate-200 p-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          salva(ordine.stato === 'richiesto' ? 'preventivo_inviato' : null)
        }}
      >
        <h3 className="font-semibold text-slate-900">Preventivo</h3>
        {ordine.stato === 'richiesto' && (
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            {ordine.approvazione_manuale
              ? 'Questa richiesta richiede approvazione manuale: finché non invii il preventivo il cliente non può pagare. Inviandolo confermi l’importo.'
              : 'Finché non invii il preventivo il cliente non può pagare. Inviandolo confermi l’importo.'}
            {det && <> Totale suggerito dal listino: <strong>{formatEuro(suggerito(urgenzaOk))}</strong>{det.approvazione_manuale ? ' (parziale: contiene voci «da» o su preventivo)' : ''}.</>}
          </p>
        )}
        <fieldset disabled={!modificabile} className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="label">Prezzo totale (€)</span>
            <input value={prezzo} onChange={(e) => setPrezzo(e.target.value)} inputMode="decimal" className="input" placeholder="600" />
          </label>
          <label className="block">
            <span className="label">Da pagare ora (€)</span>
            <input value={acconto} onChange={(e) => setAcconto(e.target.value)} inputMode="decimal" className="input" placeholder="Vuoto = tutto" />
          </label>
          <label className="block">
            <span className="label">Consegna (giorni)</span>
            <input value={giorni} onChange={(e) => setGiorni(e.target.value)} inputMode="numeric" className="input" placeholder="30" />
          </label>
          <label className="block sm:col-span-3">
            <span className="label">Messaggio per il cliente (visibile)</span>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} maxLength={5000} className="input" />
          </label>
          <label className="block sm:col-span-3">
            <span className="label">Nota interna (non visibile al cliente)</span>
            <textarea value={notaInterna} onChange={(e) => setNotaInterna(e.target.value)} rows={2} maxLength={5000} className="input" />
          </label>
        </fieldset>

        {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
        {esito && <MessaggioSuccesso>{esito}</MessaggioSuccesso>}

        <div className="flex flex-wrap gap-2">
          {modificabile && (
            <button type="submit" disabled={attesa} className="btn-primary">
              {attesa && <Spinner className="h-4 w-4" />}
              {ordine.stato === 'richiesto' ? 'Invia preventivo al cliente' : 'Salva modifiche'}
            </button>
          )}
          {ordine.stato === 'preventivo_inviato' && (
            <button type="button" className="btn-secondary" onClick={mostraAnteprima}>
              <Icon name="eye" className="h-4 w-4" /> Anteprima contratto
            </button>
          )}
          {modificabile && (
            <button type="button" disabled={attesa} className="btn-ghost text-red-600" onClick={() => salva('annullato')}>
              Annulla ordine
            </button>
          )}
          {ordine.stato === 'annullato' && (
            <button type="button" disabled={attesa} className="btn-secondary" onClick={() => salva('richiesto')}>
              Riapri
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
        <p className="font-semibold text-slate-900">Link del cliente</p>
        <p className="break-all text-slate-600">{link}</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary text-xs" onClick={copia}>
            Copia link
          </button>
          <a className="btn-secondary text-xs" href={mail}>
            <Icon name="mail" className="h-4 w-4" /> Scrivi al cliente
          </a>
        </div>
      </div>

      <Modale aperta={anteprima != null} titolo="Anteprima contratto" onChiudi={() => setAnteprima(null)} larga>
        {anteprima && <TestoContratto testo={anteprima} className="max-h-[65vh]" />}
      </Modale>
    </div>
  )
}

function ModelloContratto() {
  const { dati, caricamento, errore, ricarica } = useQuery(async () =>
    (await esegui<{ testo: string }[]>(supabase.from('ordini_contratto').select('testo').eq('id', 1)))[0]?.testo ?? '',
  )
  const [bozza, setBozza] = useState<string | null>(null)
  const [attesa, setAttesa] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const testo = bozza ?? dati ?? ''

  async function salva() {
    setErr(null)
    setOk(false)
    setAttesa(true)
    try {
      const { error } = await supabase.from('ordini_contratto').upsert({ id: 1, testo, updated_at: new Date().toISOString() })
      if (error) throw error
      setOk(true)
      setBozza(null)
      ricarica()
    } catch (e) {
      setErr(messaggioErrore(e))
    } finally {
      setAttesa(false)
    }
  }

  if (caricamento) return <Caricamento />
  if (errore) return <MessaggioErrore onRiprova={ricarica}>{errore}</MessaggioErrore>

  return (
    <div className="card space-y-4 p-5">
      <p className="text-sm text-slate-600">
        È il contratto che il cliente legge prima di pagare e che riceve compilato dopo il pagamento. Incolla qui il tuo testo. Usa{' '}
        <code># Titolo</code> per i titoli; una riga = un paragrafo.
      </p>
      <p className="rounded-xl bg-slate-50 p-3 text-xs break-words text-slate-600">
        Segnaposto sostituiti in automatico: {'{{cliente_nome}} {{cliente_codice}} {{cliente_indirizzo}} {{cliente_email}} {{cliente_telefono}} {{numero_ordine}} {{data}} {{tipo_sito}} {{nome_attivita}} {{pagine}} {{funzionalita}} {{lingue}} {{dominio}} {{descrizione}} {{prezzo}} {{acconto}} {{saldo}} {{consegna_giorni}} {{firmatario}}'}
      </p>
      <textarea value={testo} onChange={(e) => setBozza(e.target.value)} rows={22} className="input font-mono text-xs" />
      {err && <MessaggioErrore>{err}</MessaggioErrore>}
      {ok && <MessaggioSuccesso>Modello salvato. Vale per i nuovi pagamenti; i contratti già pagati non cambiano.</MessaggioSuccesso>}
      <button className="btn-primary" onClick={salva} disabled={attesa || bozza == null || testo.trim().length < 20}>
        {attesa && <Spinner className="h-4 w-4" />} Salva modello
      </button>
    </div>
  )
}

export default function AdminPreventivi() {
  const { isAdmin } = useAuth()
  const [scheda, setScheda] = useState<'ordini' | 'listino' | 'modello'>('ordini')
  const [filtro, setFiltro] = useState<StatoOrdine | ''>('richiesto')
  const [apertoId, setApertoId] = useState<string | null>(null)

  const { dati, caricamento, errore, ricarica } = useQuery(
    () => esegui<OrdineSito[]>(supabase.from('ordini_siti').select('*').order('created_at', { ascending: false })),
    [],
  )

  const conteggi = useMemo(() => {
    const c: Record<string, number> = { '': dati?.length ?? 0 }
    for (const o of dati ?? []) c[o.stato] = (c[o.stato] ?? 0) + 1
    return c
  }, [dati])
  const filtrati = (dati ?? []).filter((o) => !filtro || o.stato === filtro)
  const aperto = dati?.find((o) => o.id === apertoId) ?? null

  if (!isAdmin) return <MessaggioErrore>Solo l'amministratore gestisce preventivi e ordini dei clienti.</MessaggioErrore>

  return (
    <>
      <IntestazionePagina titolo="Preventivi e ordini" sottotitolo="Richieste dei clienti dal sito: rispondi con il preventivo, il cliente accetta il contratto e paga." />

      <div className="mb-5 flex gap-2">
        {(['ordini', 'listino', 'modello'] as const).map((s) => (
          <button key={s} onClick={() => setScheda(s)} className={scheda === s ? 'btn-primary' : 'btn-secondary'}>
            {s === 'ordini' ? 'Ordini' : s === 'listino' ? 'Listino prezzi e servizi' : 'Modello contratto'}
          </button>
        ))}
      </div>

      {scheda === 'modello' ? (
        <ModelloContratto />
      ) : scheda === 'listino' ? (
        <AdminListinoConfiguratore />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {(['richiesto', 'preventivo_inviato', 'pagato', 'annullato', ''] as const).map((s) => (
              <button key={s || 'tutti'} onClick={() => setFiltro(s)} className={filtro === s ? 'btn-primary' : 'btn-secondary'}>
                {s ? ETICHETTE_STATO_ORDINE[s] : 'Tutti'} ({conteggi[s] ?? 0})
              </button>
            ))}
          </div>

          {caricamento ? (
            <Caricamento />
          ) : errore ? (
            <MessaggioErrore onRiprova={ricarica}>
              {errore} Hai eseguito <code>supabase/ordini.sql</code>?
            </MessaggioErrore>
          ) : filtrati.length === 0 ? (
            <div className="card">
              <Vuoto icona="cart" titolo="Nessun ordine in questa categoria" />
            </div>
          ) : (
            <div className="card overflow-hidden">
              <TabellaScroll>
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>N.</th>
                      <th>Cliente</th>
                      <th>Sito</th>
                      <th>Data</th>
                      <th>Prezzo</th>
                      <th>Stato</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtrati.map((o) => (
                      <tr key={o.id}>
                        <td className="font-mono text-xs">{numeroOrdine(o)}</td>
                        <td>
                          <p className="font-medium text-slate-900">{o.cliente_nome}</p>
                          <p className="text-xs text-slate-500">{o.cliente_email}</p>
                        </td>
                        <td>{o.nome_attivita || o.tipo_sito || '—'}</td>
                        <td className="whitespace-nowrap">{formatData(o.created_at)}</td>
                        <td className="whitespace-nowrap tabular-nums">{o.prezzo != null ? formatEuro(o.prezzo) : '—'}</td>
                        <td>
                          <BadgeOrdine stato={o.stato} />
                        </td>
                        <td className="text-right">
                          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setApertoId(o.id)}>
                            Apri
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabellaScroll>
            </div>
          )}
        </>
      )}

      <Modale aperta={aperto != null} titolo={aperto ? `Ordine ${numeroOrdine(aperto)}` : ''} onChiudi={() => setApertoId(null)} larga>
        {aperto && <DettaglioOrdine key={aperto.id + aperto.stato} ordine={aperto} onSalvato={ricarica} />}
      </Modale>
    </>
  )
}
