// Notifiche dei ticket sul telefono e sul computer.
//   { azione: 'invia' }   spedisce gli avvisi dei messaggi nuovi (la chiama il sito dopo ogni messaggio)
//   { azione: 'chiave' }  chiave pubblica da usare per iscrivere un dispositivo
//   { azione: 'prova' }   notifica di prova ai dispositivi di chi è collegato
//
// Pubblica con:  supabase functions deploy notifica-ticket --no-verify-jwt
// Serve supabase/notifiche_push.sql. Nessun secret da impostare: le chiavi si creano da sole.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { type ChiaviVapid, type Dispositivo, generaChiaviVapid, inviaPush } from '../_shared/webpush.ts'

interface Avviso {
  per: string[]
  titolo: string
  testo: string
  ticket: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito.' }, 405)

  try {
    const { azione = 'invia' } = await req.json().catch(() => ({}))
    const url = Deno.env.get('SUPABASE_URL')!
    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    async function chiavi(): Promise<ChiaviVapid> {
      const leggi = async () => {
        const { data, error } = await db.from('push_chiavi').select('pubblica, privata').eq('id', 1).maybeSingle()
        if (error) throw error
        return data as ChiaviVapid | null
      }
      const salvate = await leggi()
      if (salvate) return salvate
      // Prima volta: si creano. Se due richieste arrivano insieme vince la prima.
      await db.from('push_chiavi').insert({ id: 1, ...(await generaChiaviVapid()) })
      return (await leggi())!
    }

    async function spedisci(avvisi: Avviso[]) {
      const persone = [...new Set(avvisi.flatMap((a) => a.per))]
      if (!persone.length) return 0
      const { data: attivi } = await db.from('profiles').select('id').eq('attivo', true).in('id', persone)
      const validi = new Set((attivi ?? []).map((p: { id: string }) => p.id))
      const { data: dispositivi, error } = await db.from('push_iscrizioni').select('utente_id, endpoint, p256dh, auth').in('utente_id', persone)
      if (error) throw error
      const k = await chiavi()
      let inviate = 0
      await Promise.all(
        avvisi.flatMap((a) =>
          ((dispositivi ?? []) as (Dispositivo & { utente_id: string })[])
            .filter((d) => a.per.includes(d.utente_id) && validi.has(d.utente_id))
            .map(async (d) => {
              const stato = await inviaPush(d, { titolo: a.titolo, testo: a.testo, url: `/area/ticket/${a.ticket}`, tag: a.ticket }, k).catch(() => 0)
              if (stato >= 200 && stato < 300) inviate++
              if (stato === 404 || stato === 410) await db.from('push_iscrizioni').delete().eq('endpoint', d.endpoint)
            }),
        ),
      )
      return inviate
    }

    if (azione === 'chiave') return json({ chiave: (await chiavi()).pubblica })

    if (azione === 'prova') {
      const utente = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      })
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '')
      const { data } = await utente.auth.getUser(token)
      if (!data?.user) return json({ error: 'Non autorizzato.' }, 401)
      const inviate = await spedisci([{ per: [data.user.id], titolo: 'Forma Web', testo: 'Le notifiche funzionano.', ticket: '' }])
      return json({ inviate })
    }

    // Si "prenotano" i messaggi non ancora avvisati: ognuno genera una notifica una volta sola
    const unOraFa = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: messaggi, error } = await db
      .from('ticket_messaggi')
      .update({ notificato: true })
      .eq('notificato', false)
      .gt('created_at', unOraFa)
      .select('ticket_id, autore, testo, created_at')
    if (error) throw error
    const { data: assegnati, error: errAss } = await db
      .from('tickets')
      .update({ avviso_collaboratore: false })
      .eq('avviso_collaboratore', true)
      .select('id, numero, oggetto, collaboratore_id')
    if (errAss) throw errAss

    const avvisi: Avviso[] = (assegnati ?? [])
      .filter((t: { collaboratore_id: string | null }) => t.collaboratore_id)
      .map((t: { id: string; numero: number; oggetto: string; collaboratore_id: string }) => ({
        per: [t.collaboratore_id],
        titolo: `Ti hanno assegnato il ticket n. ${t.numero}`,
        testo: t.oggetto,
        ticket: t.id,
      }))

    if (messaggi?.length) {
      const ids = [...new Set(messaggi.map((m: { ticket_id: string }) => m.ticket_id))]
      const { data: tickets, error: errT } = await db.from('tickets').select('id, numero, nome, cliente_id, collaboratore_id').in('id', ids)
      if (errT) throw errT
      const { data: admin } = await db.from('profiles').select('id').eq('ruolo', 'admin').eq('attivo', true)
      const inOrdine = [...messaggi].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      for (const t of tickets ?? []) {
        for (const autore of ['richiedente', 'staff']) {
          // Una sola notifica per ticket, con l'ultimo messaggio
          const ultimo = inOrdine.filter((m) => m.ticket_id === t.id && m.autore === autore).at(-1)
          if (!ultimo) continue
          const daChiScrive = autore === 'richiedente'
          avvisi.push({
            per: daChiScrive
              ? [...(admin ?? []).map((a: { id: string }) => a.id), ...(t.collaboratore_id ? [t.collaboratore_id] : [])]
              : t.cliente_id ? [t.cliente_id] : [],
            titolo: daChiScrive ? `Ticket n. ${t.numero} – ${t.nome}` : 'Forma Web ti ha risposto',
            testo: ultimo.testo.slice(0, 160),
            ticket: t.id,
          })
        }
      }
    }

    // Un admin che è anche il collaboratore assegnato riceve un avviso solo
    for (const a of avvisi) a.per = [...new Set(a.per)]
    await spedisci(avvisi)
    return json({ ok: true })
  } catch (e) {
    console.error(e)
    return json({ error: 'Errore imprevisto.' }, 500)
  }
})
