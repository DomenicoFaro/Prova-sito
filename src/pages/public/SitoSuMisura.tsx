import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Seo } from '../../components/Seo'
import { Caricamento, MessaggioErrore, Spinner } from '../../components/ui'
import {
  AVVISO_PREVENTIVO_PREDEFINITO,
  AVVISO_SERVIZI_PREDEFINITO,
  bozzaVuota,
  cancellaBozza,
  caricaAllegato,
  caricaConfiguratore,
  calcolaPreventivo,
  CODICE_PAGINA_AGGIUNTIVA,
  erroreAllegato,
  FASCE_BUDGET,
  formatPrezzoVoce,
  leggiBozza,
  MAX_ALLEGATI,
  MAX_PAGINE,
  MAX_QUANTITA,
  OPZIONI_SCADENZA,
  salvaBozza,
  type AllegatoCaricato,
  type Bozza,
  type VoceConfiguratore,
} from '../../lib/configuratore'
import { formatEuro } from '../../lib/format'
import { ordiniSalvati, salvaOrdine } from '../../lib/ordini'
import { messaggioErrore, supabase } from '../../lib/supabase'
import { useQuery } from '../../lib/useQuery'

const PASSI = ['I tuoi dati', 'Il tuo sito', 'Personalizzazione', 'Preventivo', 'Conferma'] as const
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function Campo({ etichetta, children, nota }: { etichetta: string; children: ReactNode; nota?: string }) {
  return (
    <label className="block">
      <span className="label">{etichetta}</span>
      {children}
      {nota && <span className="mt-1 block text-xs text-slate-500">{nota}</span>}
    </label>
  )
}

/** Prezzo di una funzionalità extra: "+ 39 €" oppure "da 199 €" (quando va confermato). */
function prezzoExtra(v: VoceConfiguratore) {
  if (v.modalita === 'preventivo' || v.prezzo == null) return 'Su preventivo'
  return v.modalita === 'da' ? formatPrezzoVoce(v) : formatPrezzoVoce(v, '+ ')
}

