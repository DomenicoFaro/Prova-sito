// Invio email con Resend + modello grafico unico (colori e marchio del sito) per tutte le email.
//
// Secret: RESEND_API_KEY, MAIL_FROM (es. "Forma Web <ordini@formaweb.shop>")
// Facoltativi: ADMIN_EMAIL (dove arrivano le notifiche), MAIL_REPLY_TO (default = ADMIN_EMAIL)
//
// Anti-spam: mittente sul dominio verificato su Resend (SPF/DKIM/DMARC), versione testo
// puro oltre all'HTML, Reply-To reale, oggetto sobrio. Nessuna immagine: il marchio è testo,
// quindi si vede anche con le immagini bloccate.

export const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Indirizzo usato in tutti i link per i clienti: sempre il dominio ufficiale (come in src/config.ts). */
export const sito = () => 'https://formaweb.shop'
const CONTATTO = 'formawebshop@gmail.com'

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

// Gli stessi colori del sito (src/index.css)
const SCURO = '#062019'
const VERDE = '#0c382b'
const LIME = '#cdf564'
const NEBBIA = '#f0f4ec'
const BORDO = '#e1e9da'
const TESTO = '#334155'
const TENUE = '#64748b'
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"

/** Costruisce { html, text } dal contenuto. Layout a tabelle, stili inline: funziona in Gmail, Outlook, Apple Mail. */
export function componiEmail(c: ContenutoEmail) {
  const url = sito()
  const dominio = url.replace(/^https?:\/\//, '')

  const paragrafo = (t: string) =>
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${TESTO};">${esc(t)}</p>`

  const dettagli = c.dettagli?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border:1px solid ${BORDO};border-radius:16px;border-collapse:separate;overflow:hidden;">${c.dettagli
        .map(
          ([k, v], i) =>
            `<tr><td bgcolor="${NEBBIA}" style="padding:12px 16px;font-size:13px;color:${TENUE};width:38%;vertical-align:top;${i ? `border-top:1px solid ${BORDO};` : ''}background:${NEBBIA};">${esc(k)}</td><td style="padding:12px 16px;font-size:14px;color:${SCURO};font-weight:600;vertical-align:top;word-break:break-word;${i ? `border-top:1px solid ${BORDO};` : ''}">${esc(v)}</td></tr>`,
        )
        .join('')}</table>`
    : ''

  const citazione = c.citazione?.testo
    ? `<div style="margin:0 0 22px;padding:16px 18px;border-left:4px solid ${LIME};background:${NEBBIA};border-radius:0 14px 14px 0;"><div style="font-size:13px;font-weight:600;color:${VERDE};margin-bottom:6px;">${esc(c.citazione.titolo)}</div><div style="font-size:14px;line-height:1.6;color:${SCURO};white-space:pre-wrap;word-break:break-word;">${esc(c.citazione.testo)}</div></div>`
    : ''

  // Sotto il pulsante c'è anche l'indirizzo scritto per esteso, per chi non riesce a premerlo
  const pulsante = c.pulsante
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 12px;"><tr><td bgcolor="${VERDE}" style="border-radius:999px;background:${VERDE};"><a href="${esc(c.pulsante.url)}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${esc(c.pulsante.testo)} &rarr;</a></td></tr></table>
      <p style="margin:0 0 24px;font-size:12px;line-height:1.6;color:${TENUE};word-break:break-all;">Se il pulsante non funziona, copia questo indirizzo nel browser:<br><a href="${esc(c.pulsante.url)}" style="color:${VERDE};">${esc(c.pulsante.url)}</a></p>`
    : ''

  const marchio = `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td width="44" height="44" align="center" valign="middle" bgcolor="${LIME}" style="width:44px;height:44px;border-radius:13px;background:${LIME};font-family:${FONT};font-size:27px;line-height:44px;font-weight:800;color:${SCURO};">&#923;</td>
        <td style="padding-left:12px;font-family:${FONT};font-size:25px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">forma<span style="color:${LIME};">web</span></td>
      </tr></table>`

  const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.titolo)}</title></head>
<body style="margin:0;padding:0;background:${NEBBIA};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(c.anteprima)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NEBBIA}" style="background:${NEBBIA};"><tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;font-family:${FONT};">
    <tr><td bgcolor="${SCURO}" style="background:${SCURO};padding:26px 32px;">
      <a href="${esc(url)}" style="text-decoration:none;">${marchio}</a>
    </td></tr>
    <tr><td bgcolor="${LIME}" style="height:5px;line-height:5px;font-size:5px;background:${LIME};">&nbsp;</td></tr>
    <tr><td style="padding:36px 32px 10px;">
      <h1 style="margin:0 0 18px;font-size:27px;line-height:1.2;font-weight:800;letter-spacing:-0.5px;color:${SCURO};">${esc(c.titolo)}</h1>
      ${c.intro.map(paragrafo).join('')}
      ${dettagli}${citazione}${pulsante}
      ${(c.chiusura ?? []).map(paragrafo).join('')}
    </td></tr>
    <tr><td bgcolor="${SCURO}" style="background:${SCURO};padding:24px 32px 28px;">
      <p style="margin:0;font-size:13px;line-height:1.7;color:#b0ddc5;"><strong style="color:#ffffff;">Forma Web</strong> · siti web su misura per attività e professionisti<br><a href="${esc(url)}" style="color:${LIME};text-decoration:none;">${esc(dominio)}</a> · <a href="mailto:${CONTATTO}" style="color:${LIME};text-decoration:none;">${CONTATTO}</a></p>
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
    `Forma Web · ${url} · ${CONTATTO}`,
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
