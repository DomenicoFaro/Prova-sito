-- =============================================================================
-- Dati di esempio. Esegui DOPO schema.sql (SQL Editor → New query → Run).
--
-- 1) Inserisce i due progetti del portfolio.
-- 2) Se esiste già un utente con l'email di Diego (vedi README, passo 5),
--    gli imposta la % predefinita, lo assegna ai progetti e registra un
--    pagamento di esempio. Se l'utente non esiste ancora, questa parte viene
--    saltata: puoi rieseguire lo script dopo averlo creato.
-- =============================================================================

-- 1) Progetti --------------------------------------------------------------------
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

-- 2) Collaboratore di prova "Diego" ------------------------------------------------
do $$
declare
  diego_email constant text := 'diego@example.com';  -- ← cambia con l'email reale di Diego
  diego_id uuid;
  cafe_id uuid;
  barbiere_id uuid;
  ass_cafe uuid;
begin
  select id into diego_id from public.profiles where lower(email) = lower(diego_email);
  if diego_id is null then
    raise notice 'Utente % non trovato: crealo e poi riesegui questo script.', diego_email;
    return;
  end if;

  update public.profiles
     set nome = case when nome = '' or nome = split_part(email, '@', 1) then 'Diego' else nome end,
         ruolo = 'collaboratore',
         percentuale_default = 30
   where id = diego_id;

  select id into cafe_id     from public.progetti where nome = 'Café Sauvage'    limit 1;
  select id into barbiere_id from public.progetti where nome = 'Barbiere (demo)' limit 1;

  insert into public.assegnazioni (progetto_id, collaboratore_id, percentuale, ruolo_nel_progetto)
  values (cafe_id, diego_id, 30, 'Sviluppo')
  on conflict (progetto_id, collaboratore_id) do nothing;

  insert into public.assegnazioni (progetto_id, collaboratore_id, percentuale, ruolo_nel_progetto)
  values (barbiere_id, diego_id, 25, 'Design e sviluppo')
  on conflict (progetto_id, collaboratore_id) do nothing;

  -- Café Sauvage: 30% di 1.500 € = 450 € → pagamento parziale di 200 €
  select id into ass_cafe from public.assegnazioni
   where progetto_id = cafe_id and collaboratore_id = diego_id;

  if not exists (select 1 from public.pagamenti where assegnazione_id = ass_cafe) then
    insert into public.pagamenti (assegnazione_id, importo, data, nota)
    values (ass_cafe, 200, (date_trunc('month', current_date) - interval '1 month')::date, 'Acconto');
  end if;
end $$;
