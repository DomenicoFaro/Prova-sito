// Invio email con Resend + modello grafico unico (logo Forma Web) per tutte le email del sito.
//
// Secret: RESEND_API_KEY, MAIL_FROM (es. "Forma Web <ordini@formaweb.shop>"), SITE_URL
// Facoltativi: ADMIN_EMAIL (dove arrivano le notifiche), MAIL_REPLY_TO (default = ADMIN_EMAIL)
//
// Anti-spam: mittente sul dominio verificato su Resend (SPF/DKIM/DMARC), versione testo
// puro oltre all'HTML, Reply-To reale, oggetto sobrio, logo servito dal tuo dominio.

export const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const sito = () => (Deno.env.get('SITE_URL') ?? 'https://formaweb.shop').replace(/\/+$/, '')

export const euro = (n: number | string | null | undefined) =>
  n == null || n === ''
    ? '—'
    : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n))

export const numeroOrdine = (n: number) => `W-${String(n).padStart(5, '0')}`

export type Riga = [etichetta: string, valore: string]

export interface ContenutoEmail {
  /** Testo grigio mostrato nell'anteprima della casella di posta */
  anteprima: string
  titolo: string
  /** Paragrafi introduttivi (testo semplice) */
  intro: string[]
  /** Tabella etichetta → valore */
  dettagli?: Riga[]
  /** Blocco di testo lungo (es. descrizione del cliente) */
  citazione?: { titolo: string; testo: string }
  pulsante?: { testo: string; url: string }
  /** Paragrafi dopo il pulsante */
  chiusura?: string[]
}

const NERO = '#000000'
const BLU = '#2f7bff'

/** Costruisce { html, text } dal contenuto. Layout a tabelle, stili inline: funziona in Gmail, Outlook, Apple Mail. */
export function componiEmail(c: ContenutoEmail) {
  const url = sito()
  const logo = `${url}/logo-compatto.jpg`

  const paragrafo = (t: string) =>
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#334155;">${esc(t)}</p>`

  const dettagli = c.dettagli?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border:1px solid #e2e8f0;border-radius:12px;border-collapse:separate;overflow:hidden;">${c.dettagli
        .map(
          ([k, v], i) =>
            `<tr><td style="padding:11px 16px;font-size:13px;color:#64748b;width:38%;vertical-align:top;${i ? 'border-top:1px solid #e2e8f0;' : ''}background:#f8fafc;">${esc(k)}</td><td style="padding:11px 16px;font-size:14px;color:#0f172a;font-weight:600;vertical-align:top;${i ? 'border-top:1px solid #e2e8f0;' : ''}">${esc(v)}</td></tr>`,
        )
        .join('')}</table>`
    : ''

  const citazione = c.citazione?.testo
    ? `<div style="margin:0 0 22px;padding:14px 16px;border-left:3px solid ${BLU};background:#f1f5f9;border-radius:0 10px 10px 0;"><div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin-bottom:6px;">${esc(c.citazione.titolo)}</div><div style="font-size:14px;line-height:1.6;color:#1e293b;white-space:pre-wrap;">${esc(c.citazione.testo)}</div></div>`
    : ''

  const pulsante = c.pulsante
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 24px;"><tr><td style="border-radius:10px;background:${BLU};"><a href="${esc(c.pulsante.url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(c.pulsante.testo)}</a></td></tr></table>`
    : ''

  const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.titolo)}</title></head>
<body style="margin:0;padding:0;background:#eef1f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(c.anteprima)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;"><tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr><td align="center" bgcolor="${NERO}" style="background:${NERO};padding:26px 24px 22px;">
      <a href="${esc(url)}" style="text-decoration:none;"><img src="${esc(logo)}" width="240" alt="Forma Web" style="display:block;width:240px;max-width:100%;height:auto;border:0;"></a>
    </td></tr>
    <tr><td style="height:3px;line-height:3px;font-size:3px;background:${BLU};">&nbsp;</td></tr>
    <tr><td style="padding:34px 32px 10px;">
      <h1 style="margin:0 0 18px;font-size:23px;line-height:1.3;color:#0f172a;">${esc(c.titolo)}</h1>
      ${c.intro.map(paragrafo).join('')}
      ${dettagli}${citazione}${pulsante}
      ${(c.chiusura ?? []).map(paragrafo).join('')}
    </td></tr>
    <tr><td style="padding:22px 32px 30px;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">Forma Web · siti web su misura per attività e professionisti<br><a href="${esc(url)}" style="color:#64748b;text-decoration:underline;">${esc(url.replace(/^https?:\/\//, ''))}</a></p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`

  const testo = [
    c.titolo,
    '',
    ...c.intro,
    ...(c.dettagli?.length ? ['', ...c.dettagli.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(c.citazione?.testo ? ['', `${c.citazione.titolo}:`, c.citazione.testo] : []),
    ...(c.pulsante ? ['', `${c.pulsante.testo}: ${c.pulsante.url}`] : []),
    ...(c.chiusura?.length ? ['', ...c.chiusura] : []),
    '',
    '—',
    `Forma Web · ${url}`,
  ].join('\n')

  return { html, text: testo }
}

export interface OpzioniInvio {
  a: string
  oggetto: string
  contenuto: ContenutoEmail
  /** Dove va la risposta se qualcuno risponde alla mail */
  rispondiA?: string
  allegato?: { nome: string; contenuto: string }
}

export async function inviaEmail(o: OpzioniInvio) {
  const chiave = Deno.env.get('RESEND_API_KEY')
  const da = Deno.env.get('MAIL_FROM')
  if (!chiave || !da) {
    console.error('Email non inviata: mancano RESEND_API_KEY o MAIL_FROM')
    return false
  }
  const { html, text } = componiEmail(o.contenuto)
  const rispondiA = o.rispondiA ?? Deno.env.get('MAIL_REPLY_TO') ?? Deno.env.get('ADMIN_EMAIL')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chiave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: da,
      to: [o.a],
      subject: o.oggetto,
      html,
      text,
      reply_to: rispondiA || undefined,
      attachments: o.allegato ? [{ filename: o.allegato.nome, content: o.allegato.contenuto }] : undefined,
    }),
  })
  if (!res.ok) console.error('Resend:', res.status, await res.text())
  return res.ok
}
