-- =============================================================================
-- Account clienti, siti acquistati, cassaforte degli accessi, recensioni e ticket.
-- Esegui DOPO tutti gli altri script (anche rimuovi_soci.sql):
-- SQL Editor → New query → incolla → Run. Si può rieseguire.
-- Se rilanci schema.sql, rilancia anche questo.
--
--   cliente  vede SOLO i propri siti, i propri accessi (cifrati), la propria recensione
--            e i propri ticket.
--            Non vede listino interno, opportunità, progetti, vendite né altri clienti.
--
-- SICUREZZA: chi si registra da solo ora nasce DISATTIVATO. Si diventa attivi solo
-- se l'account lo crea l'admin dal sito.
-- =============================================================================

-- Nuovo ruolo. (Se l'editor segnala che il valore non è ancora utilizzabile,
-- esegui prima solo questa riga e poi il resto dello script.)
alter type public.ruolo_utente add value if not exists 'cliente';

-- -----------------------------------------------------------------------------
-- Chi è chi
-- -----------------------------------------------------------------------------
-- «Attivo» = persona che lavora con l'agenzia: i clienti sono esclusi, così tutte
-- le regole esistenti (listino, opportunità, vendite, contratti) restano chiuse per loro.
create or replace function public.is_attivo()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and attivo and ruolo::text <> 'cliente'
  );
$$;

create or replace function public.is_cliente()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and attivo and ruolo::text = 'cliente'
  );
$$;

revoke all on function public.is_cliente() from public;
grant execute on function public.is_cliente() to anon, authenticated;

