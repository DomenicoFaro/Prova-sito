// Chiamata dall'admin dopo aver inviato il preventivo: scrive al cliente con il link
// per leggere il contratto e pagare. Solo admin attivi.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { emailConfigurata, esc, euro, inviaEmail, linkOrdine, numeroOrdine } from '../_shared/email.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const utente = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: u } = await utente.auth.getUser()
    if (!u.user) return json({ error: 'Non autorizzato.' }, 401)

    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: profilo } = await db.from('profiles').select('ruolo, attivo, email').eq('id', u.user.id).maybeSingle()
    if (!profilo || profilo.ruolo !== 'admin' || !profilo.attivo) return json({ error: 'Non autorizzato.' }, 403)

    const { ordine_id } = await req.json()
    if (typeof ordine_id !== 'string') return json({ error: 'Ordine non valido.' }, 400)
    if (!emailConfigurata()) return json({ inviata: false, motivo: 'Email non configurate (vedi README: Resend).' })

    const { data: o } = await db.from('ordini_siti').select('*').eq('id', ordine_id).maybeSingle()
    if (!o) return json({ error: 'Ordine non trovato.' }, 404)
    if (o.stato !== 'preventivo_inviato' || !o.prezzo) return json({ error: 'Il preventivo non è stato ancora inviato.' }, 409)

    const num = numeroOrdine(o.numero)
    const link = linkOrdine(o.token)
    const daPagare = Number(o.acconto ?? o.prezzo)
    const ok = await inviaEmail(
      o.cliente_email,
      `Il tuo preventivo è pronto – ordine ${num}`,
      `<p>Ciao ${esc(o.cliente_nome)},</p>
<p>il preventivo per il tuo sito è pronto.</p>
<ul>
<li>Prezzo: <strong>${euro(o.prezzo)}</strong></li>
<li>Da pagare ora: <strong>${euro(daPagare)}</strong></li>
<li>Consegna: ${o.consegna_giorni ? `${o.consegna_giorni} giorni` : '—'}</li>
</ul>
${o.nota_preventivo ? `<p>${esc(o.nota_preventivo).replace(/\n/g, '<br>')}</p>` : ''}
<p>Da questo link puoi leggere il contratto, accettarlo e pagare online:<br><a href="${link}">${link}</a></p>`,
      Deno.env.get('ADMIN_EMAIL') || profilo.email,
    )
    if (ok) await db.from('ordini_siti').update({ preventivo_email_il: new Date().toISOString() }).eq('id', o.id)
    return json({ inviata: ok, motivo: ok ? null : "Invio non riuscito: controlla la configurazione dell'email." })
  } catch (e) {
    console.error(e)
    return json({ error: 'Errore imprevisto.' }, 500)
  }
})
