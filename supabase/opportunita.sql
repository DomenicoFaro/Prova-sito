-- =============================================================================
-- Opportunità: attività con alta vendibilità (link Google Maps + dettagli).
--
-- * L'admin le crea e modifica: le vedono tutti i collaboratori (owner_id null).
-- * Ogni collaboratore può aggiungere i PROPRI link (owner_id = suo id):
--   li vede solo lui, e l'admin vede tutto.
-- * Opportunità dell'admin: un collaboratore ne "prende in carico" UNA alla
--   volta e ha 12 ore per rispondere "venduto", "interessato" o "non interessato". Finché è in
--   carico gli altri non la vedono. Se scadono le 12 ore senza risposta torna
--   visibile a tutti e chi l'aveva preso non può più riprenderla.
--
-- Esegui DOPO schema.sql: SQL Editor → New query → incolla → Run.
-- Si può rieseguire senza problemi.
-- =============================================================================

create table if not exists public.opportunita (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (char_length(trim(nome)) between 1 and 200),
  maps_url    text not null check (maps_url ~* '^https?://' and char_length(maps_url) <= 2000),
  categoria   text not null default '' check (char_length(categoria) <= 100),
  indirizzo   text not null default '' check (char_length(indirizzo) <= 300),
  dettagli    text not null default '' check (char_length(dettagli) <= 5000),
  attiva      boolean not null default true,   -- se false i collaboratori non la vedono
  created_at  timestamptz not null default now()
);

-- null = creata dall'admin (condivisa); valorizzato = link privato del collaboratore
alter table public.opportunita
  add column if not exists owner_id uuid references public.profiles (id) on delete cascade;

create table if not exists public.opportunita_esiti (
  opportunita_id    uuid not null references public.opportunita (id) on delete cascade,
  collaboratore_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  esito             text not null,
  updated_at        timestamptz not null default now(),
  primary key (opportunita_id, collaboratore_id)
);

-- Prese in carico. La riga resta anche dopo la scadenza: la chiave primaria
-- impedisce a chi l'ha lasciata scadere di riprenderla.
-- Migrazione dal vecchio tipo (fatto / non_accettato) a venduto / interessato / non_interessato
alter table public.opportunita_esiti alter column esito type text using esito::text;
alter table public.opportunita_esiti drop constraint if exists opportunita_esiti_esito_check;
update public.opportunita_esiti set esito = 'venduto'         where esito = 'fatto';
update public.opportunita_esiti set esito = 'non_interessato' where esito = 'non_accettato';
alter table public.opportunita_esiti
  add constraint opportunita_esiti_esito_check check (esito in ('venduto', 'interessato', 'non_interessato'));
drop type if exists public.esito_opportunita;

create table if not exists public.opportunita_prese (
  opportunita_id    uuid not null references public.opportunita (id) on delete cascade,
  collaboratore_id  uuid not null references public.profiles (id) on delete cascade,
  preso_il          timestamptz not null default now(),
  scade_il          timestamptz not null default now() + interval '12 hours',
  primary key (opportunita_id, collaboratore_id)
);

alter table public.opportunita        enable row level security;
alter table public.opportunita_esiti  enable row level security;
alter table public.opportunita_prese  enable row level security;

-- -----------------------------------------------------------------------------
-- Funzioni di supporto (security definer: le prese degli altri non sono leggibili)
-- -----------------------------------------------------------------------------

-- Presa "attiva" = non scaduta e senza ancora una risposta.
create or replace function public.opportunita_occupata_da_altri(p_opp uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.opportunita_prese p
    where p.opportunita_id = p_opp
      and p.collaboratore_id <> auth.uid()
      and p.scade_il > now()
      and not exists (
        select 1 from public.opportunita_esiti e
        where e.opportunita_id = p.opportunita_id and e.collaboratore_id = p.collaboratore_id
      )
  );
$$;

create or replace function public.ho_presa_attiva(p_opp uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.opportunita_prese p
    where p.opportunita_id = p_opp
      and p.collaboratore_id = auth.uid()
      and p.scade_il > now()
  );
$$;

revoke all on function public.opportunita_occupata_da_altri(uuid) from public;
revoke all on function public.ho_presa_attiva(uuid) from public;
grant execute on function public.opportunita_occupata_da_altri(uuid) to authenticated;
grant execute on function public.ho_presa_attiva(uuid) to authenticated;

