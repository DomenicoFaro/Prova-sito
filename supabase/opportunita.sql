-- =============================================================================
-- Opportunità: attività con alta vendibilità (link Google Maps + dettagli).
-- L'admin (owner) le crea e modifica; i collaboratori le vedono e segnano
-- ognuno il proprio esito: "fatto" oppure "non accettato".
-- Esegui DOPO schema.sql: SQL Editor → New query → incolla → Run.
-- Si può rieseguire senza problemi.
-- =============================================================================

do $$ begin
  create type public.esito_opportunita as enum ('fatto', 'non_accettato');
exception when duplicate_object then null; end $$;

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

create table if not exists public.opportunita_esiti (
  opportunita_id    uuid not null references public.opportunita (id) on delete cascade,
  collaboratore_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  esito             public.esito_opportunita not null,
  updated_at        timestamptz not null default now(),
  primary key (opportunita_id, collaboratore_id)
);

alter table public.opportunita        enable row level security;
alter table public.opportunita_esiti  enable row level security;

drop policy if exists "opportunita: utenti attivi leggono" on public.opportunita;
drop policy if exists "opportunita: admin tutto"           on public.opportunita;
drop policy if exists "esiti: collaboratore legge i propri"   on public.opportunita_esiti;
drop policy if exists "esiti: collaboratore inserisce"        on public.opportunita_esiti;
drop policy if exists "esiti: collaboratore aggiorna"         on public.opportunita_esiti;
drop policy if exists "esiti: collaboratore elimina"          on public.opportunita_esiti;
drop policy if exists "esiti: admin tutto"                    on public.opportunita_esiti;

create policy "opportunita: utenti attivi leggono"
  on public.opportunita for select to authenticated
  using (attiva and public.is_attivo());

create policy "opportunita: admin tutto"
  on public.opportunita for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Il collaboratore gestisce solo il proprio esito, e solo su opportunità attive
create policy "esiti: collaboratore legge i propri"
  on public.opportunita_esiti for select to authenticated
  using (collaboratore_id = auth.uid() and public.is_attivo());

create policy "esiti: collaboratore inserisce"
  on public.opportunita_esiti for insert to authenticated
  with check (
    collaboratore_id = auth.uid() and public.is_attivo()
    and exists (select 1 from public.opportunita o where o.id = opportunita_id and o.attiva)
  );

create policy "esiti: collaboratore aggiorna"
  on public.opportunita_esiti for update to authenticated
  using (collaboratore_id = auth.uid() and public.is_attivo())
  with check (collaboratore_id = auth.uid());

create policy "esiti: collaboratore elimina"
  on public.opportunita_esiti for delete to authenticated
  using (collaboratore_id = auth.uid() and public.is_attivo());

create policy "esiti: admin tutto"
  on public.opportunita_esiti for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.opportunita, public.opportunita_esiti from anon, authenticated;
grant select, insert, update, delete on public.opportunita, public.opportunita_esiti to authenticated;

-- Fa vedere subito le nuove tabelle all'API del sito
notify pgrst, 'reload schema';
