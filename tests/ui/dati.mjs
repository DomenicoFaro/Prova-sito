// Dati veri del listino (dal database di prova) usati dalle risposte finte dei test nel browser.
import { creaDb } from '../db/setup.mjs'

const { db } = await creaDb()
export const voci = (await db.query(`select * from public.configuratore_voci where attivo order by ordine`)).rows
export const imp = (await db.query(`select chiave, valore from public.configuratore_impostazioni`)).rows
export const EDGE = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
export const BASE = 'http://localhost:5199'