-- Prende in carico un'opportunità: una alla volta, 12 ore per rispondere.
create or replace function public.prendi_in_carico(p_opp uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  me  uuid := auth.uid();
  scad timestamptz;
begin
  if me is null or not public.is_attivo() then
    raise exception 'Non hai i permessi per eseguire questa operazione.';
  end if;

  -- serializza le richieste dello stesso collaboratore e sulla stessa opportunità
  perform pg_advisory_xact_lock(hashtext('prese:' || me::text));
  perform pg_advisory_xact_lock(hashtext('prese:' || p_opp::text));

  if not exists (
    select 1 from public.opportunita o where o.id = p_opp and o.attiva and o.owner_id is null
  ) then
    raise exception 'Opportunità non disponibile.';
  end if;

  if exists (select 1 from public.opportunita_prese p where p.opportunita_id = p_opp and p.collaboratore_id = me) then
    raise exception 'Hai già preso in carico questa opportunità: non puoi riprenderla.';
  end if;

  if exists (
    select 1 from public.opportunita_prese p
    where p.collaboratore_id = me
      and p.scade_il > now()
      and not exists (
        select 1 from public.opportunita_esiti e
        where e.opportunita_id = p.opportunita_id and e.collaboratore_id = me
      )
  ) then
    raise exception 'Hai già un''opportunità in carico: rispondi Fatto o Non accettato prima di prenderne un''altra.';
  end if;

  if public.opportunita_occupata_da_altri(p_opp) then
    raise exception 'Questa opportunità è già in carico a un altro collaboratore.';
  end if;

  insert into public.opportunita_prese (opportunita_id, collaboratore_id)
  values (p_opp, me)
  returning scade_il into scad;
  return scad;
end;
$$;

revoke all on function public.prendi_in_carico(uuid) from public;
grant execute on function public.prendi_in_carico(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Policy
-- -----------------------------------------------------------------------------
drop policy if exists "opportunita: utenti attivi leggono"    on public.opportunita;
drop policy if exists "opportunita: admin tutto"              on public.opportunita;
drop policy if exists "opportunita: collaboratore inserisce"  on public.opportunita;
drop policy if exists "opportunita: collaboratore aggiorna"   on public.opportunita;
drop policy if exists "opportunita: collaboratore elimina"    on public.opportunita;
drop policy if exists "esiti: collaboratore legge i propri"   on public.opportunita_esiti;
drop policy if exists "esiti: collaboratore inserisce"        on public.opportunita_esiti;
drop policy if exists "esiti: collaboratore aggiorna"         on public.opportunita_esiti;
drop policy if exists "esiti: collaboratore elimina"          on public.opportunita_esiti;
drop policy if exists "esiti: admin tutto"                    on public.opportunita_esiti;
drop policy if exists "prese: collaboratore legge le proprie" on public.opportunita_prese;
drop policy if exists "prese: admin legge"                    on public.opportunita_prese;

-- Un'opportunità condivisa sparisce per gli altri finché è in carico a qualcuno
create policy "opportunita: utenti attivi leggono"
  on public.opportunita for select to authenticated
  using (
    public.is_attivo()
    and (
      owner_id = auth.uid()
      or (
        owner_id is null and attiva
        and (
          exists (select 1 from public.opportunita_prese p
                  where p.opportunita_id = opportunita.id and p.collaboratore_id = auth.uid())
          or not public.opportunita_occupata_da_altri(opportunita.id)
        )
      )
    )
  );

create policy "opportunita: admin tutto"
  on public.opportunita for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "opportunita: collaboratore inserisce"
  on public.opportunita for insert to authenticated
  with check (owner_id = auth.uid() and public.is_attivo());

create policy "opportunita: collaboratore aggiorna"
  on public.opportunita for update to authenticated
  using (owner_id = auth.uid() and public.is_attivo())
  with check (owner_id = auth.uid());

create policy "opportunita: collaboratore elimina"
  on public.opportunita for delete to authenticated
  using (owner_id = auth.uid() and public.is_attivo());

-- Esiti: sui link propri sempre; sulle opportunità condivise solo con una
-- presa in carico ancora valida (entro le 12 ore).
create policy "esiti: collaboratore legge i propri"
  on public.opportunita_esiti for select to authenticated
  using (collaboratore_id = auth.uid() and public.is_attivo());

create policy "esiti: collaboratore inserisce"
  on public.opportunita_esiti for insert to authenticated
  with check (
    collaboratore_id = auth.uid() and public.is_attivo()
    and (
      exists (select 1 from public.opportunita o where o.id = opportunita_id and o.owner_id = auth.uid())
      or public.ho_presa_attiva(opportunita_id)
    )
  );

create policy "esiti: collaboratore aggiorna"
  on public.opportunita_esiti for update to authenticated
  using (
    collaboratore_id = auth.uid() and public.is_attivo()
    and (
      exists (select 1 from public.opportunita o where o.id = opportunita_id and o.owner_id = auth.uid())
      or public.ho_presa_attiva(opportunita_id)
    )
  )
  with check (collaboratore_id = auth.uid());

-- Annullare l'esito è possibile solo sui propri link (non aggira le 12 ore)
create policy "esiti: collaboratore elimina"
  on public.opportunita_esiti for delete to authenticated
  using (
    collaboratore_id = auth.uid() and public.is_attivo()
    and exists (select 1 from public.opportunita o where o.id = opportunita_id and o.owner_id = auth.uid())
  );

create policy "esiti: admin tutto"
  on public.opportunita_esiti for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Prese: si scrivono solo con prendi_in_carico()
create policy "prese: collaboratore legge le proprie"
  on public.opportunita_prese for select to authenticated
  using (collaboratore_id = auth.uid() and public.is_attivo());

create policy "prese: admin legge"
  on public.opportunita_prese for select to authenticated
  using (public.is_admin());

revoke all on public.opportunita, public.opportunita_esiti, public.opportunita_prese from anon, authenticated;
grant select, insert, update, delete on public.opportunita, public.opportunita_esiti to authenticated;
grant select on public.opportunita_prese to authenticated;

-- Fa vedere subito le nuove tabelle e funzioni all'API del sito
notify pgrst, 'reload schema';
