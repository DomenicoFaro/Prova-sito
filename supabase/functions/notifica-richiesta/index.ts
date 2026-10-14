// Chiamata dal sito subito dopo l'invio di una richiesta di preventivo: manda a te (ADMIN_EMAIL)
// una email con tutti i dati e il link per aprire la richiesta nell'area riservata.
//
// Pubblica con:  supabase functions deploy notifica-richiesta --no-verify-jwt
// Secret: RESEND_API_KEY, MAIL_FROM, ADMIN_EMAIL, SITE_URL
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { euro, inviaEmail, numeroOrdine, sito } from '../_shared/email.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito.' }, 405)

  try {
    const { token } = await req.json()
    if (typeof token !== 'string' || !/^[0-9a-f-]{36}$/i.test(token)) return json({ error: 'Ordine non valido.' }, 400)

    const admin = Deno.env.get('ADMIN_EMAIL')
    if (!admin) return json({ ok: true }) // notifiche non configurate: non è un errore per il cliente

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Solo richieste appena create e non ancora notificate; "prenotiamo" l'invio in modo atomico
    const { data: o, error } = await db
      .from('ordini_siti')
      .update({ email_richiesta_inviata: true })
      .eq('token', token)
      .eq('stato', 'richiesto')
      .eq('email_richiesta_inviata', false)
      .gt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .select('*')
      .maybeSingle()
    if (error) throw error
    if (!o) return json({ ok: true })

    const numero = numeroOrdine(o.numero)
    const prova = o.tipo_ordine === 'prova'
    const funz: string[] = o.funzionalita ?? []

    const inviata = await inviaEmail({
      a: admin,
      rispondiA: o.cliente_email, // rispondendo alla mail scrivi direttamente al cliente
      oggetto: `Nuova richiesta ${numero}${o.nome_attivita ? ` – ${o.nome_attivita}` : ''}`,
      contenuto: {
        anteprima: `${o.cliente_nome} ha chiesto un preventivo${o.totale_indicativo != null ? ` (indicativo ${euro(o.totale_indicativo)})` : ''}.`,
        titolo: prova ? 'Nuova richiesta: prova un mese' : 'Nuova richiesta di preventivo',
        intro: [
          `${o.cliente_nome} ha appena inviato una richiesta dal sito. Qui sotto trovi i dati principali.`,
          ...(o.approvazione_manuale ? ['⚠️ Richiede approvazione manuale: ci sono voci «da» o «su preventivo», il pagamento resta bloccato finché non confermi l’importo.'] : []),
        ],
        dettagli: [
          ['Ordine', numero],
          ['Cliente', o.cliente_nome],
          ['Email', o.cliente_email],
          ['Telefono', o.cliente_telefono || '—'],
          ['Attività', o.nome_attivita || '—'],
          ['Tipo di sito', o.tipo_sito || '—'],
          ['Pagine', o.pagine || '—'],
          ['Funzionalità', funz.length ? funz.join(', ') : '—'],
          ['Consegna', o.scadenza || '—'],
          ['Budget', o.budget || '—'],
          ['Totale indicativo', o.totale_indicativo != null ? euro(o.totale_indicativo) : '—'],
          ['Allegati', String((o.allegati ?? []).length)],
        ],
        citazione: { titolo: 'Descrizione del cliente', testo: o.descrizione },
        pulsante: { testo: 'Apri la richiesta', url: `${sito()}/area/admin/preventivi` },
      },
    })
    if (!inviata) await db.from('ordini_siti').update({ email_richiesta_inviata: false }).eq('id', o.id)

    return json({ ok: true })
  } catch (e) {
    console.error(e)
    return json({ error: 'Errore imprevisto.' }, 500)
  }
})
