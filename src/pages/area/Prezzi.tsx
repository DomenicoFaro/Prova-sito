import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { Icon } from '../../components/Icon'
import { Caricamento, IntestazionePagina, MessaggioErrore, MessaggioSuccesso, Modale, Spinner, Vuoto } from '../../components/ui'
import { formatPrezzoListino, parseNumero } from '../../lib/format'
import { messaggioErrore, supabase } from '../../lib/supabase'
import type { Prezzo, TipoPrezzo } from '../../lib/types'
import { esegui, useQuery } from '../../lib/useQuery'

interface FormPrezzo {
  tipo: TipoPrezzo
  nome: string
  descrizione: string
  prezzo: string
  prezzo_max: string
  valuta: '€' | '$'
  a_partire_da: boolean
  periodicita: string
  caratteristiche: string
  in_evidenza: boolean
  ordine: string
  attivo: boolean
}

const VUOTO: FormPrezzo = {
  tipo: 'sito',
  nome: '',
  descrizione: '',
  prezzo: '',
  prezzo_max: '',
  valuta: '€',
  a_partire_da: false,
  periodicita: '',
  caratteristiche: '',
  in_evidenza: false,
  ordine: '0',
  attivo: true,
}

const SEZIONI: { tipo: TipoPrezzo; titolo: string }[] = [
  { tipo: 'sito', titolo: 'Siti web' },
  { tipo: 'servizio', titolo: 'Servizi' },
  { tipo: 'abbonamento', titolo: 'Abbonamenti' },
]

