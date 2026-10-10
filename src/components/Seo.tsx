import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { SITO } from '../config'

interface SeoProps {
  titolo?: string
  descrizione?: string
  /** true per pagine private o senza valore per i motori di ricerca. */
  noindex?: boolean
}

function imposta(selettore: string, crea: () => HTMLElement, attr: string, valore: string) {
  let el = document.head.querySelector<HTMLElement>(selettore)
  if (!el) {
    el = crea()
    document.head.appendChild(el)
  }
  el.setAttribute(attr, valore)
}

const meta = (chiave: 'name' | 'property', nome: string, contenuto: string) =>
  imposta(
    `meta[${chiave}="${nome}"]`,
    () => {
      const m = document.createElement('meta')
      m.setAttribute(chiave, nome)
      return m
    },
    'content',
    contenuto,
  )

/** Titolo, descrizione, canonical, Open Graph e robots di ogni pagina. */
export function Seo({ titolo, descrizione, noindex }: SeoProps) {
  const { pathname } = useLocation()
  useEffect(() => {
    const titoloCompleto = titolo ? `${titolo} | ${SITO.titolo}` : `${SITO.titolo} – Creazione siti web su misura | ${SITO.dominio}`
    const desc = descrizione ?? SITO.descrizione
    const url = `${SITO.url}${pathname === '/' ? '/' : pathname.replace(/\/$/, '')}`
    document.title = titoloCompleto
    meta('name', 'description', desc)
    meta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1')
    imposta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', url)
    meta('property', 'og:title', titoloCompleto)
    meta('property', 'og:description', desc)
    meta('property', 'og:url', url)
  }, [titolo, descrizione, noindex, pathname])
  return null
}
