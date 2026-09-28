-- =============================================================================
-- Sito Agenzia — schema completo Supabase
-- Esegui questo script UNA volta in: Supabase → SQL Editor → New query → Run.
-- Contiene: tabelle, trigger, funzione is_admin(), view dei guadagni,
-- view pubblica del portfolio, policy RLS e bucket Storage.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Tipi
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.ruolo_utente as enum ('admin', 'collaboratore');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stato_progetto as enum ('in_lavorazione', 'consegnato', 'manutenzione');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stato_richiesta as enum ('nuova', 'letta', 'gestita');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Tabelle
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  nome                text not null default '',
  email               text not null default '',
  avatar_url          text,
  ruolo               public.ruolo_utente not null default 'collaboratore',
  percentuale_default numeric(5,2) not null default 0
                        check (percentuale_default >= 0 and percentuale_default <= 100),
  attivo              boolean not null default true,
  created_at          timestamptz not null default now()
);

create table if not exists public.progetti (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  cliente        text not null default '',
  url            text,
  categoria      text not null default '',
  descrizione    text not null default '',
  funzionalita   text[] not null default '{}',   -- per la pagina di dettaglio
  tecnologie     text[] not null default '{}',   -- per la pagina di dettaglio
  screenshot_url text,
  galleria       text[] not null default '{}',   -- screenshot aggiuntivi
  prezzo_totale  numeric(12,2) not null default 0 check (prezzo_totale >= 0),
  data_consegna  date,
  stato          public.stato_progetto not null default 'in_lavorazione',
  pubblico       boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists public.assegnazioni (
  id                 uuid primary key default gen_random_uuid(),
  progetto_id        uuid not null references public.progetti (id) on delete cascade,
  collaboratore_id   uuid not null references public.profiles (id) on delete cascade,
  percentuale        numeric(5,2) not null check (percentuale > 0 and percentuale <= 100),
  ruolo_nel_progetto text not null default '',
  created_at         timestamptz not null default now(),
  unique (progetto_id, collaboratore_id)
);

create table if not exists public.pagamenti (
  id              uuid primary key default gen_random_uuid(),
  assegnazione_id uuid not null references public.assegnazioni (id) on delete cascade,
  importo         numeric(12,2) not null check (importo > 0),
  data            date not null default current_date,
  nota            text not null default '',
  created_at      timestamptz not null default now()
);

create table if not exists public.richieste_contatto (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (char_length(nome) between 1 and 200),
  email      text not null check (char_length(email) between 3 and 320),
  telefono   text not null default '' check (char_length(telefono) <= 50),
  messaggio  text not null check (char_length(messaggio) between 1 and 5000),
  stato      public.stato_richiesta not null default 'nuova',
  created_at timestamptz not null default now()
);

create index if not exists assegnazioni_collaboratore_idx on public.assegnazioni (collaboratore_id);
create index if not exists assegnazioni_progetto_idx      on public.assegnazioni (progetto_id);
create index if not exists pagamenti_assegnazione_idx     on public.pagamenti (assegnazione_id);
create index if not exists progetti_pubblico_idx          on public.progetti (pubblico);

-- -----------------------------------------------------------------------------
-- Funzioni di supporto per le policy
-- (security definer: leggono profiles senza passare dalle RLS, evitando ricorsioni)
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and ruolo = 'admin' and attivo
  );
$$;

create or replace function public.is_attivo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and attivo
  );
$$;

