import type { NomeIcona } from '../components/Icon'
import type { Opportunita, Profilo } from './types'

/** Una "cartella" della pagina Opportunità: una categoria, "Le mie opportunità" o i link di una persona. */
export interface Sezione {
  chiave: string
  titolo: string
  sottotitolo?: string
  conteggio: number
  icona: NomeIcona
}

export const CHIAVE_MIE = 'mie'
const SENZA_CATEGORIA = 'Senza categoria'

const normalizza = (c: string) => c.trim().toLowerCase()
export const chiaveCategoria = (c: string) => `cat:${normalizza(c)}`
export const chiavePersona = (id: string) => `p:${id}`

function maiuscola(t: string) {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t
}

/**
 * Raggruppa le opportunità in sezioni:
 *  - una per categoria, con le opportunità condivise del team (create da admin o socio);
 *  - "Le mie opportunità": quelle caricate da me (se `mie`);
 *  - una per persona (solo admin/socio): i link caricati da ciascun collaboratore del suo team.
 */
export function costruisciSezioni(
  lista: Opportunita[],
  opzioni: { meId: string; mie: boolean; persone: Map<string, Profilo> | null },
): Sezione[] {
  const sezioni: Sezione[] = []

  if (opzioni.mie) {
    sezioni.push({
      chiave: CHIAVE_MIE,
      titolo: 'Le mie opportunità',
      sottotitolo: 'Quelle che hai caricato tu',
      conteggio: lista.filter((o) => o.creato_da === opzioni.meId).length,
      icona: 'user',
    })
  }

  const categorie = new Map<string, { titolo: string; n: number }>()
  for (const o of lista) {
    if (o.owner_id) continue
    const k = normalizza(o.categoria)
    const c = categorie.get(k) ?? { titolo: o.categoria.trim() ? maiuscola(o.categoria.trim()) : SENZA_CATEGORIA, n: 0 }
    c.n += 1
    categorie.set(k, c)
  }
  const perCategoria = [...categorie.entries()].sort((a, b) => a[1].titolo.localeCompare(b[1].titolo, 'it'))
  for (const [k, c] of perCategoria) {
    sezioni.push({ chiave: `cat:${k}`, titolo: c.titolo, conteggio: c.n, icona: 'folder' })
  }

  if (opzioni.persone) {
    const conteggi = new Map<string, number>()
    for (const o of lista) {
      if (o.owner_id && o.owner_id !== opzioni.meId) conteggi.set(o.owner_id, (conteggi.get(o.owner_id) ?? 0) + 1)
    }
    const persone = [...opzioni.persone.values()]
      .filter((p) => p.id !== opzioni.meId && p.ruolo === 'collaboratore')
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
    for (const p of persone) {
      sezioni.push({
        chiave: chiavePersona(p.id),
        titolo: p.nome,
        sottotitolo: 'Link caricati da lui/lei',
        conteggio: conteggi.get(p.id) ?? 0,
        icona: 'users',
      })
    }
  }
  return sezioni
}

export function filtraPerSezione(lista: Opportunita[], chiave: string, meId: string): Opportunita[] {
  if (chiave === CHIAVE_MIE) return lista.filter((o) => o.creato_da === meId)
  if (chiave.startsWith('p:')) return lista.filter((o) => o.owner_id === chiave.slice(2))
  if (chiave.startsWith('cat:')) {
    const k = chiave.slice(4)
    return lista.filter((o) => !o.owner_id && normalizza(o.categoria) === k)
  }
  return []
}
