import { useState } from 'react'
import { nomeAllegato, scaricaFile } from '../lib/contratti'
import { messaggioErrore } from '../lib/supabase'
import type { Vendita } from '../lib/types'
import { Icon } from './Icon'

/** Pulsanti per scaricare i file del contratto firmato di una vendita. */
export function AllegatiContratto({ vendita }: { vendita: Pick<Vendita, 'cliente_nome' | 'allegati'> }) {
  const [errore, setErrore] = useState<string | null>(null)
  const n = vendita.allegati.length

  async function scarica(path: string, i: number) {
    setErrore(null)
    try {
      await scaricaFile(path, nomeAllegato(vendita.cliente_nome, path, i, n))
    } catch (e) {
      setErrore(messaggioErrore(e))
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {vendita.allegati.map((path, i) => (
          <button key={path} type="button" className="btn-secondary py-1.5 text-sm" onClick={() => scarica(path, i)}>
            <Icon name="file" className="h-4 w-4" /> {n > 1 ? `Contratto ${i + 1}/${n}` : 'Contratto firmato'}
          </button>
        ))}
      </div>
      {errore && <p className="mt-2 text-xs text-red-700">{errore}</p>}
    </div>
  )
}
