import { useState, type FormEvent } from 'react'
import { Icon } from '../../../components/Icon'
import { Caricamento, MessaggioErrore, MessaggioSuccesso, Modale, Spinner, TabellaScroll } from '../../../components/ui'
import {
  AVVISO_PREVENTIVO_PREDEFINITO,
  AVVISO_SERVIZI_PREDEFINITO,
  CODICE_PAGINA_AGGIUNTIVA,
  formatPrezzoVoce,
  type GruppoVoce,
  type Impostazioni,
  type ModalitaPrezzo,
  type VoceConfiguratore,
} from '../../../lib/configuratore'
import { parseNumero } from '../../../lib/format'
import { messaggioErrore, supabase } from '../../../lib/supabase'
import { esegui, useQuery } from '../../../lib/useQuery'

const GRUPPI: { gruppo: GruppoVoce; titolo: string; nota: string }[] = [
  { gruppo: 'tipologia', titolo: 'Tipologie di sito', nota: 'Prezzo di partenza, pagine incluse e funzionalità già comprese.' },
  { gruppo: 'extra', titolo: 'Funzionalità aggiuntive', nota: 'Supplementi che il cliente può aggiungere. «Pagina aggiuntiva» è il prezzo di ogni pagina oltre quelle incluse.' },
  { gruppo: 'servizio_esterno', titolo: 'Servizi esterni e abbonamenti', nota: 'Solo informativi: non si sommano al preventivo. Il costo è un testo libero, così non si mescolano dollari ed euro.' },
]

const ETICHETTE_MODALITA: Record<ModalitaPrezzo, string> = {
  fisso: 'Prezzo fisso',
  da: 'Prezzo «da» (da confermare)',
  preventivo: 'Su preventivo (nessun prezzo automatico)',
}

interface FormVoce {
  codice: string
  gruppo: GruppoVoce
  nome: string
  descrizione: string
  modalita: ModalitaPrezzo
  prezzo: string
  pagine_incluse: string
  incluse: string[]
  a_quantita: boolean
  costo_testo: string
  ordine: string
  attivo: boolean
  in_prova: boolean
}

const daVoce = (v: VoceConfiguratore): FormVoce => ({
  codice: v.codice,
  gruppo: v.gruppo,
  nome: v.nome,
  descrizione: v.descrizione,
  modalita: v.modalita,
  prezzo: v.prezzo != null ? String(v.prezzo).replace('.', ',') : '',
  pagine_incluse: String(v.pagine_incluse),
  incluse: v.incluse,
  a_quantita: v.a_quantita,
  costo_testo: v.costo_testo,
  ordine: String(v.ordine),
  attivo: v.attivo,
  in_prova: v.in_prova,
})

const slug = (nome: string) =>
  nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)