/** Gestione del listino: lo modificano admin e soci. Le voci visibili sono pubbliche (pagina /prezzi). */
export default function Prezzi() {
  const { isGestore } = useAuth()
  const [modale, setModale] = useState<'nuovo' | Prezzo | null>(null)
  const [form, setForm] = useState<FormPrezzo>(VUOTO)
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [successo, setSuccesso] = useState<string | null>(null)
  const [daEliminare, setDaEliminare] = useState<Prezzo | null>(null)

  const { dati, caricamento, errore: erroreCaricamento, ricarica } = useQuery(() =>
    esegui<Prezzo[]>(supabase.from('prezzi').select('*').order('ordine').order('prezzo')),
  )

  function set<K extends keyof FormPrezzo>(k: K, v: FormPrezzo[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function apriNuovo(tipo: TipoPrezzo = 'sito') {
    setErrore(null)
    setForm({ ...VUOTO, tipo })
    setModale('nuovo')
  }

  function apriModifica(p: Prezzo) {
    setErrore(null)
    setForm({
      tipo: p.tipo,
      nome: p.nome,
      descrizione: p.descrizione,
      prezzo: String(p.prezzo),
      prezzo_max: p.prezzo_max != null ? String(p.prezzo_max) : '',
      valuta: p.valuta ?? '€',
      a_partire_da: p.a_partire_da,
      periodicita: p.periodicita,
      caratteristiche: (p.caratteristiche ?? []).join('\n'),
      in_evidenza: p.in_evidenza,
      ordine: String(p.ordine),
      attivo: p.attivo,
    })
    setModale(p)
  }

  async function salva(e: FormEvent) {
    e.preventDefault()
    setErrore(null)
    setSuccesso(null)
    const prezzo = parseNumero(form.prezzo)
    const max = form.prezzo_max.trim() ? parseNumero(form.prezzo_max) : null
    const ordine = parseNumero(form.ordine || '0')
    if (!form.nome.trim()) return setErrore('Il nome è obbligatorio.')
    if (!Number.isFinite(prezzo) || prezzo < 0) return setErrore('Prezzo non valido.')
    if (max !== null && (!Number.isFinite(max) || max < prezzo)) return setErrore('Il prezzo massimo deve essere uguale o maggiore del minimo.')
    if (!Number.isInteger(ordine)) return setErrore("L'ordine deve essere un numero intero.")

    setSalvataggio(true)
    try {
      const payload = {
        tipo: form.tipo,
        nome: form.nome.trim(),
        descrizione: form.descrizione.trim(),
        prezzo,
        prezzo_max: max,
        valuta: form.valuta,
        a_partire_da: form.a_partire_da,
        periodicita: form.periodicita.trim(),
        caratteristiche: form.caratteristiche.split('\n').map((x) => x.trim()).filter(Boolean),
        in_evidenza: form.in_evidenza,
        ordine,
        attivo: form.attivo,
      }
      if (modale === 'nuovo') await esegui(supabase.from('prezzi').insert(payload))
      else if (modale) await esegui(supabase.from('prezzi').update(payload).eq('id', modale.id))
      setSuccesso(modale === 'nuovo' ? 'Voce aggiunta al listino.' : 'Voce aggiornata.')
      setModale(null)
      ricarica()
    } catch (err) {
      setErrore(messaggioErrore(err))
    } finally {
      setSalvataggio(false)
    }
  }

  async function elimina() {
    if (!daEliminare) return
    setErrore(null)
    setSuccesso(null)
    const { error } = await supabase.from('prezzi').delete().eq('id', daEliminare.id)
    if (error) setErrore(messaggioErrore(error))
    else setSuccesso(`"${daEliminare.nome}" eliminata dal listino.`)
    setDaEliminare(null)
    ricarica()
  }

  async function toggleAttivo(p: Prezzo) {
    setErrore(null)
    setSuccesso(null)
    const { error } = await supabase.from('prezzi').update({ attivo: !p.attivo }).eq('id', p.id)
    if (error) return setErrore(messaggioErrore(error))
    ricarica()
  }

  return (
    <>
      <IntestazionePagina
        titolo="Prezzi"
        sottotitolo={
          isGestore
            ? 'Il listino è pubblico (pagina Prezzi del sito): le voci nascoste le vedi solo tu e i soci.'
            : 'Il listino dei nostri siti, servizi e abbonamenti. Usalo come riferimento quando parli con un cliente.'
        }
        azioni={
          isGestore && (
            <button className="btn-primary" onClick={() => apriNuovo()}>
              <Icon name="plus" className="h-4 w-4" /> Nuova voce
            </button>
          )
        }
      />

      <div className="mb-4 space-y-3">
        {successo && <MessaggioSuccesso>{successo}</MessaggioSuccesso>}
        {errore && !modale && <MessaggioErrore>{errore}</MessaggioErrore>}
      </div>

      {caricamento ? (
        <Caricamento />
      ) : erroreCaricamento ? (
        <MessaggioErrore onRiprova={ricarica}>{erroreCaricamento}</MessaggioErrore>
      ) : !dati?.length ? (
        <div className="card">
          <Vuoto icona="euro" titolo="Nessun prezzo nel listino">
            {isGestore ? 'Aggiungi la prima voce con "Nuova voce".' : 'Il listino verrà pubblicato a breve.'}
          </Vuoto>
        </div>
      ) : (
        <div className="space-y-8">
          {SEZIONI.map(({ tipo, titolo }) => {
            const voci = dati.filter((p) => p.tipo === tipo)
            if (voci.length === 0) return null
            return (
              <section key={tipo} aria-labelledby={`prezzi-${tipo}`}>
                <h2 id={`prezzi-${tipo}`} className="mb-3 text-lg font-semibold text-slate-900">{titolo}</h2>
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {voci.map((p) => (
                    <li key={p.id} className={`card flex flex-col p-5 ${p.attivo ? '' : 'opacity-60'} ${p.in_evidenza ? 'ring-2 ring-brand-500/30' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{p.nome}</p>
                          {(p.in_evidenza || !p.attivo) && (
                            <p className="mt-1 flex gap-1.5">
                              {p.in_evidenza && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">In evidenza</span>}
                              {!p.attivo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Nascosta</span>}
                            </p>
                          )}
                        </div>
                        {isGestore && (
                          <div className="-mr-2 -mt-1 flex shrink-0">
                            <button className="btn-ghost p-2" onClick={() => toggleAttivo(p)} aria-label={p.attivo ? `Nascondi ${p.nome}` : `Mostra ${p.nome}`}>
                              <Icon name={p.attivo ? 'ban' : 'eye'} className="h-4 w-4" />
                            </button>
                            <button className="btn-ghost p-2" onClick={() => apriModifica(p)} aria-label={`Modifica ${p.nome}`}>
                              <Icon name="edit" className="h-4 w-4" />
                            </button>
                            <button className="btn-ghost p-2 text-red-600" onClick={() => setDaEliminare(p)} aria-label={`Elimina ${p.nome}`}>
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 tabular-nums">{formatPrezzoListino(p)}</p>
                      {p.descrizione && <p className="mt-2 text-sm text-slate-600">{p.descrizione}</p>}
                      {p.caratteristiche.length > 0 && (
                        <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                          {p.caratteristiche.map((c) => (
                            <li key={c} className="flex items-start gap-2">
                              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <Modale aperta={modale !== null} titolo={modale === 'nuovo' ? 'Nuova voce' : 'Modifica voce'} onChiudi={() => setModale(null)}>
        <form onSubmit={salva} className="space-y-4">
          {errore && <MessaggioErrore>{errore}</MessaggioErrore>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="pt">Tipo</label>
              <select id="pt" className="input" value={form.tipo} onChange={(e) => set('tipo', e.target.value as TipoPrezzo)}>
                <option value="sito">Sito web</option>
                <option value="servizio">Servizio</option>
                <option value="abbonamento">Abbonamento</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="po">Ordine</label>
              <input id="po" inputMode="numeric" className="input" value={form.ordine} onChange={(e) => set('ordine', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="pn">Nome</label>
            <input id="pn" className="input" required placeholder="es. Sito vetrina" value={form.nome} onChange={(e) => set('nome', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label" htmlFor="pp">Prezzo</label>
              <input id="pp" inputMode="decimal" className="input" required placeholder="500" value={form.prezzo} onChange={(e) => set('prezzo', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="pm">Fino a (facoltativo)</label>
              <input id="pm" inputMode="decimal" className="input" placeholder="600" value={form.prezzo_max} onChange={(e) => set('prezzo_max', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="pv">Valuta</label>
              <select id="pv" className="input" value={form.valuta} onChange={(e) => set('valuta', e.target.value as '€' | '$')}>
                <option value="€">€ Euro</option>
                <option value="$">$ Dollaro</option>
              </select>
            </div>
          </div>
          <p className="-mt-2 text-xs text-slate-500">Per un intervallo (es. 500–600) compila sia "Prezzo" sia "Fino a".</p>
          <div>
            <label className="label" htmlFor="pper">Periodicità</label>
            <input id="pper" className="input" list="periodicita" placeholder="es. al mese (vuoto = una tantum)" value={form.periodicita} onChange={(e) => set('periodicita', e.target.value)} />
            <datalist id="periodicita">
              {['una tantum', 'al mese', "all'anno"].map((x) => <option key={x} value={x} />)}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="pd">Descrizione</label>
            <textarea id="pd" className="input min-h-20" value={form.descrizione} onChange={(e) => set('descrizione', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="pc">Cosa include (una voce per riga)</label>
            <textarea id="pc" className="input min-h-24" value={form.caratteristiche} onChange={(e) => set('caratteristiche', e.target.value)} />
          </div>
          <div className="space-y-2">
            {([
              ['a_partire_da', 'Mostra "da" davanti al prezzo'],
              ['in_evidenza', 'Metti in evidenza'],
              ['attivo', 'Visibile a tutti (sito pubblico)'],
            ] as const).map(([k, etichetta]) => (
              <label key={k} className="flex items-center gap-3">
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form[k]} onChange={(e) => set(k, e.target.checked)} />
                <span className="text-sm font-medium text-slate-700">{etichetta}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModale(null)}>Annulla</button>
            <button type="submit" className="btn-primary" disabled={salvataggio}>
              {salvataggio && <Spinner className="h-4 w-4" />} Salva
            </button>
          </div>
        </form>
      </Modale>

      <Modale aperta={daEliminare !== null} titolo="Eliminare la voce?" onChiudi={() => setDaEliminare(null)}>
        <p className="text-sm text-slate-600">
          "{daEliminare?.nome}" verrà rimossa definitivamente dal listino. Per toglierla solo dalla vista pubblica usa "Nascondi".
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDaEliminare(null)}>Annulla</button>
          <button className="btn-danger" onClick={elimina}>Elimina</button>
        </div>
      </Modale>
    </>
  )
}
