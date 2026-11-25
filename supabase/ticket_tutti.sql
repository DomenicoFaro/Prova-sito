-- =============================================================================
-- «Vede tutti i ticket»: un collaboratore di fiducia legge, risponde e riceve le
-- notifiche di tutti i ticket, senza diventare admin (niente incassi, clienti,
-- cassaforte). Si spunta in Area riservata → Collaboratori → Modifica.
-- Esegui DOPO clienti_recensioni.sql e notifiche_push.sql:
-- SQL Editor → New query → incolla → Run. Si può rieseguire.
-- Se rilanci uno di quei due script, rilancia anche questo.
-- Poi ripubblica la funzione notifica-ticket (per le notifiche).
-- =============================================================================
alter table public.profiles add column if not exists vede_tutti_ticket boolean not null default false;

-- Lo assegna solo l'admin: nessuno può darselo modificando il proprio profilo
create or replace function public.proteggi_vede_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and new.vede_tutti_ticket is distinct from old.vede_tutti_ticket then
    raise exception 'Solo l''amministratore decide chi vede tutti i ticket.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_proteggi_ticket on public.profiles;
create trigger profiles_proteggi_ticket
  before update on public.profiles
  for each row execute function public.proteggi_vede_ticket();

-- Chi lavora il ticket: l'admin, il collaboratore assegnato, chi vede tutti i ticket
create or replace function public.lavora_ticket(p_collaboratore uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin()
      or (public.is_attivo() and (
            p_collaboratore = auth.uid()
            or exists (select 1 from public.profiles where id = auth.uid() and vede_tutti_ticket)
         ));
$$;

-- Fin dove ha letto chi vede tutti i ticket (ognuno per sé)
create table if not exists public.ticket_letture (
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  utente_id uuid not null references public.profiles (id) on delete cascade,
  letto_il  timestamptz not null default clock_timestamp(),
  primary key (ticket_id, utente_id)
);

alter table public.ticket_letture enable row level security;
drop policy if exists "ticket_letture: le mie" on public.ticket_letture;
create policy "ticket_letture: le mie"
  on public.ticket_letture for select to authenticated using (utente_id = auth.uid());
revoke all on public.ticket_letture from anon, authenticated;
grant select on public.ticket_letture to authenticated;

create or replace function public.segna_letto_ticket(p_ticket uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tickets
     set letto_admin_il         = case when public.is_admin() then clock_timestamp() else letto_admin_il end,
         letto_collaboratore_il = case when public.is_attivo() and collaboratore_id = auth.uid() then clock_timestamp() else letto_collaboratore_il end,
         letto_richiedente_il   = case when public.is_cliente() and cliente_id = auth.uid() then clock_timestamp() else letto_richiedente_il end
   where id = p_ticket
     and (public.lavora_ticket(collaboratore_id) or (public.is_cliente() and cliente_id = auth.uid()));

  insert into public.ticket_letture (ticket_id, utente_id)
  select id, auth.uid() from public.tickets
   where id = p_ticket and public.lavora_ticket(collaboratore_id)
  on conflict (ticket_id, utente_id) do update set letto_il = clock_timestamp();
$$;

notify pgrst, 'reload schema';
