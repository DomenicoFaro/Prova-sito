import { useEffect } from 'react'
import { SITO } from '../config'

interface SeoProps {
  titolo?: string
}

/** Imposta il titolo della scheda. Il sito è privato: niente indicizzazione né anteprime social. */
export function Seo({ titolo }: SeoProps) {
  useEffect(() => {
    document.title = titolo ? `${titolo} | ${SITO.titolo}` : SITO.titolo
  }, [titolo])
  return null
}