function Indicatore({ passo, onVai }: { passo: number; onVai: (p: number) => void }) {
  return (
    <nav aria-label="Avanzamento" className="mb-8">
      <p className="mb-2 text-sm font-semibold text-slate-700 sm:hidden">
        Passaggio {passo} di {PASSI.length}: {PASSI[passo - 1]}
      </p>
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {PASSI.map((nome, i) => {
          const n = i + 1
          const fatto = n < passo
          const attivo = n === passo
          return (
            <li key={nome} className="flex min-w-0 flex-1 flex-col gap-2">
              <button
                type="button"
                disabled={!fatto}
                onClick={() => onVai(n)}
                aria-current={attivo ? 'step' : undefined}
                aria-label={`${n}. ${nome}${fatto ? ' (completato, torna qui)' : ''}`}
                className={`h-1.5 w-full rounded-full transition-colors duration-300 ${
                  fatto ? 'cursor-pointer bg-brand-600 hover:bg-brand-700' : attivo ? 'bg-brand-500' : 'bg-slate-200'
                }`}
              />
              <span className={`hidden truncate text-xs font-semibold sm:block ${attivo ? 'text-slate-900' : fatto ? 'text-brand-700' : 'text-slate-400'}`}>
                {n}. {nome}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default function SitoSuMisura() {
  const navigate = useNavigate()
  const [b, setB] = useState<Bozza>(leggiBozza)
  const [errore, setErrore] = useState<string | null>(null)
  const [invio, setInvio] = useState(false)
  const [upload, setUpload] = useState(false)
  const [erroreUpload, setErroreUpload] = useState<string | null>(null)
  const [esca, setEsca] = useState('')
  const titolo = useRef<HTMLHeadingElement>(null)
  const precedenti = ordiniSalvati()

  const { dati, caricamento, errore: erroreListino, ricarica } = useQuery(caricaConfiguratore)

  useEffect(() => salvaBozza(b), [b])

  // A ogni cambio di passaggio: porta l'attenzione sul titolo (utile con tastiera e lettori di schermo)
  const primo = useRef(true)
  useEffect(() => {
    if (primo.current) {
      primo.current = false
      return
    }
    titolo.current?.focus()
    titolo.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [b.passo])

  const set = (patch: Partial<Bozza>) => setB((x) => ({ ...x, ...patch }))

  const tipologie = useMemo(() => (dati?.voci ?? []).filter((v) => v.gruppo === 'tipologia'), [dati])
  const extra = useMemo(
    () => (dati?.voci ?? []).filter((v) => v.gruppo === 'extra' && v.codice !== CODICE_PAGINA_AGGIUNTIVA),
    [dati],
  )
  const servizi = useMemo(() => (dati?.voci ?? []).filter((v) => v.gruppo === 'servizio_esterno'), [dati])
  const tipologia = tipologie.find((t) => t.codice === b.tipologia) ?? null
  const prezzoPagina = dati?.voci.find((v) => v.codice === CODICE_PAGINA_AGGIUNTIVA)?.prezzo ?? null

  const preventivo = useMemo(
    () => (dati ? calcolaPreventivo(dati.voci, dati.impostazioni, { tipologia: b.tipologia, pagine: b.pagine, extra: b.extra }) : null),
    [dati, b.tipologia, b.pagine, b.extra],
  )

  function valida(passo: number): string | null {
    if (passo >= 1) {
      if (b.cliente_nome.trim().length < 2) return 'Inserisci il tuo nome o la ragione sociale.'
      if (!EMAIL.test(b.cliente_email.trim())) return 'Inserisci un indirizzo email valido.'
      if (b.cliente_codice.trim().length < 5) return 'Inserisci codice fiscale o partita IVA (servono per il contratto).'
      if (b.cliente_indirizzo.trim().length < 5) return "Inserisci l'indirizzo di residenza o sede (serve per il contratto)."
    }
    if (passo >= 2) {
      if (!tipologia) return 'Scegli il tipo di sito.'
      if (!Number.isInteger(b.pagine) || b.pagine < 1 || b.pagine > MAX_PAGINE) return `Il numero di pagine deve essere tra 1 e ${MAX_PAGINE}.`
      if (b.descrizione.trim().length < 10) return 'Descrivi brevemente il sito che hai in mente (almeno 10 caratteri).'
    }
    return null
  }

  function vai(passo: number) {
    setErrore(null)
    set({ passo })
  }

  function avanti() {
    const e = valida(b.passo)
    if (e) return setErrore(e)
    vai(Math.min(b.passo + 1, PASSI.length))
  }

  function scegliTipologia(t: VoceConfiguratore) {
    set({ tipologia: t.codice, pagine: Math.max(b.pagine, t.pagine_incluse, 1) })
  }

  function cambiaQuantita(codice: string, q: number, max = MAX_QUANTITA) {
    setB((x) => {
      const prossimo = { ...x.extra }
      const valore = Math.min(Math.max(q, 0), max)
      if (valore <= 0) delete prossimo[codice]
      else prossimo[codice] = valore
      return { ...x, extra: prossimo }
    })
  }

  async function sceltaFile(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setErroreUpload(null)
    if (b.allegati.length + files.length > MAX_ALLEGATI) return setErroreUpload(`Puoi allegare al massimo ${MAX_ALLEGATI} file.`)
    for (const f of files) {
      const problema = erroreAllegato(f)
      if (problema) return setErroreUpload(problema)
    }
    setUpload(true)
    try {
      const caricati: AllegatoCaricato[] = []
      for (const f of files) caricati.push(await caricaAllegato(b.cartella, f))
      setB((x) => ({ ...x, allegati: [...x.allegati, ...caricati] }))
    } catch (err) {
      setErroreUpload(messaggioErrore(err))
    } finally {
      setUpload(false)
    }
  }

  async function invia() {
    if (esca) return // campo esca per i bot
    const e = valida(2)
    if (e) {
      setErrore(e)
      return
    }
    setErrore(null)
    setInvio(true)
    try {
      const { data, error } = await supabase.rpc('crea_richiesta_sito', {
        p: {
          cliente_nome: b.cliente_nome.trim(),
          cliente_email: b.cliente_email.trim(),
          cliente_telefono: b.cliente_telefono.trim(),
          cliente_codice: b.cliente_codice.trim(),
          cliente_indirizzo: b.cliente_indirizzo.trim(),
          tipologia: b.tipologia,
          nome_attivita: b.nome_attivita.trim(),
          pagine: b.pagine,
          lingue: b.lingue.trim(),
          dominio: b.dominio.trim(),
          stile: b.stile.trim(),
          descrizione: b.descrizione.trim(),
          extra: b.extra,
          budget: b.budget,
          scadenza_tipo: b.scadenza_tipo,
          cartella: b.cartella,
          allegati: b.allegati.map((a) => a.path),
        },
      })
      if (error) throw error
      const token = String(data)
      salvaOrdine({ token, nome: b.nome_attivita.trim() || tipologia?.nome || 'Il mio sito', data: new Date().toISOString() })
      cancellaBozza()
      navigate(`/ordine/${token}?nuovo=1`)
    } catch (err) {
      setErrore(messaggioErrore(err))
      setInvio(false)
    }
  }

  function ricomincia() {
    const nuova = bozzaVuota()
    setB(nuova)
    setErrore(null)
    setErroreUpload(null)
  }

  const avvisoPreventivo = dati?.impostazioni.avviso_preventivo || AVVISO_PREVENTIVO_PREDEFINITO
  const avvisoServizi = dati?.impostazioni.avviso_servizi_esterni || AVVISO_SERVIZI_PREDEFINITO
  const urgente = b.scadenza_tipo === 'urgente'
  const suffisso = preventivo?.approvazione_manuale ? ' (parziale)' : ''

  return (
    <>
      <Seo titolo="Acquista il tuo sito" />
      <section className="bg-black pt-10 pb-12 text-center text-white">
        <div className="container-sito">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Il tuo sito, su misura</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            Scegli il tipo di sito e le funzioni che ti servono: vedi subito un preventivo indicativo. FormaWeb lo conferma, poi leggi il
            contratto, accetti e paghi online.
          </p>
        </div>
      </section>

      <div className="container-sito pt-10 pb-28">
        {precedenti.length > 0 && (
          <div className="card mx-auto mb-8 max-w-3xl p-5">
            <h2 className="font-semibold text-slate-900">Le tue richieste su questo dispositivo</h2>
            <ul className="mt-2 divide-y divide-slate-100">
              {precedenti.map((o) => (
                <li key={o.token} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="truncate text-slate-700">{o.nome}</span>
                  <Link to={`/ordine/${o.token}`} className="font-semibold text-brand-600 hover:underline">
                    Apri
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mx-auto max-w-3xl">
          <Indicatore passo={b.passo} onVai={vai} />

          {caricamento ? (
            <Caricamento testo="Carico il listino…" />
          ) : erroreListino || !dati ? (
            <MessaggioErrore onRiprova={ricarica}>
              Non è stato possibile caricare il listino. {erroreListino}
            </MessaggioErrore>
          ) : (
            <div key={b.passo} className="passo-entra space-y-6">
              <h2 ref={titolo} tabIndex={-1} className="text-xl font-bold text-slate-900 outline-none">
                {b.passo}. {PASSI[b.passo - 1]}
              </h2>

              {/* ---------------------------------------------------------------- 1 */}
              {b.passo === 1 && (
                <fieldset className="card space-y-4 p-5 sm:p-6">
                  <legend className="sr-only">I tuoi dati</legend>
                  <p className="text-sm text-slate-500">Compaiono nel contratto, quindi inseriscili esattamente come devono risultare.</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo etichetta="Nome e cognome / ragione sociale *">
                      <input value={b.cliente_nome} onChange={(e) => set({ cliente_nome: e.target.value })} maxLength={200} className="input" autoComplete="name" />
                    </Campo>
                    <Campo etichetta="Email *">
                      <input type="email" value={b.cliente_email} onChange={(e) => set({ cliente_email: e.target.value })} maxLength={320} className="input" autoComplete="email" />
                    </Campo>
                    <Campo etichetta="Telefono">
                      <input type="tel" value={b.cliente_telefono} onChange={(e) => set({ cliente_telefono: e.target.value })} maxLength={50} className="input" autoComplete="tel" />
                    </Campo>
                    <Campo etichetta="Codice fiscale o P.IVA *">
                      <input value={b.cliente_codice} onChange={(e) => set({ cliente_codice: e.target.value })} maxLength={50} className="input" />
                    </Campo>
                  </div>
                  <Campo etichetta="Indirizzo di residenza o sede *">
                    <input value={b.cliente_indirizzo} onChange={(e) => set({ cliente_indirizzo: e.target.value })} maxLength={300} className="input" autoComplete="street-address" />
                  </Campo>
                </fieldset>
              )}

              {/* ---------------------------------------------------------------- 2 */}
              {b.passo === 2 && (
                <>
                  <fieldset className="space-y-3">
                    <legend className="mb-1 text-sm font-medium text-slate-700">Che tipo di sito ti serve? *</legend>
                    <div role="radiogroup" aria-label="Tipo di sito" className="grid gap-3 sm:grid-cols-2">
                      {tipologie.map((t) => {
                        const scelto = t.codice === b.tipologia
                        return (
                          <label
                            key={t.codice}
                            className={`relative flex cursor-pointer flex-col gap-1.5 rounded-2xl border bg-white p-4 transition duration-200 focus-within:ring-4 focus-within:ring-brand-500/20 ${
                              scelto ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm'
                            }`}
                          >
                            <input type="radio" name="tipologia" checked={scelto} onChange={() => scegliTipologia(t)} className="sr-only" />
                            <span className="flex items-start justify-between gap-3">
                              <span className="font-semibold text-slate-900">{t.nome}</span>
                              {scelto && <Icon name="check" className="h-5 w-5 shrink-0 text-brand-600" />}
                            </span>
                            <span className="text-lg font-extrabold text-slate-900 tabular-nums">{formatPrezzoVoce(t)}</span>
                            <span className="text-sm text-slate-600">{t.descrizione}</span>
                            {t.modalita !== 'preventivo' && t.pagine_incluse > 0 && (
                              <span className="text-xs text-slate-500">
                                {t.pagine_incluse === 1 ? '1 pagina inclusa' : `${t.pagine_incluse} pagine incluse`}
                              </span>
                            )}
                            {t.modalita === 'da' && <span className="text-xs font-medium text-amber-700">Prezzo di partenza, da confermare</span>}
                            {t.modalita === 'preventivo' && <span className="text-xs font-medium text-amber-700">Richiede approvazione manuale</span>}
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>

                  <fieldset className="card space-y-4 p-5 sm:p-6">
                    <legend className="sr-only">Dettagli del sito</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Campo etichetta="Nome dell'attività / del progetto">
                        <input value={b.nome_attivita} onChange={(e) => set({ nome_attivita: e.target.value })} maxLength={200} className="input" />
                      </Campo>
                      <Campo
                        etichetta="Quante pagine?"
                        nota={
                          tipologia && tipologia.modalita !== 'preventivo'
                            ? `${tipologia.pagine_incluse} incluse${prezzoPagina != null ? `, poi ${formatEuro(prezzoPagina).replace(/,00(?=\s)/, '')} per ogni pagina in più` : ''}.`
                            : undefined
                        }
                      >
                        <div className="flex items-center gap-2">
                          <button type="button" className="btn-secondary h-11 w-11 p-0" aria-label="Una pagina in meno" disabled={b.pagine <= 1} onClick={() => set({ pagine: Math.max(1, b.pagine - 1) })}>
                            −
                          </button>
                          <input
                            inputMode="numeric"
                            aria-label="Numero di pagine"
                            value={b.pagine}
                            onChange={(e) => {
                              const n = Number(e.target.value.replace(/\D/g, ''))
                              set({ pagine: Math.min(n, MAX_PAGINE) })
                            }}
                            onBlur={() => b.pagine < 1 && set({ pagine: 1 })}
                            className="input h-11 text-center"
                          />
                          <button type="button" className="btn-secondary h-11 w-11 p-0" aria-label="Una pagina in più" disabled={b.pagine >= MAX_PAGINE} onClick={() => set({ pagine: Math.min(MAX_PAGINE, b.pagine + 1) })}>
                            +
                          </button>
                        </div>
                      </Campo>
                      <Campo etichetta="Lingue del sito">
                        <input value={b.lingue} onChange={(e) => set({ lingue: e.target.value })} maxLength={200} placeholder="Es. italiano, inglese" className="input" />
                      </Campo>
                      <Campo etichetta="Dominio (se ce l'hai)">
                        <input value={b.dominio} onChange={(e) => set({ dominio: e.target.value })} maxLength={300} placeholder="miosito.it" className="input" />
                      </Campo>
                    </div>
                    <Campo etichetta="Descrivi il sito che hai in mente *" nota="Cosa fa la tua attività, chi sono i clienti, cosa deve ottenere il sito.">
                      <textarea value={b.descrizione} onChange={(e) => set({ descrizione: e.target.value })} maxLength={5000} rows={5} className="input" />
                    </Campo>
                    <Campo etichetta="Stile e siti che ti piacciono" nota="Colori, atmosfera, link a siti di riferimento.">
                      <textarea value={b.stile} onChange={(e) => set({ stile: e.target.value })} maxLength={2000} rows={3} className="input" />
                    </Campo>
                  </fieldset>
                </>
              )}

              {/* ---------------------------------------------------------------- 3 */}
              {b.passo === 3 && (
                <>
                  <fieldset className="card space-y-3 p-5 sm:p-6">
                    <legend className="text-base font-bold text-slate-900">Funzionalità aggiuntive</legend>
                    <p className="text-sm text-slate-500">Scegli quelle che ti servono: il totale si aggiorna subito. Quelle già comprese nel tuo sito non si pagano due volte.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {extra.map((v) => {
                        const inclusa = tipologia?.incluse.includes(v.codice) ?? false
                        const quantita = b.extra[v.codice] ?? 0
                        const scelta = inclusa || quantita > 0
                        return (
                          <div
                            key={v.codice}
                            className={`rounded-xl border p-3 transition duration-200 ${scelta ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300'}`}
                          >
                            <label className={`flex items-start gap-2.5 ${inclusa ? 'cursor-default' : 'cursor-pointer'}`}>
                              <input
                                type="checkbox"
                                checked={scelta}
                                disabled={inclusa}
                                onChange={() => cambiaQuantita(v.codice, quantita > 0 ? 0 : 1)}
                                className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline justify-between gap-2">
                                  <span className="text-sm font-semibold text-slate-900">{v.nome}</span>
                                  <span className="shrink-0 text-sm font-semibold text-slate-700 tabular-nums">{inclusa ? 'Inclusa' : prezzoExtra(v)}</span>
                                </span>
                                <span className="mt-0.5 block text-xs text-slate-600">{v.descrizione}</span>
                                {v.modalita === 'da' && !inclusa && <span className="mt-0.5 block text-xs font-medium text-amber-700">Prezzo indicativo, da confermare</span>}
                              </span>
                            </label>
                            {v.a_quantita && quantita > 0 && !inclusa && (
                              <div className="mt-2 ml-6.5 flex items-center gap-2 text-sm">
                                <span className="text-slate-600">Quante?</span>
                                <button type="button" className="btn-secondary h-8 w-8 p-0" aria-label={`Una ${v.nome.toLowerCase()} in meno`} onClick={() => cambiaQuantita(v.codice, quantita - 1)}>
                                  −
                                </button>
                                <span className="w-6 text-center font-semibold tabular-nums" aria-live="polite">{quantita}</span>
                                <button type="button" className="btn-secondary h-8 w-8 p-0" aria-label={`Una ${v.nome.toLowerCase()} in più`} disabled={quantita >= MAX_QUANTITA} onClick={() => cambiaQuantita(v.codice, quantita + 1)}>
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </fieldset>

                  <fieldset className="card space-y-3 p-5 sm:p-6">
                    <legend className="text-base font-bold text-slate-900">Il tuo budget</legend>
                    <p className="text-sm text-slate-500">Serve solo a capirti meglio: non cambia il preventivo.</p>
                    <div role="radiogroup" aria-label="Budget" className="grid gap-2 sm:grid-cols-2">
                      {FASCE_BUDGET.map((f) => (
                        <label
                          key={f}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition ${
                            b.budget === f ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <input type="radio" name="budget" checked={b.budget === f} onChange={() => set({ budget: f })} className="h-4 w-4 accent-brand-600" />
                          {f}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="card space-y-3 p-5 sm:p-6">
                    <legend className="text-base font-bold text-slate-900">Tempi di consegna</legend>
                    <div role="radiogroup" aria-label="Tempi di consegna" className="space-y-2">
                      {OPZIONI_SCADENZA.map((o) => (
                        <label
                          key={o.valore}
                          className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition ${
                            b.scadenza_tipo === o.valore ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <input type="radio" name="scadenza" checked={b.scadenza_tipo === o.valore} onChange={() => set({ scadenza_tipo: o.valore })} className="mt-0.5 h-4 w-4 accent-brand-600" />
                          <span>
                            <span className="font-semibold text-slate-900">{o.titolo}</span>
                            <span className="block text-xs text-slate-600">
                              {o.valore === 'urgente' && preventivo
                                ? `Supplemento indicativo del ${preventivo.urgenza_percentuale}% (circa ${formatEuro(preventivo.urgenza_importo)}), solo previa conferma di FormaWeb.`
                                : o.nota}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">Non promettiamo date automaticamente: i tempi vengono concordati nel preventivo.</p>
                  </fieldset>

                  <fieldset className="card space-y-3 p-5 sm:p-6">
                    <legend className="text-base font-bold text-slate-900">Materiali (facoltativi)</legend>
                    <p className="text-sm text-slate-500">
                      Logo, immagini, testi o documenti. Immagini (PNG, JPG, WebP), PDF, Word o testo; massimo {MAX_ALLEGATI} file da 5 MB. Li vede
                      solo FormaWeb.
                    </p>
                    <label className={`btn-secondary cursor-pointer ${upload || b.allegati.length >= MAX_ALLEGATI ? 'pointer-events-none opacity-60' : ''}`}>
                      {upload ? <Spinner className="h-4 w-4" /> : <Icon name="upload" className="h-4 w-4" />} {upload ? 'Carico…' : 'Aggiungi file'}
                      <input
                        type="file"
                        multiple
                        accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,.doc,.docx"
                        className="sr-only"
                        disabled={upload || b.allegati.length >= MAX_ALLEGATI}
                        onChange={sceltaFile}
                      />
                    </label>
                    {erroreUpload && <MessaggioErrore>{erroreUpload}</MessaggioErrore>}
                    {b.allegati.length > 0 && (
                      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                        {b.allegati.map((a) => (
                          <li key={a.path} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <span className="flex min-w-0 items-center gap-2">
                              <Icon name="file" className="h-4 w-4 shrink-0 text-slate-400" />
                              <span className="truncate text-slate-700">{a.nome}</span>
                              <span className="shrink-0 text-xs text-slate-400">{(a.dimensione / 1024 / 1024).toFixed(2).replace('.', ',')} MB</span>
                            </span>
                            <button type="button" className="btn-ghost p-1.5 text-red-600" aria-label={`Togli ${a.nome}`} onClick={() => set({ allegati: b.allegati.filter((x) => x.path !== a.path) })}>
                              <Icon name="close" className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </fieldset>
                </>
              )}

              {/* ---------------------------------------------------------------- 4 */}
              {b.passo === 4 && preventivo && (
                <>
                  <div className="card p-5 sm:p-6">
                    <h3 className="text-base font-bold text-slate-900">Riepilogo del preventivo</h3>
                    <dl className="mt-4 divide-y divide-slate-100 text-sm">
                      <div className="flex justify-between gap-4 py-2.5">
                        <dt className="text-slate-700">
                          <span className="font-semibold text-slate-900">{preventivo.tipologia.nome}</span>
                          <span className="block text-xs text-slate-500">Prezzo base{preventivo.tipologia.modalita === 'da' ? ' di partenza' : ''}</span>
                        </dt>
                        <dd className="shrink-0 font-semibold tabular-nums">{preventivo.tipologia.modalita === 'preventivo' ? 'Su preventivo' : formatPrezzoVoce({ prezzo: preventivo.tipologia.prezzo, modalita: preventivo.tipologia.modalita })}</dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2.5">
                        <dt className="text-slate-700">
                          Pagine: {preventivo.pagine}
                          <span className="block text-xs text-slate-500">
                            {preventivo.tipologia.modalita === 'preventivo'
                              ? 'Valutate nel preventivo'
                              : preventivo.pagine_extra > 0
                                ? `${preventivo.pagine_incluse} incluse + ${preventivo.pagine_extra} aggiuntive`
                                : `${preventivo.pagine_incluse} incluse`}
                          </span>
                        </dt>
                        <dd className="shrink-0 tabular-nums">{preventivo.pagine_extra_importo > 0 ? formatEuro(preventivo.pagine_extra_importo) : '—'}</dd>
                      </div>
                      {preventivo.righe.map((r) => (
                        <div key={r.codice} className="flex justify-between gap-4 py-2.5">
                          <dt className="text-slate-700">
                            {r.nome}
                            {r.quantita > 1 ? ` × ${r.quantita}` : ''}
                            {r.modalita !== 'fisso' && !r.incluso && <span className="block text-xs text-amber-700">Prezzo indicativo, da confermare</span>}
                          </dt>
                          <dd className="shrink-0 tabular-nums">{r.incluso ? <span className="text-emerald-700">Inclusa</span> : formatEuro(r.importo)}</dd>
                        </div>
                      ))}
                      <div className="flex justify-between gap-4 py-2.5">
                        <dt className="font-semibold text-slate-900">Subtotale realizzazione</dt>
                        <dd className="font-semibold tabular-nums">{formatEuro(preventivo.subtotale)}</dd>
                      </div>
                      {urgente && (
                        <div className="flex justify-between gap-4 py-2.5">
                          <dt className="text-slate-700">
                            Consegna urgente richiesta
                            <span className="block text-xs text-slate-500">
                              Supplemento indicativo del {preventivo.urgenza_percentuale}%: non incluso nel totale finché FormaWeb non lo conferma.
                            </span>
                          </dt>
                          <dd className="shrink-0 text-slate-500 tabular-nums">circa {formatEuro(preventivo.urgenza_importo)}</dd>
                        </div>
                      )}
                    </dl>
                    <div className="mt-3 flex items-baseline justify-between gap-4 rounded-xl bg-slate-900 px-4 py-3 text-white">
                      <span className="font-semibold">Totale indicativo{suffisso}</span>
                      <span className="text-2xl font-extrabold tabular-nums" aria-live="polite">
                        {preventivo.approvazione_manuale ? 'da ' : ''}
                        {formatEuro(preventivo.totale)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{avvisoPreventivo}</p>
                  </div>

                  {preventivo.approvazione_manuale && (
                    <div role="note" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
                      <p>
                        <strong>Richiede approvazione manuale.</strong> Il tuo progetto include una voce personalizzata o con prezzo «da». FormaWeb
                        verificherà la richiesta e ti confermerà l&apos;importo definitivo: fino ad allora <strong>il pagamento non sarà disponibile</strong>.
                      </p>
                    </div>
                  )}

                  {servizi.length > 0 && (
                    <div className="card p-5 sm:p-6">
                      <h3 className="text-base font-bold text-slate-900">Servizi esterni e costi di gestione</h3>
                      <p className="mt-1 text-sm text-slate-600">Costi ricorrenti dei servizi collegati al sito. Sono indicativi e separati: non fanno parte del totale qui sopra.</p>
                      <dl className="mt-3 divide-y divide-slate-100 text-sm">
                        {servizi.map((s) => (
                          <div key={s.codice} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-4">
                            <dt className="text-slate-800">
                              <span className="font-semibold">{s.nome}</span>
                              {s.descrizione && <span className="text-slate-500"> — {s.descrizione}</span>}
                            </dt>
                            <dd className="shrink-0 text-slate-700 sm:text-right">{s.costo_testo || '—'}</dd>
                          </div>
                        ))}
                      </dl>
                      <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{avvisoServizi}</p>
                    </div>
                  )}
                </>
              )}

              {/* ---------------------------------------------------------------- 5 */}
              {b.passo === 5 && preventivo && (
                <>
                  <div className="card space-y-4 p-5 sm:p-6">
                    <h3 className="text-base font-bold text-slate-900">Controlla la tua richiesta</h3>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      {(
                        [
                          ['Nome', b.cliente_nome],
                          ['Email', b.cliente_email],
                          ['Telefono', b.cliente_telefono],
                          ['CF / P.IVA', b.cliente_codice],
                          ['Indirizzo', b.cliente_indirizzo],
                          ['Tipo di sito', preventivo.tipologia.nome],
                          ['Attività', b.nome_attivita],
                          ['Pagine', String(preventivo.pagine)],
                          ['Funzionalità', preventivo.righe.map((r) => r.nome + (r.quantita > 1 ? ` × ${r.quantita}` : '')).join(', ')],
                          ['Budget', b.budget],
                          ['Consegna', OPZIONI_SCADENZA.find((o) => o.valore === b.scadenza_tipo)?.titolo ?? ''],
                          ['File allegati', b.allegati.length ? String(b.allegati.length) : ''],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-xs text-slate-500">{k}</dt>
                          <dd className="mt-0.5 font-medium break-words text-slate-900">{v || '—'}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="flex items-baseline justify-between gap-4 rounded-xl bg-slate-900 px-4 py-3 text-white">
                      <span className="font-semibold">Totale indicativo{suffisso}</span>
                      <span className="text-xl font-extrabold tabular-nums">
                        {preventivo.approvazione_manuale ? 'da ' : ''}
                        {formatEuro(preventivo.totale)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{avvisoPreventivo}</p>
                  </div>

                  <div className="card p-5 sm:p-6">
                    <h3 className="text-base font-bold text-slate-900">Cosa succede dopo</h3>
                    <ol className="mt-3 space-y-2.5 text-sm text-slate-700">
                      <li className="flex gap-3"><span className="font-bold text-brand-600">1.</span> Invii la richiesta: non ti impegna a nulla.</li>
                      <li className="flex gap-3"><span className="font-bold text-brand-600">2.</span> FormaWeb la verifica e ti conferma l&apos;importo definitivo.</li>
                      <li className="flex gap-3"><span className="font-bold text-brand-600">3.</span> Dalla pagina del tuo ordine leggi il contratto, già compilato con i tuoi dati.</li>
                      <li className="flex gap-3"><span className="font-bold text-brand-600">4.</span> Lo accetti, paghi online in sicurezza e ricevi il contratto.</li>
                    </ol>
                    <p className="mt-3 text-xs text-slate-500">Il pagamento diventa disponibile solo dopo la conferma dell&apos;importo da parte di FormaWeb.</p>
                  </div>

                  {/* Esca anti-bot: i visitatori non la vedono */}
                  <input name="sito_web" value={esca} onChange={(e) => setEsca(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                </>
              )}

              {errore && <MessaggioErrore>{errore}</MessaggioErrore>}

              <div className="flex items-center justify-between gap-3">
                {b.passo > 1 ? (
                  <button type="button" className="btn-secondary" onClick={() => vai(b.passo - 1)} disabled={invio}>
                    <Icon name="arrowLeft" className="h-4 w-4" /> Indietro
                  </button>
                ) : (
                  <button type="button" className="btn-ghost text-xs text-slate-500" onClick={ricomincia}>
                    Cancella i dati inseriti
                  </button>
                )}
                {b.passo < PASSI.length ? (
                  <button type="button" className="btn-primary px-6 py-3 text-base" onClick={avanti} disabled={upload}>
                    Avanti <Icon name="arrowRight" className="h-4 w-4" />
                  </button>
                ) : (
                  <button type="button" className="btn-primary px-6 py-3 text-base" onClick={invia} disabled={invio}>
                    {invio ? <Spinner className="h-4 w-4" /> : <Icon name="arrowRight" className="h-4 w-4" />} Invia la richiesta
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Totale sempre visibile mentre scegli tipo di sito e funzionalità */}
      {preventivo && (b.passo === 2 || b.passo === 3) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur" role="status" aria-live="polite">
          <div className="container-sito flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-xs text-slate-500">{preventivo.tipologia.nome} · {preventivo.pagine} {preventivo.pagine === 1 ? 'pagina' : 'pagine'}</p>
              <p className="text-xs text-slate-500">{preventivo.approvazione_manuale ? 'Totale indicativo parziale' : 'Totale indicativo'}</p>
            </div>
            <p className="text-xl font-extrabold text-slate-900 tabular-nums">
              {preventivo.approvazione_manuale ? 'da ' : ''}
              {formatEuro(preventivo.totale)}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
