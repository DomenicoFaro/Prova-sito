// Chiamata dal sito subito dopo che un cliente invia la richiesta di preventivo:
//  • avvisa l'admin (ADMIN_EMAIL) con i dettagli della richiesta
//  • manda al cliente la conferma con il link per seguire l'ordine
// Si può eseguire una sola volta per ordine (nessun abuso come "mail bomber").
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { emailConfigurata, esc, inviaEmail, linkOrdine, numeroOrdine } from '../_shared/email.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { token } = await req.json()
    if (typeof token !== 'string' || !/^[0-9a-f-]{36}$/i.test(token)) return json({ error: 'Ordine non valido.' }, 400)
    if (!emailConfigurata()) return json({ inviata: false, motivo: 'email non configurate' })

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    // Prenota l'invio: solo la prima chiamata trova la riga ancora senza data
    const { data: o } = await db
      .from('ordini_siti')
      .update({ notifica_richiesta_il: new Date().toISOString() })
      .eq('token', token)
      .is('notifica_richiesta_il', null)
      .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .select('*')
      .maybeSingle()
    if (!o) return json({ inviata: false, motivo: 'già inviata' })

    const num = numeroOrdine(o.numero)
    const link = linkOrdine(o.token)
    const admin = Deno.env.get('ADMIN_EMAIL')

    if (admin) {
      await inviaEmail(
        admin,
        `Nuova richiesta di preventivo ${num} – ${o.cliente_nome}`,
        `<p><strong>${esc(o.cliente_nome)}</strong> ha chiesto un preventivo (${num}).</p>
<ul>
<li>Email: ${esc(o.cliente_email)}</li>
<li>Telefono: ${esc(o.cliente_telefono) || '—'}</li>
<li>Tipo di sito: ${esc(o.tipo_sito) || '—'} · ${esc(o.nome_attivita)}</li>
<li>Pagine: ${esc(o.pagine) || '—'}</li>
<li>Funzionalità: ${esc((o.funzionalita ?? []).join(', ')) || '—'}</li>
<li>Budget: ${esc(o.budget) || '—'} · Scadenza: ${esc(o.scadenza) || '—'}</li>
</ul>
<p>${esc(o.descrizione).replace(/\n/g, '<br>')}</p>
<p><a href="${Deno.env.get('SITE_URL')?.replace(/\/+$/, '')}/area/admin/preventivi">Apri Preventivi nell'area riservata</a></p>`,
        o.cliente_email,
      )
    }

    await inviaEmail(
      o.cliente_email,
      `Abbiamo ricevuto la tua richiesta – ordine ${num}`,
      `<p>Ciao ${esc(o.cliente_nome)},</p>
<p>abbiamo ricevuto la tua richiesta per il sito (ordine <strong>${num}</strong>). Ti scriveremo appena il preventivo è pronto.</p>
<p>Puoi seguire lo stato dell'ordine da questa pagina: <a href="${link}">${link}</a></p>`,
      admin,
    )
    return json({ inviata: true })
  } catch (e) {
    console.error(e)
    return json({ error: 'Errore imprevisto.' }, 500)
  }
})
