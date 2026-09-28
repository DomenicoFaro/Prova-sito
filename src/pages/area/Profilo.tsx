import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { IntestazionePagina, MessaggioErrore, MessaggioSuccesso, Spinner } from '../../components/ui'
import { formatPercentuale } from '../../lib/format'
import { BUCKET_AVATARS, caricaImmagine, messaggioErrore, supabase } from '../../lib/supabase'

export default function Profilo() {
  const { profilo, isAdmin, ricaricaProfilo } = useAuth()
  const [nome, setNome] = useState(profilo?.nome ?? '')
  const [salvataggio, setSalvataggio] = useState(false)
  const [caricaFoto, setCaricaFoto] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; testo: string } | null>(null)

  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [salvaPw, setSalvaPw] = useState(false)
  const [msgPw, setMsgPw] = useState<{ tipo: 'ok' | 'err'; testo: string } | null>(null)

  useEffect(() => setNome(profilo?.nome ?? ''), [profilo?.nome])

  if (!profilo) return null

  async function salvaNome(e: FormEvent) {
    e.preventDefault()
    if (!profilo) return
    setMsg(null)
    if (!nome.trim()) return setMsg({ tipo: 'err', testo: 'Il nome non può essere vuoto.' })
    setSalvataggio(true)
    const { error } = await supabase.from('profiles').update({ nome: nome.trim() }).eq('id', profilo.id)
    setSalvataggio(false)
    if (error) return setMsg({ tipo: 'err', testo: messaggioErrore(error) })
    await ricaricaProfilo()
    setMsg({ tipo: 'ok', testo: 'Profilo aggiornato.' })
  }

  async function cambiaFoto(file: File | undefined) {
    if (!file || !profilo) return
    setMsg(null)
    if (!file.type.startsWith('image/')) return setMsg({ tipo: 'err', testo: 'Seleziona un file immagine.' })
    if (file.size > 2 * 1024 * 1024) return setMsg({ tipo: 'err', testo: "L'immagine deve pesare al massimo 2 MB." })
    setCaricaFoto(true)
    try {
      const url = await caricaImmagine(BUCKET_AVATARS, profilo.id, file)
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profilo.id)
      if (error) throw error
      await ricaricaProfilo()
      setMsg({ tipo: 'ok', testo: 'Foto aggiornata.' })
    } catch (err) {
      setMsg({ tipo: 'err', testo: messaggioErrore(err) })
    } finally {
      setCaricaFoto(false)
    }
  }

  async function cambiaPassword(e: FormEvent) {
    e.preventDefault()
    setMsgPw(null)
    if (pw.length < 8) return setMsgPw({ tipo: 'err', testo: 'La password deve contenere almeno 8 caratteri.' })
    if (pw !== pw2) return setMsgPw({ tipo: 'err', testo: 'Le due password non coincidono.' })
    setSalvaPw(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSalvaPw(false)
    if (error) return setMsgPw({ tipo: 'err', testo: messaggioErrore(error) })
    setPw('')
    setPw2('')
    setMsgPw({ tipo: 'ok', testo: 'Password aggiornata.' })
  }

  return (
    <>
      <IntestazionePagina titolo="Il mio profilo" sottotitolo="Puoi modificare nome, foto e password." />
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={salvaNome} className="card space-y-5 p-5 sm:p-6">
          <h2 className="font-semibold text-slate-900">Dati personali</h2>
          {msg && (msg.tipo === 'ok' ? <MessaggioSuccesso>{msg.testo}</MessaggioSuccesso> : <MessaggioErrore>{msg.testo}</MessaggioErrore>)}
          <div className="flex items-center gap-4">
            <Avatar nome={profilo.nome} url={profilo.avatar_url} grande />
            <label className="btn-secondary cursor-pointer">
              {caricaFoto ? <Spinner className="h-4 w-4" /> : <Icon name="upload" className="h-4 w-4" />}
              Cambia foto
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={caricaFoto} onChange={(e) => cambiaFoto(e.target.files?.[0])} />
            </label>
          </div>
          <div>
            <label htmlFor="nome" className="label">Nome</label>
            <input id="nome" className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={profilo.email} disabled />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="label">Ruolo</p>
              <p className="text-sm text-slate-700">{isAdmin ? 'Amministratore' : 'Collaboratore'}</p>
            </div>
            {!isAdmin && (
              <div>
                <p className="label">% predefinita</p>
                <p className="text-sm text-slate-700">{formatPercentuale(profilo.percentuale_default)}</p>
              </div>
            )}
          </div>
          <button className="btn-primary" disabled={salvataggio}>
            {salvataggio && <Spinner className="h-4 w-4" />} Salva
          </button>
        </form>

        <form onSubmit={cambiaPassword} className="card space-y-5 p-5 sm:p-6">
          <h2 className="font-semibold text-slate-900">Cambia password</h2>
          {msgPw && (msgPw.tipo === 'ok' ? <MessaggioSuccesso>{msgPw.testo}</MessaggioSuccesso> : <MessaggioErrore>{msgPw.testo}</MessaggioErrore>)}
          <div>
            <label htmlFor="pw" className="label">Nuova password</label>
            <input id="pw" type="password" className="input" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pw2" className="label">Conferma password</label>
            <input id="pw2" type="password" className="input" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          <button className="btn-primary" disabled={salvaPw}>
            {salvaPw && <Spinner className="h-4 w-4" />} Aggiorna password
          </button>
        </form>
      </div>
    </>
  )
}