function ImpostazioniListino({ impostazioni, onSalvato }: { impostazioni: Impostazioni; onSalvato: () => void }) {
  const [urgenza, setUrgenza] = useState(impostazioni.urgenza_percentuale ?? '20')
  const [avvisoPrev, setAvvisoPrev] = useState(impostazioni.avviso_preventivo ?? AVVISO_PREVENTIVO_PREDEFINITO)
  const [avvisoServ, setAvvisoServ] = useState(impostazioni.avviso_servizi_esterni ?? AVVISO_SERVIZI_PREDEFINITO)
  const [provaPrezzo, setProvaPrezzo] = useState(impostazioni.prova_prezzo ?? '100')
  const [provaSconto, setProvaSconto] = useState(impostazioni.prova_sconto_extra ?? '70')
  const [attesa, setAttesa] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function salva(e: FormEvent) {
    e.preventDefault()
    setErrore(null)
    setOk(false)
    const pct = parseNumero(urgenza)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return setErrore("La percentuale d'urgenza deve essere tra 0 e 100.")
    const pp = parseNumero(provaPrezzo)
    const ps = parseNumero(provaSconto)
    if (!Number.isFinite(pp) || pp < 0) return setErrore('Il prezzo della prova deve essere 0 o più.')
    if (!Number.isFinite(ps) || ps < 0 || ps > 100) return setErrore('Lo sconto della prova deve essere tra 0 e 100.')
    setAttesa(true)
    try {
      await esegui(
        supabase.from('configuratore_impostazioni').upsert([
          { chiave: 'urgenza_percentuale', valore: String(pct).replace('.', ',') },
          { chiave: 'prova_prezzo', valore: String(pp).replace('.', ',') },
          { chiave: 'prova_sconto_extra', valore: String(ps).replace('.', ',') },
          { chiave: 'avviso_preventivo', valore: avvisoPrev.trim() },
          { chiave: 'avviso_servizi_esterni', valore: avvisoServ.trim() },
        ]),
      )
      setOk(true)
      onSalvato()
    } catch (err) {
      setErrore(messaggioErrore(err))
    } finally {
      setAttesa(false)
    }
  }

  return (
    <form onSubmit={salva} className="card space-y-4 p-5">
      <h3 className="font-semibold text-slate-900">Impostazioni e avvisi</h3>
      <label className="block max-w-xs">
        <span className="label">Supplemento consegna urgente (%)</span>
        <input value={urgenza} onChange={(e) => setUrgenza(e.target.value)} inputMode="decimal" className="input" />
        <span className="mt-1 block text-xs text-slate-500">Calcolato sul subtotale di realizzazione. Entra nel totale solo quando lo confermi tu su un ordine.</span>
      </label>
      <div className="grid max-w-xl gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Prova un mese: prezzo (€)</span>
          <input value={provaPrezzo} onChange={(e) => setProvaPrezzo(e.target.value)} inputMode="decimal" className="input" />
          <span className="mt-1 block text-xs text-slate-500">Quanto paga il cliente per il mese di prova, oltre alle funzionalità aggiuntive.</span>
        </label>
        <label className="block">
          <span className="label">Prova un mese: sconto sulle aggiuntive (%)</span>
          <input value={provaSconto} onChange={(e) => setProvaSconto(e.target.value)} inputMode="decimal" className="input" />
          <span className="mt-1 block text-xs text-slate-500">Si applica a pagine e funzionalità aggiuntive; il resto del prezzo pieno si paga dopo il mese.</span>
        </label>
      </div>
      <label className="block">
        <span className="label">Avviso sotto il preventivo</span>
        <textarea value={avvisoPrev} onChange={(e) => setAvvisoPrev(e.target.value)} rows={2} maxLength={500} className="input" />
      </label>
      <label className="block">
        <span className="label">Avviso sui servizi esterni</span>
        <textarea value={avvisoServ} onChange={(e) => setAvvisoServ(e.target.value)} rows={3} maxLength={800} className="input" />
      </label>
      {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
      {ok && <MessaggioSuccesso>Impostazioni salvate. Valgono per le nuove richieste.</MessaggioSuccesso>}
      <button className="btn-primary" disabled={attesa}>
        {attesa && <Spinner className="h-4 w-4" />} Salva impostazioni
      </button>
    </form>
  )
}

/** Listino del configuratore «Acquista il tuo sito»: prezzi, descrizioni, servizi esterni e supplementi. Solo admin. */
export function AdminListinoConfiguratore() {
  const { dati, caricamento, errore, ricarica } = useQuery(async () => {
    const [voci, imp] = await Promise.all([
      esegui<VoceConfiguratore[]>(supabase.from('configuratore_voci').select('*').order('ordine')),
      esegui<{ chiave: string; valore: string }[]>(supabase.from('configuratore_impostazioni').select('chiave, valore')),
    ])
    return {
      voci: voci.map((v) => ({ ...v, prezzo: v.prezzo == null ? null : Number(v.prezzo) })),
      impostazioni: Object.fromEntries(imp.map((r) => [r.chiave, r.valore])) as Impostazioni,
    }
  })
  const [modale, setModale] = useState<{ nuova: boolean; form: FormVoce } | null>(null)
  const [attesa, setAttesa] = useState(false)
  const [erroreForm, setErroreForm] = useState<string | null>(null)
  const [esito, setEsito] = useState<string | null>(null)

  const voci = dati?.voci ?? []
  const extraSelezionabili = voci.filter((v) => v.gruppo === 'extra' && v.codice !== CODICE_PAGINA_AGGIUNTIVA)

  function apri(v: VoceConfiguratore) {
    setErroreForm(null)
    setModale({ nuova: false, form: daVoce(v) })
  }

  function apriNuova(gruppo: GruppoVoce) {
    setErroreForm(null)
    const max = Math.max(0, ...voci.filter((v) => v.gruppo === gruppo).map((v) => v.ordine))
    setModale({
      nuova: true,
      form: {
        codice: '', gruppo, nome: '', descrizione: '', modalita: 'fisso', prezzo: '', pagine_incluse: '1', incluse: [],
        a_quantita: false, costo_testo: '', ordine: String(max + 10), attivo: true, in_prova: true,
      },
    })
  }

  const cambia = (patch: Partial<FormVoce>) => setModale((m) => m && { ...m, form: { ...m.form, ...patch } })

  async function salva(e: FormEvent) {
    e.preventDefault()
    if (!modale) return
    const f = modale.form
    setErroreForm(null)
    const speciale = f.codice === CODICE_PAGINA_AGGIUNTIVA
    if (!f.nome.trim()) return setErroreForm('Il nome è obbligatorio.')
    const ordine = Number(f.ordine)
    if (!Number.isInteger(ordine)) return setErroreForm("L'ordine deve essere un numero intero.")

    let prezzo: number | null = null
    if (f.gruppo !== 'servizio_esterno' && f.modalita !== 'preventivo') {
      prezzo = parseNumero(f.prezzo)
      if (!Number.isFinite(prezzo) || prezzo < 0) return setErroreForm('Inserisci un prezzo valido (0 o più).')
    }
    const pagine = Number(f.pagine_incluse || 0)
    if (f.gruppo === 'tipologia' && (!Number.isInteger(pagine) || pagine < 0 || pagine > 100)) return setErroreForm('Le pagine incluse devono essere tra 0 e 100.')
    if (speciale && !f.attivo) return setErroreForm('La «Pagina aggiuntiva» deve restare attiva: serve al calcolo delle pagine.')

    let codice = f.codice
    if (modale.nuova) {
      const base = slug(f.nome) || 'voce'
      codice = base.length < 2 ? `${base}_x` : base
      let n = 2
      while (voci.some((v) => v.codice === codice)) codice = `${base}_${n++}`.slice(0, 60)
    }

    setAttesa(true)
    try {
      const riga = {
        codice,
        gruppo: f.gruppo,
        nome: f.nome.trim(),
        descrizione: f.descrizione.trim(),
        modalita: f.gruppo === 'servizio_esterno' ? 'fisso' : f.modalita,
        prezzo,
        pagine_incluse: f.gruppo === 'tipologia' ? pagine : 0,
        incluse: f.gruppo === 'tipologia' ? f.incluse : [],
        a_quantita: f.gruppo === 'extra' ? f.a_quantita || speciale : false,
        costo_testo: f.gruppo === 'servizio_esterno' ? f.costo_testo.trim() : '',
        ordine,
        attivo: f.attivo,
        in_prova: f.gruppo === 'servizio_esterno' ? true : f.in_prova,
      }
      if (modale.nuova) await esegui(supabase.from('configuratore_voci').insert(riga))
      else await esegui(supabase.from('configuratore_voci').update(riga).eq('codice', codice))
      setEsito(modale.nuova ? 'Voce aggiunta.' : 'Voce aggiornata. Vale per le nuove richieste.')
      setModale(null)
      ricarica()
    } catch (err) {
      setErroreForm(messaggioErrore(err))
    } finally {
      setAttesa(false)
    }
  }

  async function nascondi(v: VoceConfiguratore) {
    setEsito(null)
    try {
      await esegui(supabase.from('configuratore_voci').update({ attivo: !v.attivo }).eq('codice', v.codice))
      ricarica()
    } catch (err) {
      setEsito(messaggioErrore(err))
    }
  }

  if (caricamento) return <Caricamento />
  if (errore || !dati) {
    return (
      <MessaggioErrore onRiprova={ricarica}>
        {errore} Hai eseguito <code>supabase/configuratore.sql</code>?
      </MessaggioErrore>
    )
  }

  const f = modale?.form

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Qui decidi prezzi, descrizioni, servizi esterni e supplementi del modulo «Acquista il tuo sito» e della «Prova un mese» (colonna «In prova»). Le modifiche valgono per le richieste
        nuove; quelle già ricevute restano com&apos;erano. I prezzi li legge solo il server: chi non è admin non può cambiarli.
      </p>
      {esito && <MessaggioSuccesso>{esito}</MessaggioSuccesso>}

      {GRUPPI.map(({ gruppo, titolo, nota }) => (
        <section key={gruppo} className="card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900">{titolo}</h3>
              <p className="text-xs text-slate-500">{nota}</p>
            </div>
            <button className="btn-secondary text-xs" onClick={() => apriNuova(gruppo)}>
              <Icon name="plus" className="h-4 w-4" /> Nuova voce
            </button>
          </div>
          <TabellaScroll>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>{gruppo === 'servizio_esterno' ? 'Costo' : 'Prezzo'}</th>
                  {gruppo === 'tipologia' && <th>Pagine incluse</th>}
                  {gruppo !== 'servizio_esterno' && <th>In prova</th>}
                  <th>Visibile</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {voci
                  .filter((v) => v.gruppo === gruppo)
                  .map((v) => (
                    <tr key={v.codice} className={v.attivo ? '' : 'opacity-60'}>
                      <td>
                        <p className="font-medium text-slate-900">{v.nome}</p>
                        {v.descrizione && <p className="max-w-md truncate text-xs text-slate-500">{v.descrizione}</p>}
                      </td>
                      <td className="whitespace-nowrap tabular-nums">{gruppo === 'servizio_esterno' ? v.costo_testo || '—' : formatPrezzoVoce(v)}</td>
                      {gruppo === 'tipologia' && <td>{v.modalita === 'preventivo' ? '—' : v.pagine_incluse}</td>}
                      {gruppo !== 'servizio_esterno' && <td>{v.in_prova ? 'Sì' : <span className="text-slate-400">No</span>}</td>}
                      <td>{v.attivo ? 'Sì' : 'Nascosta'}</td>
                      <td className="text-right whitespace-nowrap">
                        {v.codice !== CODICE_PAGINA_AGGIUNTIVA && (
                          <button className="btn-ghost p-2" onClick={() => nascondi(v)} aria-label={v.attivo ? `Nascondi ${v.nome}` : `Mostra ${v.nome}`}>
                            <Icon name={v.attivo ? 'ban' : 'eye'} className="h-4 w-4" />
                          </button>
                        )}
                        <button className="btn-ghost p-2" onClick={() => apri(v)} aria-label={`Modifica ${v.nome}`}>
                          <Icon name="edit" className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </TabellaScroll>
        </section>
      ))}

      <ImpostazioniListino key={JSON.stringify(dati.impostazioni)} impostazioni={dati.impostazioni} onSalvato={ricarica} />

      <Modale aperta={modale !== null} titolo={modale?.nuova ? 'Nuova voce' : 'Modifica voce'} onChiudi={() => setModale(null)}>
        {f && (
          <form onSubmit={salva} className="space-y-4">
            {erroreForm && <MessaggioErrore>{erroreForm}</MessaggioErrore>}
            <label className="block">
              <span className="label">Nome</span>
              <input className="input" required value={f.nome} onChange={(e) => cambia({ nome: e.target.value })} maxLength={200} />
            </label>
            <label className="block">
              <span className="label">Descrizione breve (la vede il cliente)</span>
              <textarea className="input" rows={2} value={f.descrizione} onChange={(e) => cambia({ descrizione: e.target.value })} maxLength={1000} />
            </label>

            {f.gruppo === 'servizio_esterno' ? (
              <label className="block">
                <span className="label">Costo indicativo (testo libero)</span>
                <input className="input" value={f.costo_testo} onChange={(e) => cambia({ costo_testo: e.target.value })} maxLength={200} placeholder="Es. Pro da $20/mese" />
                <span className="mt-1 block text-xs text-slate-500">Scrivi valuta e periodo come vuoi che li legga il cliente. Non viene sommato al preventivo.</span>
              </label>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="label">Tipo di prezzo</span>
                  <select className="input" value={f.modalita} onChange={(e) => cambia({ modalita: e.target.value as ModalitaPrezzo })} disabled={f.codice === CODICE_PAGINA_AGGIUNTIVA}>
                    {(Object.keys(ETICHETTE_MODALITA) as ModalitaPrezzo[])
                      .filter((m) => f.gruppo === 'tipologia' || m !== 'preventivo' || f.modalita === 'preventivo')
                      .map((m) => (
                        <option key={m} value={m}>{ETICHETTE_MODALITA[m]}</option>
                      ))}
                  </select>
                </label>
                {f.modalita !== 'preventivo' && (
                  <label className="block">
                    <span className="label">{f.modalita === 'da' ? 'Prezzo di partenza (€)' : 'Prezzo (€)'}</span>
                    <input className="input" inputMode="decimal" value={f.prezzo} onChange={(e) => cambia({ prezzo: e.target.value })} />
                  </label>
                )}
              </div>
            )}
            {f.modalita !== 'fisso' && f.gruppo !== 'servizio_esterno' && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                Le richieste che includono questa voce risulteranno «da approvare a mano»: il cliente potrà pagare solo dopo la tua conferma.
              </p>
            )}

            {f.gruppo === 'tipologia' && f.modalita !== 'preventivo' && (
              <>
                <label className="block max-w-xs">
                  <span className="label">Pagine incluse nel prezzo</span>
                  <input className="input" inputMode="numeric" value={f.pagine_incluse} onChange={(e) => cambia({ pagine_incluse: e.target.value })} />
                  <span className="mt-1 block text-xs text-slate-500">Ogni pagina oltre queste si paga con il prezzo di «Pagina aggiuntiva».</span>
                </label>
                <fieldset>
                  <legend className="label">Funzionalità già comprese nel prezzo</legend>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {extraSelezionabili.map((x) => (
                      <label key={x.codice} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand-600"
                          checked={f.incluse.includes(x.codice)}
                          onChange={(e) => cambia({ incluse: e.target.checked ? [...f.incluse, x.codice] : f.incluse.filter((c) => c !== x.codice) })}
                        />
                        {x.nome}
                      </label>
                    ))}
                  </div>
                  <span className="mt-1 block text-xs text-slate-500">Se il cliente le sceglie, risultano «Inclusa» e non vengono addebitate due volte.</span>
                </fieldset>
              </>
            )}

            {f.gruppo === 'extra' && f.codice !== CODICE_PAGINA_AGGIUNTIVA && (
              <label className="flex items-center gap-3">
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.a_quantita} onChange={(e) => cambia({ a_quantita: e.target.checked })} />
                <span className="text-sm font-medium text-slate-700">Si può scegliere più volte (es. una per ogni lingua)</span>
              </label>
            )}

            {f.gruppo !== 'servizio_esterno' && (
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={f.in_prova} onChange={(e) => cambia({ in_prova: e.target.checked })} />
                <span className="text-sm">
                  <span className="font-medium text-slate-700">Disponibile anche nella «Prova un mese»</span>
                  <span className="block text-xs text-slate-500">
                    {f.gruppo === 'extra'
                      ? "Se la togli, il cliente non può sceglierla durante la prova (nell'acquisto normale resta disponibile). Nella prova ha lo sconto."
                      : 'Se la togli, questo tipo di sito non si può provare per un mese (resta acquistabile normalmente).'}
                  </span>
                </span>
              </label>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">Posizione nell&apos;elenco</span>
                <input className="input" inputMode="numeric" value={f.ordine} onChange={(e) => cambia({ ordine: e.target.value })} />
              </label>
              <label className="flex items-center gap-3 self-end pb-2">
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.attivo} disabled={f.codice === CODICE_PAGINA_AGGIUNTIVA} onChange={(e) => cambia({ attivo: e.target.checked })} />
                <span className="text-sm font-medium text-slate-700">Visibile ai clienti</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModale(null)}>Annulla</button>
              <button type="submit" className="btn-primary" disabled={attesa}>
                {attesa && <Spinner className="h-4 w-4" />} Salva
              </button>
            </div>
          </form>
        )}
      </Modale>
    </div>
  )
}
