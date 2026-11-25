-- =============================================================================
-- Dati di esempio. Esegui DOPO schema.sql (SQL Editor → New query → Run).
--
-- Inserisce i due progetti del portfolio. Si può rieseguire senza creare doppioni.
-- =============================================================================

-- Progetti --------------------------------------------------------------------
insert into public.progetti
  (nome, cliente, url, categoria, descrizione, funzionalita, tecnologie,
   prezzo_totale, data_consegna, stato, pubblico)
select * from (values
  (
    'Café Sauvage',
    'Café Sauvage',
    'https://cafésauvage.com',
    'Ristorazione',
    'Sito vetrina per una caffetteria: atmosfera, menù sempre aggiornato, orari e posizione, pensato per convertire le visite da smartphone in clienti al banco.',
    array['Menù consultabile da mobile', 'Galleria fotografica', 'Mappa e orari di apertura', 'Collegamento ai social', 'SEO locale'],
    array['React', 'Tailwind CSS', 'Vercel'],
    1500.00::numeric,
    (date_trunc('month', current_date) - interval '2 months')::date,
    'consegnato'::public.stato_progetto,
    true
  ),
  (
    'Barbiere (demo)',
    'Demo — Barbiere',
    'https://bozza-barbiere.vercel.app',
    'Beauty',
    'Demo di sito per barbiere con prenotazione online degli appuntamenti: il cliente sceglie servizio, giorno e orario in pochi tocchi.',
    array['Prenotazioni online', 'Listino servizi', 'Gestione orari e disponibilità', 'Design mobile first'],
    array['React', 'TypeScript', 'Supabase', 'Vercel'],
    1200.00::numeric,
    current_date,
    'in_lavorazione'::public.stato_progetto,
    true
  )
) as v(nome, cliente, url, categoria, descrizione, funzionalita, tecnologie,
       prezzo_totale, data_consegna, stato, pubblico)
where not exists (select 1 from public.progetti p where p.nome = v.nome);
