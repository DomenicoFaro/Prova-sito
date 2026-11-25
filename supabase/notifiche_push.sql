-- =============================================================================
-- Notifiche sul telefono e sul computer per i ticket.
-- Esegui DOPO clienti_recensioni.sql: SQL Editor → New query → incolla → Run.
-- Si può rieseguire. Se rilanci clienti_recensioni.sql, rilancia anche questo.
-- Poi pubblica la funzione supabase/functions/notifica-ticket (senza «Verify JWT»).
-- =============================================================================

-- Dispositivi che hanno accettato le notifiche
create table if not exists public.push_iscrizioni (
  endpoint    text primary key check (
    char_length(endpoint) <= 1000
    -- Solo i servizi push di Apple, Google, Mozilla e Microsoft
    and endpoint ~* '^https://([a-z0-9-]+\.)*(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)/'
  ),
  utente_id   uuid not null references public.profiles (id) on delete cascade,
  p256dh      text not null check (char_length(p256dh) between 40 and 200),
  auth        text not null check (char_length(auth) between 10 and 100),
  dispositivo text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists push_iscrizioni_utente_idx on public.push_iscrizioni (utente_id);

-- Chiavi che identificano il sito presso i servizi push (le crea la funzione al primo uso).
-- Le legge SOLO la funzione sul server.
create table if not exists public.push_chiavi (
  id       integer primary key default 1 check (id = 1),
  pubblica text not null,
  privata  jsonb not null
);

-- Quali messaggi hanno già generato la notifica (quelli esistenti non la generano)
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'ticket_messaggi' and column_name = 'notificato') then
    alter table public.ticket_messaggi add column notificato boolean not null default false;
    update public.ticket_messaggi set notificato = true;
  end if;
end $$;
alter table public.tickets add column if not exists avviso_collaboratore boolean not null default false;

-- Registra il dispositivo di chi è collegato (un dispositivo = l'ultimo che ha fatto accesso)
create or replace function public.salva_push(p_endpoint text, p_p256dh text, p_auth text, p_dispositivo text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_attivo() or public.is_cliente()) then
    raise exception 'Devi accedere per attivare le notifiche.' using errcode = '42501';
  end if;
  insert into public.push_iscrizioni (endpoint, utente_id, p256dh, auth, dispositivo)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(coalesce(p_dispositivo, ''), 200))
  on conflict (endpoint) do update
    set utente_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, dispositivo = excluded.dispositivo;
end;
$$;

revoke all on function public.salva_push(text, text, text, text) from public, anon;
grant execute on function public.salva_push(text, text, text, text) to authenticated;

-- Assegnando un ticket, il collaboratore viene avvisato
create or replace function public.assegna_ticket(p_ticket uuid, p_collaboratore uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministratore assegna i ticket.' using errcode = '42501';
  end if;
  if p_collaboratore is not null and not exists (
    select 1 from public.profiles where id = p_collaboratore and attivo and ruolo::text <> 'cliente') then
    raise exception 'Collaboratore non valido.' using errcode = '22023';
  end if;
  update public.tickets
     set collaboratore_id = p_collaboratore, letto_collaboratore_il = null,
         avviso_collaboratore = p_collaboratore is not null and p_collaboratore is distinct from collaboratore_id
   where id = p_ticket;
end;
$$;

alter table public.push_iscrizioni enable row level security;
alter table public.push_chiavi     enable row level security;

drop policy if exists "push_iscrizioni: le mie, leggo"   on public.push_iscrizioni;
drop policy if exists "push_iscrizioni: le mie, elimino" on public.push_iscrizioni;
create policy "push_iscrizioni: le mie, leggo"
  on public.push_iscrizioni for select to authenticated using (utente_id = auth.uid());
create policy "push_iscrizioni: le mie, elimino"
  on public.push_iscrizioni for delete to authenticated using (utente_id = auth.uid());

revoke all on public.push_iscrizioni, public.push_chiavi from anon, authenticated;
grant select, delete on public.push_iscrizioni to authenticated;

-- La funzione sul server
grant usage on schema public to service_role;
grant select, delete on public.push_iscrizioni to service_role;
grant select, insert on public.push_chiavi     to service_role;
grant select, update on public.tickets, public.ticket_messaggi to service_role;
grant select         on public.profiles        to service_role;

notify pgrst, 'reload schema';
