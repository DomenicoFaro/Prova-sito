-- =============================================================================
-- Listino prezzi PUBBLICO, ordinato in Siti web, Servizi e Abbonamenti.
-- Esegui UNA VOLTA dopo soci.sql: SQL Editor → New query → incolla → Run.
-- Si può rieseguire senza problemi.
--
--   • nuovo tipo 'abbonamento' (oltre a 'sito' e 'servizio');
--   • i visitatori (anche senza account) leggono le voci con attivo = true.
--     Le voci nascoste restano visibili solo ad admin e soci.
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

-- Lettura pubblica delle sole voci visibili
drop policy if exists "prezzi: lettura pubblica" on public.prezzi;
create policy "prezzi: lettura pubblica"
  on public.prezzi for select to anon
  using (attivo);

grant select on public.prezzi to anon;

notify pgrst, 'reload schema';
