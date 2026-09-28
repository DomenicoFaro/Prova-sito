import { useEffect } from 'react'
import { AGENZIA } from '../config'

interface SeoProps {
  titolo?: string
  descrizione?: string
  immagine?: string | null
  noindex?: boolean
}

function setMeta(attr: 'name' | 'property', chiave: string, valore: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${chiave}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, chiave)
    document.head.appendChild(el)
  }
  el.content = valore
}

/** Imposta title, meta description e Open Graph della pagina. */
export function Seo({ titolo, descrizione = AGENZIA.descrizione, immagine, noindex }: SeoProps) {
  useEffect(() => {
    const titoloCompleto = titolo ? `${titolo} | ${AGENZIA.nome}` : `${AGENZIA.nome} — ${AGENZIA.slogan}`
    document.title = titoloCompleto
    setMeta('name', 'description', descrizione)
    setMeta('property', 'og:title', titoloCompleto)
    setMeta('property', 'og:description', descrizione)
    setMeta('property', 'og:url', window.location.href)
    setMeta('property', 'og:image', immagine || `${window.location.origin}/og-image.svg`)
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
  }, [titolo, descrizione, immagine, noindex])
  return null
}
