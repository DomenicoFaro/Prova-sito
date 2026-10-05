import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import { Caricamento, IntestazionePagina, MessaggioErrore, MessaggioSuccesso, Modale, Spinner, Vuoto } from '../../../components/ui'
import { formatEuro, parseNumero } from '../../../lib/format'
import { messaggioErrore, supabase } from '../../../lib/supabase'
import type { Prezzo, TipoPrezzo } from '../../../lib/types'
import { esegui, useQuery } from '../../../lib/useQuery'

interface FormPrezzo {
  tipo: TipoPrezzo
  nome: string
  descrizione: string
  prezzo: string
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
  a_partire_da: false,
  periodicita: '',
  caratteristiche: '',
  in_evidenza: false,
  ordine: '0',
  attivo: true,
}

const ETICHETTA_TIPO: Record<TipoPrezzo, string> = { sito: 'Sito web', servizio: 'Servizio' }

export default function AdminPrezzi() {
  const [modale, setModale] = useState<'nuovo' | Prezzo | null>(null)
  const [form, setForm] = useState<FormPrezzo>(VUOTO)
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [successo, setSuccesso] = useState<string | null>(null)
  const [daEliminare, setDaEliminare] = useState<Prezzo | null>(null)

  const { dati, caricamento, errore: erroreCaricamento, ricarica } = useQuery(() =>
    esegui<Prezzo[]>(supabase.from('prezzi').select('*').order('tipo').order('ordine').order('prezzo')),
  )

  function set<K extends keyof FormPrezzo>(k: K, v: FormPrezzo[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function apriNuovo() {
    setErrore(null)
    setForm(VUOTO)
    setModale('nuovo')
  }

  function apriModifica(p: Prezzo) {
    setErrore(null)
    setForm({
      tipo: p.tipo,
      nome: p.nome,
      descrizione: p.descrizione,
      prezzo: String(p.prezzo),
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
    const ordine = parseNumero(form.ordine || '0')
    if (!form.nome.trim()) return setErrore('Il nome è obbligatorio.')
    if (!Number.isFinite(prezzo) || prezzo < 0) return setErrore('Prezzo non valido.')
    if (!Number.isInteger(ordine)) return setErrore("L'ordine deve essere un numero intero.")

    setSalvataggio(true)
    try {
      const payload = {
        tipo: form.tipo,
        nome: form.nome.trim(),
        descrizione: form.descrizione.trim(),
        prezzo,
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
          <>
            Il listino che tutti vedono su <Link to="/prezzi" className="font-semibold text-brand-700 hover:underline">/prezzi</Link>. Le voci nascoste non sono pubbliche.
          </>
        }
        azioni={
          <button className="btn-primary" onClick={apriNuovo}>
            <Icon name="plus" className="h-4 w-4" /> Nuova voce
          </button>
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
        <div className="card"><Vuoto icona="euro" titolo="Nessuna voce nel listino">Aggiungi la prima con "Nuova voce".</Vuoto></div>
      ) : (
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {dati.map((p) => (
            <div key={p.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6 ${p.attivo ? '' : 'opacity-60'}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">
                  {p.nome}
                  {p.in_evidenza && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">In evidenza</span>}
                  {!p.attivo && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Nascosta</span>}
                </p>
                <p className="truncate text-xs text-slate-500">{ETICHETTA_TIPO[p.tipo]}{p.periodicita && ` · ${p.periodicita}`}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{p.a_partire_da && 'da '}{formatEuro(p.prezzo)}</span>
              <div className="flex gap-1">
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
            </div>
          ))}
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="pp">Prezzo (€)</label>
              <input id="pp" inputMode="decimal" className="input" required placeholder="0,00" value={form.prezzo} onChange={(e) => set('prezzo', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="pper">Periodicità</label>
              <input id="pper" className="input" list="periodicita" placeholder="una tantum" value={form.periodicita} onChange={(e) => set('periodicita', e.target.value)} />
              <datalist id="periodicita">
                {['una tantum', 'al mese', "all'anno"].map((x) => <option key={x} value={x} />)}
              </datalist>
            </div>
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
              ['a_partire_da', 'Mostra "da" davanti al prezzo (prezzo a partire da)'],
              ['in_evidenza', 'Metti in evidenza'],
              ['attivo', 'Visibile nel listino pubblico'],
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
          "{daEliminare?.nome}" verrà rimossa definitivamente dal listino. Se vuoi solo toglierla dalla vista pubblica, usa invece "Nascondi".
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDaEliminare(null)}>Annulla</button>
          <button className="btn bg-red-600 text-white hover:bg-red-700" onClick={elimina}>Elimina</button>
        </div>
      </Modale>
    </>
  )
}
