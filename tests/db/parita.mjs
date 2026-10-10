// Esegui con:  npm run test:db
// Confronta calcolaPreventivo (TypeScript, nel browser) con calcola_preventivo (SQL, sul server)
// su molte combinazioni casuali: devono dare ESATTAMENTE gli stessi importi.
import { rolldown } from 'rolldown'
import { creaDb } from './setup.mjs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PROGETTO = fileURLToPath(new URL('../..', import.meta.url))
const USCITA = mkdtempSync(join(tmpdir(), 'parita-'))
const pacchetto = await rolldown({
  input: `${PROGETTO}/src/lib/configuratore.ts`,
  platform: 'node',
  transform: { define: { 'import.meta.env': '{}' } },
  logLevel: 'silent',
})
await pacchetto.write({ file: join(USCITA, 'configuratore.mjs'), format: 'esm' })
const ts = await import(pathToFileURL(join(USCITA, 'configuratore.mjs')).href)

const { db } = await creaDb()
const voci = (await db.query(`select * from public.configuratore_voci where gruppo <> 'servizio_esterno' order by ordine`)).rows
  .map((v) => ({ ...v, prezzo: v.prezzo == null ? null : Number(v.prezzo) }))
const imp = Object.fromEntries((await db.query(`select * from public.configuratore_impostazioni`)).rows.map((r) => [r.chiave, r.valore]))
const tipologie = voci.filter((v) => v.gruppo === 'tipologia')
const extra = voci.filter((v) => v.gruppo === 'extra' && v.codice !== 'pagina_aggiuntiva')

// pseudo-casuale ripetibile
let seed = 12345
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]

let n = 0, diversi = 0
for (const urg of [false, true]) {
  for (let i = 0; i < 400; i++) {
    const t = pick(tipologie)
    const ex = {}
    for (const e of extra) if (rnd() < 0.35) ex[e.codice] = e.a_quantita ? 1 + Math.floor(rnd() * 25) : 1 + Math.floor(rnd() * 3)
    const pagine = 1 + Math.floor(rnd() * 40)
    const sel = { tipologia: t.codice, pagine, extra: ex, urgenzaConfermata: urg }
    const a = ts.calcolaPreventivo(voci, imp, sel)
    const b = (await db.query('select public.calcola_preventivo($1::jsonb) r', [JSON.stringify({ tipologia: t.codice, pagine, extra: ex, urgenza_confermata: urg })])).rows[0].r
    n++
    const confronta = [
      ['subtotale', Number(a.subtotale), Number(b.subtotale)],
      ['totale', Number(a.totale), Number(b.totale)],
      ['urgenza', Number(a.urgenza_importo), Number(b.urgenza_importo)],
      ['pag_extra', a.pagine_extra, b.pagine_extra],
      ['pag_importo', Number(a.pagine_extra_importo), Number(b.pagine_extra_importo)],
      ['approvazione', a.approvazione_manuale, b.approvazione_manuale],
      ['righe', a.righe.map((r) => `${r.codice}:${r.quantita}:${r.importo}:${r.incluso}`).join('|'), b.righe.map((r) => `${r.codice}:${r.quantita}:${Number(r.importo)}:${r.incluso}`).sort((x, y) => 0).join('|')],
    ]
    for (const [campo, x, y] of confronta) {
      if (x !== y) {
        // le righe SQL non hanno ordine garantito: confronto come insiemi
        if (campo === 'righe' && x.split('|').sort().join('|') === y.split('|').sort().join('|')) continue
        diversi++
        if (diversi <= 5) console.log('DIVERSO', campo, { sel, ts: x, sql: y })
      }
    }
  }
}
console.log(`${n} combinazioni confrontate, ${diversi} differenze`)
process.exit(diversi ? 1 : 0)
