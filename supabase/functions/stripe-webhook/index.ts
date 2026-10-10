// Webhook Stripe: a pagamento riuscito segna l'ordine come pagato, congela il contratto
// compilato e lo invia al cliente via email (se Resend è configurato).
//
// Da pubblicare SENZA verifica JWT:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secret: STRIPE_SECRET_KEY (non serve qui), STRIPE_WEBHOOK_SECRET, SITE_URL
// Facoltativi (email): RESEND_API_KEY, MAIL_FROM (es. "Forma Web <ordini@tuodominio.it>"), ADMIN_EMAIL
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const enc = new TextEncoder()

function esadecimale(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function uguali(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

/** Verifica la firma "Stripe-Signature: t=...,v1=..." (HMAC-SHA256, tolleranza 5 minuti). */
async function firmaValida(corpo: string, header: string | null, segreto: string) {
  if (!header) return false
  const parti = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]))
  const t = parti['t']
  const attese = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3))
  if (!t || attese.length === 0) return false
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false
  const chiave = await crypto.subtle.importKey('raw', enc.encode(segreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const calcolata = esadecimale(await crypto.subtle.sign('HMAC', chiave, enc.encode(`${t}.${corpo}`)))
  return attese.some((v) => uguali(v, calcolata))
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Testo del contratto → HTML ("# Titolo" = titolo, riga vuota = nuovo paragrafo). */
function contrattoHtml(testo: string, titolo: string) {
  const corpo = testo
    .split(/\n\s*\n/)
    .map((blocco) =>
      blocco
        .split('\n')
        .map((r) => (r.startsWith('# ') ? `<h2>${esc(r.slice(2))}</h2>` : `<p>${esc(r)}</p>`))
        .join(''),
    )
    .join('')
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(titolo)}</title>
<style>body{font:15px/1.6 Georgia,serif;max-width:760px;margin:40px auto;padding:0 20px;color:#111}h2{font:700 16px/1.4 Arial,sans-serif;margin:1.6em 0 .3em}p{margin:.3em 0}</style>
</head><body>${corpo}</body></html>`
}

async function inviaEmail(a: string, oggetto: string, html: string, allegato?: { nome: string; contenuto: string }) {
  const chiave = Deno.env.get('RESEND_API_KEY')
  const da = Deno.env.get('MAIL_FROM')
  if (!chiave || !da) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chiave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: da,
      to: [a],
      subject: oggetto,
      html,
      attachments: allegato ? [{ filename: allegato.nome, content: allegato.contenuto }] : undefined,
    }),
  })
  if (!res.ok) console.error('Resend:', res.status, await res.text())
  return res.ok
}

function base64Utf8(testo: string) {
  let bin = ''
  for (const b of enc.encode(testo)) bin += String.fromCharCode(b)
  return btoa(bin)
}

Deno.serve(async (req) => {
  const segreto = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!segreto) return new Response('Webhook non configurato', { status: 500 })

  const corpo = await req.text()
  if (!(await firmaValida(corpo, req.headers.get('stripe-signature'), segreto))) {
    return new Response('Firma non valida', { status: 400 })
  }

  const evento = JSON.parse(corpo)
  // Accettiamo solo pagamenti effettivamente incassati (anche i metodi asincroni)
  if (evento.type !== 'checkout.session.completed' && evento.type !== 'checkout.session.async_payment_succeeded') {
    return new Response('ok')
  }
  const sessione = evento.data.object
  if (sessione.payment_status !== 'paid') return new Response('ok')

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: id, error } = await db.rpc('_ordine_segna_pagato', {
    p_session: sessione.id,
    p_importo: (sessione.amount_total ?? 0) / 100,
  })
  if (error) {
    console.error(error)
    return new Response('Errore database', { status: 500 }) // Stripe riproverà
  }
  if (!id) return new Response('ok')

  const { data: o } = await db.from('ordini_siti').select('*').eq('id', id).single()
  if (!o || !o.contratto_finale) return new Response('ok')

  // Email solo la prima volta (il webhook può arrivare due volte)
  if (o.email_inviata) return new Response('ok')

  const numero = `W-${String(o.numero).padStart(5, '0')}`
  const html = contrattoHtml(o.contratto_finale, `Contratto ${numero}`)
  const link = `${Deno.env.get('SITE_URL')?.replace(/\/+$/, '')}/ordine/${o.token}`

  const inviata = await inviaEmail(
    o.cliente_email,
    `Il tuo contratto – ordine ${numero}`,
    `<p>Ciao ${esc(o.cliente_nome)},</p><p>grazie per il pagamento! In allegato trovi il contratto compilato con i dati del tuo ordine <strong>${numero}</strong>. Puoi anche rivederlo e scaricarlo in ogni momento da <a href="${link}">questa pagina</a>.</p><p>Ti contatteremo a breve per iniziare il lavoro.</p>`,
    { nome: `Contratto ${numero}.html`, contenuto: base64Utf8(html) },
  )
  const admin = Deno.env.get('ADMIN_EMAIL')
  if (admin) {
    await inviaEmail(admin, `Nuovo ordine pagato ${numero}`, `<p>${esc(o.cliente_nome)} ha pagato l'ordine ${numero}.</p><p><a href="${link}">Apri ordine</a></p>`)
  }
  if (inviata) await db.from('ordini_siti').update({ email_inviata: true }).eq('id', o.id)

  return new Response('ok')
})
