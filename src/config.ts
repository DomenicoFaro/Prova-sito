import type { NomeIcona } from './components/Icon'

// Dati del sito e testi della parte pubblica. Il dominio ufficiale è formaweb.shop. I colori sono in src/index.css.
export const SITO = {
  titolo: 'Forma Web',
  dominio: 'formaweb.shop',
  url: 'https://formaweb.shop',
  descrizione:
    'Forma Web realizza siti web su misura per attività e professionisti. Prova il tuo sito e acquistalo online: preventivo, contratto e pagamento in pochi minuti.',
}

/**
 * Contatti pubblici. Finché sono vuoti il sito non mostra nessun contatto.
 * whatsapp: numero con prefisso, senza "+" né spazi (es. 393331234567).
 */
export const CONTATTI = {
  whatsapp: '',
  email: '',
}

export const SERVIZI: {
  icona: NomeIcona
  titolo: string
  testo: string
  punti: string[]
  /** Dominio di un lavoro del portfolio da linkare come esempio */
  esempio?: string
}[] = [
  {
    icona: 'globe',
    titolo: 'Siti vetrina',
    testo: 'La tua attività raccontata in modo chiaro, subito leggibile dal telefono.',
    punti: ['Menù o listino', 'Galleria fotografica', 'Mappa, orari e contatti'],
    esempio: 'cafésauvage.com',
  },
  {
    icona: 'cart',
    titolo: 'E-commerce',
    testo: 'Un negozio online per vendere anche quando la saracinesca è abbassata.',
    punti: ['Catalogo per reparti', 'Carrello e account clienti', 'Spedizione o ritiro in sede'],
    esempio: 'prova-red-ten.vercel.app',
  },
  {
    icona: 'calendar',
    titolo: 'Prenotazioni e ordini',
    testo: 'I clienti prenotano o ordinano in autonomia, a qualsiasi ora.',
    punti: ['Disponibilità reale', 'Promemoria automatici', 'Asporto e consegna'],
    esempio: 'vogliadiparrucchieri.shop',
  },
  {
    icona: 'app',
    titolo: 'Gestionali su misura',
    testo: 'Un pannello per agenda, clienti e staff, costruito sul tuo modo di lavorare.',
    punti: ['Agenda e clienti', 'Accessi per il personale', 'Contenuti modificabili'],
    esempio: 'ilsognodellabellezza.vercel.app',
  },
  {
    icona: 'sparkles',
    titolo: 'Restyling',
    testo: 'Il sito c’è già ma sembra datato? Lo ridisegniamo da capo.',
    punti: ['Nuovo design', 'Pensato per smartphone', 'Contenuti riordinati'],
  },
]

export const FUNZIONI: { icona: NomeIcona; titolo: string; testo: string }[] = [
  { icona: 'calendar', titolo: 'Agenda sempre aggiornata', testo: 'Gli orari liberi si vedono in tempo reale, senza telefonate.' },
  { icona: 'mail', titolo: 'Promemoria automatici', testo: 'Un’email il giorno prima ricorda l’appuntamento al cliente.' },
  { icona: 'chat', titolo: 'WhatsApp a un tocco', testo: 'Chi ha un dubbio ti scrive direttamente dal sito.' },
  { icona: 'edit', titolo: 'Aggiorni tutto da solo', testo: 'Listino, foto, promozioni e chiusure dal tuo pannello.' },
  { icona: 'cart', titolo: 'Ordini online', testo: 'Menù, carrello, asporto e consegna in un unico posto.' },
  { icona: 'phone', titolo: 'Come un’app', testo: 'Il sito si può aggiungere alla schermata del telefono.' },
]

export const PASSI = [
  { titolo: 'Scegli', testo: 'Componi il tuo sito online e vedi subito un preventivo indicativo.' },
  { titolo: 'Conferma', testo: 'Confermiamo il preventivo, poi leggi il contratto, accetti e paghi online.' },
  { titolo: 'Realizzazione', testo: 'Costruiamo il sito con le funzioni che ti servono davvero.' },
  { titolo: 'Online', testo: 'Pubblichiamo e restiamo disponibili per modifiche e manutenzione.' },
]

export const DOMANDE = [
  {
    domanda: 'Il sito si vede bene dal telefono?',
    risposta: 'Sì. Lo progettiamo partendo dallo smartphone, perché è lì che molti clienti ti cercano la prima volta.',
  },
  {
    domanda: 'Posso aggiornare i contenuti da solo?',
    risposta: 'Se ti serve, aggiungiamo un pannello di gestione per cambiare prezzi, orari, foto, promozioni o menù senza toccare il codice.',
  },
  {
    domanda: 'Posso ricevere prenotazioni o ordini?',
    risposta: 'Sì: prenotazioni per saloni e centri estetici, ordini per asporto e consegna per la ristorazione, carrello per i negozi.',
  },
  {
    domanda: 'Ho già un sito: si può rifare?',
    risposta: 'Certo. Ripartiamo dai contenuti che funzionano e ridisegniamo il resto.',
  },
  {
    domanda: 'Quanto costa?',
    risposta: 'Dipende da pagine e funzioni. Con «Acquista il tuo sito» scegli quello che ti serve e vedi subito un preventivo indicativo.',
  },
  {
    domanda: 'Posso provarlo prima?',
    risposta: 'Sì, con «Prova il tuo sito» parti con un mese a prezzo ridotto: se alla fine ti piace paghi il resto, altrimenti non devi altro.',
  },
]