revoke all on function public.is_admin()  from public;
revoke all on function public.is_attivo() from public;
grant execute on function public.is_admin()  to anon, authenticated;
grant execute on function public.is_attivo() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Trigger: crea il profilo quando nasce un utente in auth.users.
-- Il ruolo è SEMPRE 'collaboratore': l'unico modo di diventare admin è che un
-- admin (o tu, dall'SQL editor) lo imposti esplicitamente.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tiene allineata l'email del profilo con quella di auth
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Trigger: un non-admin non può cambiare ruolo, percentuale_default, attivo,
-- email né id del proprio profilo (anche chiamando direttamente l'API).
-- Le chiamate con service role / SQL editor (auth.uid() nullo) sono ammesse.
-- -----------------------------------------------------------------------------
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.ruolo is distinct from old.ruolo
     or new.percentuale_default is distinct from old.percentuale_default
     or new.attivo is distinct from old.attivo
     or new.email is distinct from old.email
     or new.id is distinct from old.id
     or new.created_at is distinct from old.created_at then
    raise exception 'Non hai i permessi per modificare questi campi del profilo'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_fields on public.profiles;
create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- -----------------------------------------------------------------------------
-- Trigger: la somma delle percentuali di un progetto non può superare il 100%
-- -----------------------------------------------------------------------------
create or replace function public.check_percentuali_progetto()
returns trigger
language plpgsql
as $$
declare
  totale numeric;
begin
  select coalesce(sum(percentuale), 0) into totale
  from public.assegnazioni
  where progetto_id = new.progetto_id and id <> new.id;

  if totale + new.percentuale > 100 then
    raise exception 'La somma delle percentuali del progetto supererebbe il 100%% (totale: %)',
      totale + new.percentuale
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists assegnazioni_check_percentuali on public.assegnazioni;
create trigger assegnazioni_check_percentuali
  before insert or update on public.assegnazioni
  for each row execute function public.check_percentuali_progetto();

-- -----------------------------------------------------------------------------
-- View dei guadagni (security_invoker: rispetta le RLS di chi interroga,
-- quindi un collaboratore vede solo le proprie righe).
-- guadagno = prezzo_totale × percentuale / 100
-- stato_pagamento calcolato confrontando pagato con dovuto.
-- -----------------------------------------------------------------------------
drop view if exists public.v_guadagni;
create view public.v_guadagni
with (security_invoker = true)
as
select
  a.id                                         as assegnazione_id,
  a.progetto_id,
  a.collaboratore_id,
  a.percentuale,
  a.ruolo_nel_progetto,
  p.nome                                       as progetto_nome,
  p.cliente,
  p.url,
  p.categoria,
  p.stato                                      as stato_progetto,
  p.data_consegna,
  p.created_at                                 as progetto_created_at,
  p.prezzo_totale,
  round(p.prezzo_totale * a.percentuale / 100, 2)                              as guadagno,
  coalesce(pg.pagato, 0)                                                       as pagato,
  greatest(round(p.prezzo_totale * a.percentuale / 100, 2) - coalesce(pg.pagato, 0), 0) as residuo,
  case
    when coalesce(pg.pagato, 0) >= round(p.prezzo_totale * a.percentuale / 100, 2)
         and round(p.prezzo_totale * a.percentuale / 100, 2) > 0 then 'pagato'
    when coalesce(pg.pagato, 0) > 0 then 'parziale'
    else 'da_pagare'
  end                                                                          as stato_pagamento
from public.assegnazioni a
join public.progetti p on p.id = a.progetto_id
left join (
  select assegnazione_id, sum(importo) as pagato
  from public.pagamenti
  group by assegnazione_id
) pg on pg.assegnazione_id = a.id;

-- -----------------------------------------------------------------------------
-- View pubblica del portfolio: espone SOLO i campi pubblici dei progetti con
-- pubblico = true (niente prezzi). È l'unico accesso ai progetti per i visitatori.
-- (È volutamente "security definer": la tabella progetti resta chiusa ad anon.)
-- -----------------------------------------------------------------------------
drop view if exists public.portfolio;
create view public.portfolio as
select id, nome, cliente, url, categoria, descrizione, funzionalita, tecnologie,
       screenshot_url, galleria, data_consegna, created_at
from public.progetti
where pubblico = true;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.progetti           enable row level security;
alter table public.assegnazioni       enable row level security;
alter table public.pagamenti          enable row level security;
alter table public.richieste_contatto enable row level security;

-- Pulizia policy (per poter rieseguire lo script)
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','progetti','assegnazioni','pagamenti','richieste_contatto')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- profiles --------------------------------------------------------------------
create policy "profiles: leggo il mio"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles: admin legge tutto"
  on public.profiles for select to authenticated
  using (public.is_admin());

create policy "profiles: aggiorno il mio"
  on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_attivo())
  with check (id = auth.uid());
  -- i campi ruolo / percentuale_default / attivo sono protetti dal trigger

create policy "profiles: admin modifica tutto"
  on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "profiles: admin elimina"
  on public.profiles for delete to authenticated
  using (public.is_admin());
-- Nessuna policy di INSERT: i profili nascono solo dal trigger su auth.users.

-- progetti --------------------------------------------------------------------
-- I visitatori leggono il portfolio tramite la view public.portfolio.
create policy "progetti: collaboratore legge i progetti assegnati"
  on public.progetti for select to authenticated
  using (
    public.is_attivo() and exists (
      select 1 from public.assegnazioni a
      where a.progetto_id = progetti.id and a.collaboratore_id = auth.uid()
    )
  );

create policy "progetti: admin tutto"
  on public.progetti for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- assegnazioni ----------------------------------------------------------------
create policy "assegnazioni: collaboratore legge le proprie"
  on public.assegnazioni for select to authenticated
  using (collaboratore_id = auth.uid() and public.is_attivo());

create policy "assegnazioni: admin tutto"
  on public.assegnazioni for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- pagamenti -------------------------------------------------------------------
create policy "pagamenti: collaboratore legge i propri"
  on public.pagamenti for select to authenticated
  using (
    public.is_attivo() and exists (
      select 1 from public.assegnazioni a
      where a.id = pagamenti.assegnazione_id and a.collaboratore_id = auth.uid()
    )
  );

create policy "pagamenti: admin tutto"
  on public.pagamenti for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- richieste_contatto ----------------------------------------------------------
create policy "richieste: chiunque può inviare"
  on public.richieste_contatto for insert to anon, authenticated
  with check (stato = 'nuova');

create policy "richieste: admin legge"
  on public.richieste_contatto for select to authenticated
  using (public.is_admin());

create policy "richieste: admin modifica"
  on public.richieste_contatto for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "richieste: admin elimina"
  on public.richieste_contatto for delete to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Grant (le RLS filtrano le righe; i grant stabiliscono cosa è raggiungibile)
-- -----------------------------------------------------------------------------
revoke all on public.profiles, public.progetti, public.assegnazioni,
              public.pagamenti, public.richieste_contatto, public.v_guadagni,
              public.portfolio
  from anon, authenticated;

grant select, update, delete         on public.profiles           to authenticated;
grant select, insert, update, delete on public.progetti           to authenticated;
grant select, insert, update, delete on public.assegnazioni       to authenticated;
grant select, insert, update, delete on public.pagamenti          to authenticated;
grant insert                         on public.richieste_contatto to anon;
grant select, insert, update, delete on public.richieste_contatto to authenticated;
grant select                         on public.v_guadagni         to authenticated;
grant select                         on public.portfolio          to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Storage: bucket pubblici in lettura per screenshot e avatar
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('screenshots', 'screenshots', true, 5242880, array['image/png','image/jpeg','image/webp','image/avif']),
  ('avatars',     'avatars',     true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "screenshots: lettura pubblica" on storage.objects;
drop policy if exists "screenshots: admin scrive"     on storage.objects;
drop policy if exists "screenshots: admin aggiorna"   on storage.objects;
drop policy if exists "screenshots: admin elimina"    on storage.objects;
drop policy if exists "avatars: lettura pubblica"     on storage.objects;
drop policy if exists "avatars: carico il mio"        on storage.objects;
drop policy if exists "avatars: aggiorno il mio"      on storage.objects;
drop policy if exists "avatars: elimino il mio"       on storage.objects;

create policy "screenshots: lettura pubblica"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'screenshots');

create policy "screenshots: admin scrive"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'screenshots' and public.is_admin());

create policy "screenshots: admin aggiorna"
  on storage.objects for update to authenticated
  using (bucket_id = 'screenshots' and public.is_admin());

create policy "screenshots: admin elimina"
  on storage.objects for delete to authenticated
  using (bucket_id = 'screenshots' and public.is_admin());

-- Gli avatar stanno in avatars/<id utente>/...
create policy "avatars: lettura pubblica"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

create policy "avatars: carico il mio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: aggiorno il mio"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: elimino il mio"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