-- Un profilo nuovo nasce disattivato: lo attiva admin_crea_account / admin_crea_cliente
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, attivo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.admin_crea_cliente(p_nome text, p_email text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un amministratore può creare account' using errcode = '42501';
  end if;
  if trim(coalesce(p_nome, '')) = '' then
    raise exception 'Il nome è obbligatorio' using errcode = '22023';
  end if;

  v_id := public._crea_utente_auth(p_email, p_password, p_nome);

  update public.profiles
     set nome = trim(p_nome), ruolo = 'cliente', percentuale_default = 0, attivo = true
   where id = v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_crea_cliente(text, text, text) from public, anon;
grant execute on function public.admin_crea_cliente(text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Siti acquistati da ogni cliente
-- -----------------------------------------------------------------------------
create table if not exists public.siti_cliente (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.profiles (id) on delete cascade,
  nome          text not null check (char_length(trim(nome)) between 1 and 200),
  url           text not null default '' check (char_length(url) <= 500 and (url = '' or url ~* '^https?://')),
  data_acquisto date not null default current_date,
  note          text not null default '' check (char_length(note) <= 5000),
  -- Chi segue il sito: riceve la notifica dei ticket del cliente
  collaboratore_id uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists siti_cliente_idx on public.siti_cliente (cliente_id);

-- -----------------------------------------------------------------------------
-- Cassaforte: email e password dei servizi (Google, Vercel, Supabase, Resend…).
-- Il database conserva SOLO testo cifrato (AES-GCM), cifrato nel browser:
--   • la password principale dell'admin non viene mai inviata né salvata;
--   • ogni cliente ha un codice, salvato cifrato con la password principale;
--   • i dati di un cliente si aprono solo con il suo codice.
-- Se si perde la password principale, l'admin non può più aprire la cassaforte.
-- -----------------------------------------------------------------------------
create table if not exists public.cassaforte (
  id         integer primary key default 1 check (id = 1),
  sale       text not null,
  iterazioni integer not null check (iterazioni >= 100000),
  verifica   text not null check (verifica ~ '^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$'),
  creata_il  timestamptz not null default now()
);

create table if not exists public.cassaforte_clienti (
  cliente_id     uuid primary key references public.profiles (id) on delete cascade,
  sale           text not null,
  iterazioni     integer not null check (iterazioni >= 100000),
  verifica       text not null check (verifica ~ '^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$'),
  codice_cifrato text not null check (codice_cifrato ~ '^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$'),
  creata_il      timestamptz not null default now()
);

create table if not exists public.accessi_cliente (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.cassaforte_clienti (cliente_id) on delete cascade,
  -- Il vincolo rifiuta qualsiasi dato in chiaro
  dati       text not null check (char_length(dati) <= 40000 and dati ~ '^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists accessi_cliente_idx on public.accessi_cliente (cliente_id);

-- -----------------------------------------------------------------------------
-- Recensioni: solo i clienti con almeno un sito registrato, una a testa.
-- Vanno online subito; l'admin può nasconderle o eliminarle, non scriverle né modificarle.
-- -----------------------------------------------------------------------------
create table if not exists public.recensioni (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null unique references public.profiles (id) on delete cascade,
  stelle     smallint not null check (stelle between 1 and 5),
  testo      text not null check (char_length(testo) between 10 and 800),
  firma      text not null check (char_length(firma) between 2 and 80),
  attivita   text not null default '',
  visibile   boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.lascia_recensione(p_stelle integer, p_testo text, p_firma text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_testo    text := trim(coalesce(p_testo, ''));
  v_firma    text := regexp_replace(trim(coalesce(p_firma, '')), '\s+', ' ', 'g');
  v_attivita text;
  v_id       uuid;
begin
  if not public.is_cliente() then
    raise exception 'Solo i clienti possono lasciare una recensione.' using errcode = '42501';
  end if;
  select nome into v_attivita from public.siti_cliente
   where cliente_id = auth.uid() order by data_acquisto, created_at limit 1;
  if v_attivita is null then
    raise exception 'Potrai lasciare la recensione quando il tuo sito sarà registrato nel tuo account.' using errcode = '42501';
  end if;
  if p_stelle is null or p_stelle < 1 or p_stelle > 5 then
    raise exception 'Scegli da 1 a 5 stelle.' using errcode = '22023';
  end if;
  if char_length(v_testo) < 10 or char_length(v_testo) > 800 then
    raise exception 'La recensione deve avere tra 10 e 800 caratteri.' using errcode = '22023';
  end if;
  if char_length(v_firma) < 2 or char_length(v_firma) > 80 then
    raise exception 'Scrivi il nome con cui firmare (da 2 a 80 caratteri).' using errcode = '22023';
  end if;

  -- Modificando la recensione, quella nascosta dall'admin resta nascosta
  insert into public.recensioni (cliente_id, stelle, testo, firma, attivita)
  values (auth.uid(), p_stelle, v_testo, v_firma, v_attivita)
  on conflict (cliente_id) do update
    set stelle = excluded.stelle, testo = excluded.testo, firma = excluded.firma,
        attivita = excluded.attivita, updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.lascia_recensione(integer, text, text) from public, anon;
grant execute on function public.lascia_recensione(integer, text, text) to authenticated;

-- Ciò che vedono i visitatori: solo recensioni visibili, senza riferimenti all'account
drop view if exists public.recensioni_pubbliche;
create view public.recensioni_pubbliche as
select id, stelle, testo, firma, attivita, created_at
from public.recensioni
where visibile;

-- -----------------------------------------------------------------------------
-- Permessi
-- -----------------------------------------------------------------------------
alter table public.siti_cliente       enable row level security;
alter table public.cassaforte         enable row level security;
alter table public.cassaforte_clienti enable row level security;
alter table public.accessi_cliente    enable row level security;
alter table public.recensioni         enable row level security;

drop policy if exists "siti_cliente: admin tutto"          on public.siti_cliente;
drop policy if exists "siti_cliente: il cliente i suoi"    on public.siti_cliente;
drop policy if exists "cassaforte: solo admin"             on public.cassaforte;
drop policy if exists "cassaforte_clienti: admin tutto"    on public.cassaforte_clienti;
drop policy if exists "cassaforte_clienti: il cliente la sua" on public.cassaforte_clienti;
drop policy if exists "accessi_cliente: admin tutto"       on public.accessi_cliente;
drop policy if exists "accessi_cliente: il cliente i suoi" on public.accessi_cliente;
drop policy if exists "recensioni: admin legge"            on public.recensioni;
drop policy if exists "recensioni: admin nasconde"         on public.recensioni;
drop policy if exists "recensioni: admin elimina"          on public.recensioni;
drop policy if exists "recensioni: il cliente la sua"      on public.recensioni;

create policy "siti_cliente: admin tutto"
  on public.siti_cliente for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "siti_cliente: il cliente i suoi"
  on public.siti_cliente for select to authenticated
  using (cliente_id = auth.uid() and public.is_cliente());

create policy "cassaforte: solo admin"
  on public.cassaforte for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "cassaforte_clienti: admin tutto"
  on public.cassaforte_clienti for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "cassaforte_clienti: il cliente la sua"
  on public.cassaforte_clienti for select to authenticated
  using (cliente_id = auth.uid() and public.is_cliente());

create policy "accessi_cliente: admin tutto"
  on public.accessi_cliente for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "accessi_cliente: il cliente i suoi"
  on public.accessi_cliente for select to authenticated
  using (cliente_id = auth.uid() and public.is_cliente());

create policy "recensioni: admin legge"
  on public.recensioni for select to authenticated
  using (public.is_admin());
create policy "recensioni: admin nasconde"
  on public.recensioni for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "recensioni: admin elimina"
  on public.recensioni for delete to authenticated
  using (public.is_admin());
create policy "recensioni: il cliente la sua"
  on public.recensioni for select to authenticated
  using (cliente_id = auth.uid() and public.is_cliente());

revoke all on public.siti_cliente, public.cassaforte, public.cassaforte_clienti,
              public.accessi_cliente, public.recensioni, public.recensioni_pubbliche
  from anon, authenticated;

grant select, insert, update, delete on public.siti_cliente, public.cassaforte_clienti,
              public.accessi_cliente to authenticated;
grant select, insert        on public.cassaforte           to authenticated;
grant select, delete        on public.recensioni           to authenticated;
grant update (visibile)     on public.recensioni           to authenticated;
grant select                on public.recensioni_pubbliche to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Ticket: chi scrive dal sito apre un ticket e si parla in chat sul sito.
--   admin          vede tutti i ticket
--   collaboratore  vede quelli dei siti che segue
--   cliente        vede i propri
--   visitatore     apre il suo solo con il link segreto (token)
-- Tutte le scritture passano dalle funzioni qui sotto.
-- -----------------------------------------------------------------------------
create table if not exists public.tickets (
  id                     uuid primary key default gen_random_uuid(),
  numero                 bigint generated always as identity,
  token                  uuid not null unique default gen_random_uuid(),
  cliente_id             uuid references public.profiles (id) on delete set null,
  sito_nome              text not null default '',
  collaboratore_id       uuid references public.profiles (id) on delete set null,
  nome                   text not null,
  email                  text not null,
  telefono               text not null default '',
  oggetto                text not null,
  stato                  text not null default 'aperto' check (stato in ('aperto', 'chiuso')),
  ultimo_autore          text not null default 'richiedente' check (ultimo_autore in ('richiedente', 'staff')),
  ultimo_messaggio_il    timestamptz not null default clock_timestamp(),
  letto_admin_il         timestamptz,
  letto_collaboratore_il timestamptz,
  letto_richiedente_il   timestamptz default clock_timestamp(),
  created_at             timestamptz not null default now()
);
create index if not exists tickets_ultimo_idx on public.tickets (ultimo_messaggio_il desc);
create index if not exists tickets_collaboratore_idx on public.tickets (collaboratore_id);
create index if not exists tickets_cliente_idx on public.tickets (cliente_id);
create index if not exists tickets_email_idx on public.tickets (email, created_at);

create table if not exists public.ticket_messaggi (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  autore      text not null check (autore in ('richiedente', 'staff')),
  autore_nome text not null,
  testo       text not null check (char_length(testo) between 1 and 4000),
  created_at  timestamptz not null default clock_timestamp()
);
create index if not exists ticket_messaggi_idx on public.ticket_messaggi (ticket_id, created_at);

-- Chi lavora il ticket: l'admin, oppure il collaboratore a cui è assegnato
create or replace function public.lavora_ticket(p_collaboratore uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin() or (public.is_attivo() and p_collaboratore = auth.uid());
$$;

-- Apre un ticket (visitatori e clienti). Restituisce numero e link segreto.
create or replace function public.apri_ticket(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente   public.profiles;
  v_sito      public.siti_cliente;
  v_nome      text := regexp_replace(trim(coalesce(p ->> 'nome', '')), '\s+', ' ', 'g');
  v_email     text := lower(trim(coalesce(p ->> 'email', '')));
  v_telefono  text := trim(coalesce(p ->> 'telefono', ''));
  v_oggetto   text := regexp_replace(trim(coalesce(p ->> 'oggetto', '')), '\s+', ' ', 'g');
  v_testo     text := trim(coalesce(p ->> 'messaggio', ''));
  v_ticket    public.tickets;
begin
  -- Campo nascosto nella pagina: lo compilano solo i programmi automatici
  if coalesce(trim(p ->> 'controllo'), '') <> '' then
    return jsonb_build_object('numero', 0, 'token', gen_random_uuid());
  end if;

  if public.is_cliente() then
    select * into v_cliente from public.profiles where id = auth.uid();
    v_nome := v_cliente.nome;
    v_email := lower(v_cliente.email);
    if coalesce(p ->> 'sito_id', '') <> '' then
      select * into v_sito from public.siti_cliente
       where id = (p ->> 'sito_id')::uuid and cliente_id = auth.uid();
      if v_sito.id is null then
        raise exception 'Sito non trovato nel tuo account.' using errcode = '42501';
      end if;
    else
      select * into v_sito from public.siti_cliente
       where cliente_id = auth.uid() order by data_acquisto, created_at limit 1;
    end if;
  end if;

  if char_length(v_nome) < 2 or char_length(v_nome) > 100 then
    raise exception 'Inserisci il tuo nome.' using errcode = '22023';
  end if;
  if char_length(v_email) > 200 or v_email !~ '^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$' then
    raise exception 'Inserisci un indirizzo email valido.' using errcode = '22023';
  end if;
  if char_length(v_telefono) > 50 then
    raise exception 'Il numero di telefono è troppo lungo.' using errcode = '22023';
  end if;
  if char_length(v_testo) < 10 or char_length(v_testo) > 4000 then
    raise exception 'Il messaggio deve avere tra 10 e 4000 caratteri.' using errcode = '22023';
  end if;
  if v_oggetto = '' then
    v_oggetto := regexp_replace(left(v_testo, 70), '\s+', ' ', 'g');
  end if;
  v_oggetto := left(v_oggetto, 120);

  -- Limiti contro gli abusi
  if (select count(*) from public.tickets where email = v_email and created_at > now() - interval '1 hour') >= 3
     or (v_cliente.id is null and (select count(*) from public.tickets where cliente_id is null and created_at > now() - interval '1 day') >= 40) then
    raise exception 'Troppe richieste in poco tempo: riprova più tardi.' using errcode = '54000';
  end if;

  insert into public.tickets (cliente_id, sito_nome, collaboratore_id, nome, email, telefono, oggetto)
  values (v_cliente.id, coalesce(v_sito.nome, ''), v_sito.collaboratore_id, v_nome, v_email, v_telefono, v_oggetto)
  returning * into v_ticket;

  insert into public.ticket_messaggi (ticket_id, autore, autore_nome, testo)
  values (v_ticket.id, 'richiedente', v_nome, v_testo);

  return jsonb_build_object('id', v_ticket.id, 'numero', v_ticket.numero, 'token', v_ticket.token);
end;
$$;

-- Aggiunge un messaggio (uso interno)
create or replace function public._ticket_scrivi(p_ticket uuid, p_autore text, p_nome text, p_testo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_testo text := trim(coalesce(p_testo, ''));
  v_ora   timestamptz := clock_timestamp();
begin
  if char_length(v_testo) < 1 or char_length(v_testo) > 4000 then
    raise exception 'Il messaggio deve avere tra 1 e 4000 caratteri.' using errcode = '22023';
  end if;
  if p_autore = 'richiedente' and (select count(*) from public.ticket_messaggi
       where ticket_id = p_ticket and autore = 'richiedente' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Troppi messaggi in poco tempo: riprova più tardi.' using errcode = '54000';
  end if;
  insert into public.ticket_messaggi (ticket_id, autore, autore_nome, testo, created_at)
  values (p_ticket, p_autore, p_nome, v_testo, v_ora);
  -- Un nuovo messaggio del richiedente riapre il ticket
  update public.tickets
     set ultimo_autore = p_autore,
         ultimo_messaggio_il = v_ora,
         stato = case when p_autore = 'richiedente' then 'aperto' else stato end,
         letto_richiedente_il   = case when p_autore = 'richiedente' then v_ora else letto_richiedente_il end,
         letto_admin_il         = case when public.is_admin() then v_ora else letto_admin_il end,
         letto_collaboratore_il = case when collaboratore_id = auth.uid() then v_ora else letto_collaboratore_il end
   where id = p_ticket;
end;
$$;

-- Risposta di chi è collegato: staff (admin / collaboratore assegnato) o cliente proprietario
create or replace function public.rispondi_ticket(p_ticket uuid, p_testo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t      public.tickets;
  v_nome text;
begin
  select * into t from public.tickets where id = p_ticket;
  select nome into v_nome from public.profiles where id = auth.uid();
  if t.id is not null and public.lavora_ticket(t.collaboratore_id) then
    perform public._ticket_scrivi(t.id, 'staff', v_nome, p_testo);
  elsif t.id is not null and public.is_cliente() and t.cliente_id = auth.uid() then
    perform public._ticket_scrivi(t.id, 'richiedente', v_nome, p_testo);
  else
    raise exception 'Ticket non trovato.' using errcode = '42501';
  end if;
end;
$$;

-- Visitatore con il link segreto: legge la conversazione (senza i nomi dello staff)
create or replace function public.leggi_ticket(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tickets;
begin
  update public.tickets set letto_richiedente_il = clock_timestamp()
   where token = p_token returning * into t;
  if t.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'numero', t.numero, 'oggetto', t.oggetto, 'stato', t.stato, 'nome', t.nome, 'created_at', t.created_at,
    'messaggi', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'autore', m.autore,
        'autore_nome', case when m.autore = 'staff' then 'Forma Web' else m.autore_nome end,
        'testo', m.testo, 'created_at', m.created_at) order by m.created_at), '[]'::jsonb)
      from public.ticket_messaggi m where m.ticket_id = t.id));
end;
$$;

create or replace function public.scrivi_ticket(p_token uuid, p_testo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tickets;
begin
  select * into t from public.tickets where token = p_token;
  if t.id is null then
    raise exception 'Ticket non trovato.' using errcode = '42501';
  end if;
  perform public._ticket_scrivi(t.id, 'richiedente', t.nome, p_testo);
end;
$$;

-- Segna il ticket come letto da chi lo sta guardando
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
$$;

create or replace function public.imposta_stato_ticket(p_ticket uuid, p_stato text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tickets set stato = p_stato where id = p_ticket and public.lavora_ticket(collaboratore_id);
  if not found then
    raise exception 'Non hai i permessi per questo ticket.' using errcode = '42501';
  end if;
end;
$$;

-- L'admin passa il ticket a un collaboratore: per lui torna «da leggere»
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
  update public.tickets set collaboratore_id = p_collaboratore, letto_collaboratore_il = null where id = p_ticket;
end;
$$;

revoke all on function public.lavora_ticket(uuid)                          from public, anon;
revoke all on function public._ticket_scrivi(uuid, text, text, text)       from public, anon, authenticated;
revoke all on function public.apri_ticket(jsonb)                           from public;
revoke all on function public.leggi_ticket(uuid)                           from public;
revoke all on function public.scrivi_ticket(uuid, text)                    from public;
revoke all on function public.rispondi_ticket(uuid, text)                  from public, anon;
revoke all on function public.segna_letto_ticket(uuid)                     from public, anon;
revoke all on function public.imposta_stato_ticket(uuid, text)             from public, anon;
revoke all on function public.assegna_ticket(uuid, uuid)                   from public, anon;
grant execute on function public.lavora_ticket(uuid)                       to authenticated;
grant execute on function public.apri_ticket(jsonb)                        to anon, authenticated;
grant execute on function public.leggi_ticket(uuid)                        to anon, authenticated;
grant execute on function public.scrivi_ticket(uuid, text)                 to anon, authenticated;
grant execute on function public.rispondi_ticket(uuid, text)               to authenticated;
grant execute on function public.segna_letto_ticket(uuid)                  to authenticated;
grant execute on function public.imposta_stato_ticket(uuid, text)          to authenticated;
grant execute on function public.assegna_ticket(uuid, uuid)                to authenticated;

alter table public.tickets         enable row level security;
alter table public.ticket_messaggi enable row level security;

drop policy if exists "tickets: chi li lavora e il proprietario" on public.tickets;
drop policy if exists "tickets: admin elimina"                   on public.tickets;
drop policy if exists "ticket_messaggi: di chi vede il ticket"   on public.ticket_messaggi;

create policy "tickets: chi li lavora e il proprietario"
  on public.tickets for select to authenticated
  using (public.lavora_ticket(collaboratore_id) or (public.is_cliente() and cliente_id = auth.uid()));
create policy "tickets: admin elimina"
  on public.tickets for delete to authenticated
  using (public.is_admin());
-- La sotto-query passa dalle regole di tickets: si leggono solo i messaggi dei ticket visibili
create policy "ticket_messaggi: di chi vede il ticket"
  on public.ticket_messaggi for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id));

revoke all on public.tickets, public.ticket_messaggi from anon, authenticated;
grant select, delete on public.tickets         to authenticated;
grant select         on public.ticket_messaggi to authenticated;

-- Fa vedere subito le novità all'API del sito
notify pgrst, 'reload schema';

-- Controllo: se qui compare un account che non riconosci, disattivalo da
-- Area riservata → Collaboratori.
select nome, email, ruolo, attivo, created_at from public.profiles order by created_at desc;
