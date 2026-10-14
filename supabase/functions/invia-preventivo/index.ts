// L'admin ha premuto «Invia preventivo al cliente»: manda al cliente una email con importo,
// consegna e link per leggere il contratto e pagare.
//
// Pubblica con:  supabase functions deploy invia-preventivo   (con verifica JWT: solo utenti loggati)
// Secret: RESEND_API_KEY, MAIL_FROM, SITE_URL (+ ADMIN_EMAIL/MAIL_REPLY_TO per le risposte del cliente)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { euro, inviaEmail, numeroOrdine, sito } from '../_shared/email.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito.' }, 405)

  try {
    // Solo l'admin può far partire questa email
    const auth = req.headers.get('Authorization') ?? ''
    const utente = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    })
    const { data: admin } = await utente.rpc('is_admin')
    if (admin !== true) return json({ error: 'Non autorizzato.' }, 403)

    const { id } = await req.json()
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Ordine non valido.' }, 400)

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: o, error } = await db.from('ordini_siti').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!o) return json({ error: 'Ordine non trovato.' }, 404)
    if (o.stato !== 'preventivo_inviato' || !o.prezzo) return json({ error: 'Il preventivo non è stato ancora inviato.' }, 409)

    const numero = numeroOrdine(o.numero)
    const prova = o.tipo_ordine === 'prova'
    const ora = o.acconto ?? o.prezzo
    const parziale = Number(ora) < Number(o.prezzo)

    const inviata = await inviaEmail({
      a: o.cliente_email,
      oggetto: `Il tuo preventivo ${numero} – Forma Web`,
      contenuto: {
        anteprima: `Ciao ${o.cliente_nome}, il tuo preventivo è pronto: ${euro(o.prezzo)}.`,
        titolo: 'Il tuo preventivo è pronto',
        intro: [
          `Ciao ${o.cliente_nome}, grazie per averci scelto! Abbiamo preparato il preventivo per il tuo sito${o.nome_attivita ? ` «${o.nome_attivita}»` : ''}.`,
          'Dal pulsante qui sotto puoi leggere il contratto, accettarlo e pagare online in pochi minuti.',
        ],
        dettagli: [
          ['Ordine', numero],
          [prova ? 'Prezzo pieno del sito' : 'Prezzo totale', euro(o.prezzo)],
          [prova ? 'Da pagare ora (mese di prova)' : parziale ? 'Da pagare ora (acconto)' : 'Da pagare ora', euro(ora)],
          ...(parziale ? ([[prova ? 'Resto dopo il mese' : 'Saldo alla consegna', euro(Number(o.prezzo) - Number(ora))]] as [string, string][]) : []),
          ['Consegna', o.consegna_giorni ? `${o.consegna_giorni} giorni` : '—'],
        ],
        citazione: o.nota_preventivo ? { titolo: 'Messaggio da Forma Web', testo: o.nota_preventivo } : undefined,
        pulsante: { testo: 'Vedi il preventivo e paga', url: `${sito()}/ordine/${o.token}` },
        chiusura: ['Hai domande? Rispondi pure a questa email, ti risponderemo il prima possibile.'],
      },
    })

    return json({ inviata })
  } catch (e) {
    console.error(e)
    return json({ error: 'Errore imprevisto.' }, 500)
  }
})
