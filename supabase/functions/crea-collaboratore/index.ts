// Supabase Edge Function: crea-collaboratore
//
// Crea un nuovo account (collaboratore o admin) e invia l'invito via email.
// Solo un admin attivo può chiamarla. Usa la service role key, che esiste
// SOLO lato server (variabile SUPABASE_SERVICE_ROLE_KEY, iniettata da Supabase).
//
// Deploy:  supabase functions deploy crea-collaboratore
// Body JSON: { nome, email, ruolo?: 'collaboratore' | 'admin', percentuale_default?: number, redirect_to?: string }

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1) Chi sta chiamando? Deve essere un admin attivo.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Non autenticato' }, 401)

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'Sessione non valida' }, 401)

  const { data: caller } = await admin
    .from('profiles')
    .select('ruolo, attivo')
    .eq('id', userData.user.id)
    .single()
  if (!caller || caller.ruolo !== 'admin' || !caller.attivo) {
    return json({ error: 'Solo un amministratore può creare account' }, 403)
  }

  // 2) Validazione input
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body JSON non valido' }, 400)
  }

  const nome = String(body.nome ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const ruolo = body.ruolo === 'admin' ? 'admin' : 'collaboratore'
  const percentuale = Number(body.percentuale_default ?? 0)
  const redirectTo = typeof body.redirect_to === 'string' ? body.redirect_to : undefined

  if (!nome) return json({ error: 'Il nome è obbligatorio' }, 400)
  if (!EMAIL_RE.test(email)) return json({ error: 'Email non valida' }, 400)
  if (!Number.isFinite(percentuale) || percentuale < 0 || percentuale > 100) {
    return json({ error: 'La percentuale deve essere tra 0 e 100' }, 400)
  }

  // 3) Invito: crea l'utente in auth.users (il trigger crea il profilo) e invia l'email
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nome },
    redirectTo,
  })
  if (inviteError || !invited.user) {
    const msg = inviteError?.message ?? 'Errore sconosciuto'
    const already = /already|registered|exists/i.test(msg)
    return json({ error: already ? 'Esiste già un account con questa email' : msg }, already ? 409 : 400)
  }

  // 4) Completa il profilo con ruolo e percentuale (upsert nel caso il trigger non fosse ancora passato)
  const { error: profileError } = await admin.from('profiles').upsert({
    id: invited.user.id,
    nome,
    email,
    ruolo,
    percentuale_default: percentuale,
    attivo: true,
  })
  if (profileError) return json({ error: profileError.message }, 500)

  return json({ id: invited.user.id, email, nome, ruolo })
})
