// Modulo «Scrivici» del sito: salva il messaggio nella tabella richieste_contatto e lo manda
// via email a Forma Web. Rispondendo alla mail si scrive direttamente al cliente.
//
// Pubblica con:  supabase functions deploy contatto --no-verify-jwt
// Secret: RESEND_API_KEY, MAIL_FROM
// Facoltativo: CONTACT_EMAIL (dove arrivano i messaggi, di default formawebshop@gmail.com)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { inviaEmail } from '../_shared/email.ts'

const DESTINATARIO = 'formawebshop@gmail.com'

// Limiti contro gli abusi (e per non consumare la quota di email, usata anche dagli ordini)
const MAX_ORA_PER_EMAIL = 3
const MAX_GIORNO_TOTALI = 40

const testo = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const rigaUnica = (v: unknown) => testo(v).replace(/\s+/g, ' ')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito.' }, 405)

  try {
    const dati = await req.json().catch(() => null)
    if (!dati || typeof dati !== 'object') return json({ error: 'Messaggio non valido.' }, 400)

    // Campo nascosto nella pagina: lo compilano solo i programmi automatici
    if (testo(dati.controllo)) return json({ ok: true })

    const nome = rigaUnica(dati.nome)
    const email = rigaUnica(dati.email).toLowerCase()
    const telefono = rigaUnica(dati.telefono)
    const messaggio = testo(dati.messaggio)

    if (nome.length < 2 || nome.length > 100) return json({ error: 'Inserisci il tuo nome.' }, 400)
    if (email.length > 200 || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/.test(email)) return json({ error: 'Inserisci un indirizzo email valido.' }, 400)
    if (telefono.length > 50) return json({ error: 'Il numero di telefono è troppo lungo.' }, 400)
    if (messaggio.length < 10 || messaggio.length > 4000) return json({ error: 'Il messaggio deve avere tra 10 e 4000 caratteri.' }, 400)

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const daQuando = (ore: number) => new Date(Date.now() - ore * 60 * 60 * 1000).toISOString()
    const [stessaEmail, tutti] = await Promise.all([
      db.from('richieste_contatto').select('id', { count: 'exact', head: true }).eq('email', email).gt('created_at', daQuando(1)),
      db.from('richieste_contatto').select('id', { count: 'exact', head: true }).gt('created_at', daQuando(24)),
    ])
    if (stessaEmail.error) throw stessaEmail.error
    if (tutti.error) throw tutti.error
    if ((stessaEmail.count ?? 0) >= MAX_ORA_PER_EMAIL || (tutti.count ?? 0) >= MAX_GIORNO_TOTALI) {
      return json({ error: 'Troppi messaggi in poco tempo: riprova più tardi oppure scrivici direttamente via email.' }, 429)
    }

    const { error } = await db.from('richieste_contatto').insert({ nome, email, telefono, messaggio })
    if (error) throw error

    const inviata = await inviaEmail({
      a: Deno.env.get('CONTACT_EMAIL') || DESTINATARIO,
      rispondiA: email,
      oggetto: `Messaggio dal sito – ${nome}`,
      contenuto: {
        anteprima: messaggio.slice(0, 120),
        titolo: 'Nuovo messaggio dal sito',
        intro: [`${nome} ti ha scritto dal modulo contatti. Rispondi a questa email per scrivergli direttamente.`],
        dettagli: [
          ['Nome', nome],
          ['Email', email],
          ['Telefono', telefono || '—'],
        ],
        citazione: { titolo: 'Messaggio', testo: messaggio },
      },
    })
    // Il messaggio resta salvato, ma al cliente va detto di scrivere via email
    if (!inviata) return json({ error: 'Invio non riuscito.' }, 502)

    return json({ ok: true })
  } catch (e) {
    console.error(e)
    return json({ error: 'Errore imprevisto.' }, 500)
  }
})
