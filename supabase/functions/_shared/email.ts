// Invio email con Resend. Secret: RESEND_API_KEY, MAIL_FROM (es. "Forma Web <ordini@tuodominio.it>"), ADMIN_EMAIL, SITE_URL
export const esc = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function emailConfigurata() {
  return Boolean(Deno.env.get('RESEND_API_KEY') && Deno.env.get('MAIL_FROM'))
}

export async function inviaEmail(a: string, oggetto: string, html: string, replyTo?: string): Promise<boolean> {
  const chiave = Deno.env.get('RESEND_API_KEY')
  const da = Deno.env.get('MAIL_FROM')
  if (!chiave || !da || !a) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chiave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: da, to: [a], subject: oggetto, html, reply_to: replyTo }),
  })
  if (!res.ok) console.error('Resend:', res.status, await res.text())
  return res.ok
}

export const numeroOrdine = (n: number) => `W-${String(n).padStart(5, '0')}`
export const linkOrdine = (token: string) => `${Deno.env.get('SITE_URL')?.replace(/\/+$/, '')}/ordine/${token}`

export const euro = (n: number | null) =>
  n == null ? '—' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
