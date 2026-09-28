import { useState } from 'react'
import { nomeModello, scaricaFile, trovaModello } from '../lib/contratti'
import { messaggioErrore } from '../lib/supabase'
import { Icon } from './Icon'
import { Spinner } from './ui'

/** Scarica il modello di contratto caricato dall'admin (bucket contratti/modello). */
export function ScaricaModello({ className = 'btn-secondary' }: { className?: string }) {
  const [attesa, setAttesa] = useState(false)
  const [avviso, setAvviso] = useState<string | null>(null)

  async function scarica() {
    setAvviso(null)
    setAttesa(true)
    try {
      const path = await trovaModello()
      if (!path) setAvviso('Il modello di contratto non è ancora stato caricato.')
      else await scaricaFile(path, nomeModello(path))
    } catch (e) {
      setAvviso(messaggioErrore(e))
    } finally {
      setAttesa(false)
    }
  }

  return (
    <div className="relative">
      <button type="button" className={className} onClick={scarica} disabled={attesa}>
        {attesa ? <Spinner className="h-4 w-4" /> : <Icon name="download" className="h-4 w-4" />} Scarica contratto
      </button>
      {avviso && (
        <p role="status" className="absolute top-full right-0 z-10 mt-2 w-64 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
          {avviso}
        </p>
      )}
    </div>
  )
}
