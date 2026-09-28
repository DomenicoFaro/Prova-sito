// Dati dell'agenzia: modifica qui nome, slogan e contatti.
export const AGENZIA = {
  nome: 'Nome Agenzia',
  slogan: 'Siti web che lavorano per il tuo business.',
  descrizione:
    'Progettiamo e sviluppiamo siti vetrina, e-commerce, web app e sistemi di prenotazione online: veloci, curati nei dettagli e pensati per portare clienti.',
  email: 'info@nomeagenzia.it',
  telefono: '+39 000 000 0000',
  // Numero in formato internazionale senza "+" né spazi, per il link WhatsApp
  whatsapp: '390000000000',
  citta: 'Italia',
}

export const SERVIZI = [
  {
    titolo: 'Siti vetrina',
    testo: 'Il biglietto da visita online della tua attività: chiaro, veloce e facile da trovare su Google.',
    icona: 'globe',
  },
  {
    titolo: 'E-commerce',
    testo: 'Negozi online completi di catalogo, carrello e pagamenti, facili da gestire in autonomia.',
    icona: 'cart',
  },
  {
    titolo: 'Web app',
    testo: 'Gestionali, aree riservate e strumenti su misura per automatizzare il tuo lavoro.',
    icona: 'app',
  },
  {
    titolo: 'Prenotazioni online',
    testo: 'I tuoi clienti prenotano in autonomia 24/7: meno telefonate, più appuntamenti.',
    icona: 'calendar',
  },
  {
    titolo: 'Restyling',
    testo: 'Rinnoviamo il tuo sito attuale: design moderno, prestazioni migliori, più contatti.',
    icona: 'sparkles',
  },
] as const
