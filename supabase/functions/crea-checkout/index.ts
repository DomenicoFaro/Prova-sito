// Il cliente ha letto e accettato il contratto: registra l'accettazione e crea la
// pagina di pagamento Stripe Checkout. Restituisce { url } a cui reindirizzare il cliente.
//
// Secret necessari (supabase secrets set ...): STRIPE_SECRET_KEY, SITE_URL
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito.' }, 405)

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const siteUrl = Deno.env.get('SITE_URL')?.replace(/\/+$/, '')
    if (!stripeKey || !siteUrl) return json({ error: 'Pagamenti non ancora configurati.' }, 500)

    const { token, firmatario } = await req.json()
    if (typeof token !== 'string' || !/^[0-9a-f-]{36}$/i.test(token)) return json({ error: 'Ordine non valido.' }, 400)
    const nome = String(firmatario ?? '').trim()
    if (nome.length < 2 || nome.length > 200) return json({ error: 'Scrivi nome e cognome per accettare il contratto.' }, 400)

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: o, error } = await db.from('ordini_siti').select('*').eq('token', token).maybeSingle()
    if (error) throw error
    if (!o) return json({ error: 'Ordine non trovato.' }, 404)
    if (o.stato === 'pagato') return json({ error: 'Ordine già pagato.' }, 409)
    if (o.stato !== 'preventivo_inviato' || !o.prezzo) return json({ error: 'Il preventivo non è ancora disponibile.' }, 409)
    // Richiesta in verifica manuale: si paga solo dopo che FormaWeb ha confermato l'importo (preventivo_il lo imposta l'admin)
    if (o.approvazione_manuale && !o.preventivo_il) {
      return json({ error: "Il pagamento sarà disponibile appena FormaWeb avrà confermato l'importo." }, 409)
    }

    const importo = Math.round(Number(o.acconto ?? o.prezzo) * 100)
    if (!(importo >= 50)) return json({ error: 'Importo non valido.' }, 400)

    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
    const numero = `W-${String(o.numero).padStart(5, '0')}`

    // Registra firmatario, data e IP dell'accettazione (prova dell'accettazione del contratto)
    const { error: errAcc } = await db
      .from('ordini_siti')
      .update({ firmatario: nome, accettato_il: new Date().toISOString(), accettato_ip: ip })
      .eq('id', o.id)
    if (errAcc) throw errAcc

    const form = new URLSearchParams({
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][unit_amount]': String(importo),
      'line_items[0][price_data][product_data][name]': `Sito web – ordine ${numero}`,
      'line_items[0][price_data][product_data][description]':
        o.acconto && Number(o.acconto) < Number(o.prezzo) ? 'Acconto (il saldo è dovuto alla consegna)' : 'Pagamento completo',
      customer_email: o.cliente_email,
      client_reference_id: o.id,
      'metadata[ordine_id]': o.id,
      'metadata[numero]': numero,
      success_url: `${siteUrl}/ordine/${token}?pagato=1`,
      cancel_url: `${siteUrl}/ordine/${token}`,
    })

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    const sessione = await res.json()
    if (!res.ok) {
      console.error('Stripe:', sessione)
      return json({ error: 'Impossibile avviare il pagamento. Riprova tra poco.' }, 502)
    }

    const { error: errSes } = await db.from('ordini_siti').update({ stripe_session_id: sessione.id }).eq('id', o.id)
    if (errSes) throw errSes

    return json({ url: sessione.url })
  } catch (e) {
    console.error(e)
    return json({ error: 'Errore imprevisto. Riprova tra poco.' }, 500)
  }
})
