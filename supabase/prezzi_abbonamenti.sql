-- =============================================================================
-- Listino prezzi INTERNO con il tipo «Abbonamento»: Siti web, Servizi, Abbonamenti.
-- Esegui UNA VOLTA dopo soci.sql: SQL Editor → New query → incolla → Run.
-- Si può rieseguire senza problemi.
--
--   • nuovo tipo 'abbonamento' (oltre a 'sito' e 'servizio');
--   • il listino lo vedono SOLO gli utenti con un account (collaboratori, soci, admin),
--     dalla pagina Area riservata → Prezzi. I visitatori del sito NON lo leggono.
--     Se avevi già eseguito la vecchia versione «prezzi pubblici», questo script
--     toglie l'accesso pubblico.
-- =============================================================================

-- Tipo 'abbonamento'. Alla prima esecuzione i servizi già inseriti con
-- periodicità «al mese» / «all'anno» passano ad abbonamenti (poi li correggi
-- dall'area riservata se serve).
do $$
declare
  vecchio boolean;
begin
  select not exists (
    select 1 from pg_constraint
    where conrelid = 'public.prezzi'::regclass and conname = 'prezzi_tipo_check'
      and pg_get_constraintdef(oid) like '%abbonamento%'
  ) into vecchio;

  if vecchio then
    alter table public.prezzi drop constraint if exists prezzi_tipo_check;
    alter table public.prezzi
      add constraint prezzi_tipo_check check (tipo in ('sito', 'servizio', 'abbonamento'));
    update public.prezzi
       set tipo = 'abbonamento'
     where tipo = 'servizio' and lower(periodicita) in ('al mese', 'mensile', 'all''anno', 'annuale', 'al anno');
  end if;
end $$;

-- Niente lettura pubblica: solo chi ha un account (policy «lettura utenti» di soci.sql)
drop policy if exists "prezzi: lettura pubblica" on public.prezzi;
revoke select on public.prezzi from anon;

notify pgrst, 'reload schema';
