-- =============================================================================
-- Acquisto siti da parte dei clienti: richiesta personalizzata → preventivo →
-- accettazione del contratto + pagamento (Stripe) → contratto compilato al cliente.
-- Esegui UNA VOLTA dopo schema.sql: SQL Editor → New query → incolla → Run.
-- Si può rieseguire senza problemi (il modello di contratto già salvato NON viene toccato).
--
-- Il cliente NON ha un account: segue il proprio ordine da un link privato
-- (/ordine/<token>). Le tabelle sono chiuse al pubblico: il cliente passa solo
-- dalle funzioni qui sotto (security definer), l'admin dalle policy RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ordini
-- -----------------------------------------------------------------------------
create table if not exists public.ordini_siti (
  id                 uuid primary key default gen_random_uuid(),
  numero             bigint generated always as identity,
  token              uuid not null unique default gen_random_uuid(),
  stato              text not null default 'richiesto'
                       check (stato in ('richiesto', 'preventivo_inviato', 'pagato', 'annullato')),

  -- Cliente
  cliente_nome       text not null check (char_length(trim(cliente_nome)) between 1 and 200),
  cliente_email      text not null check (char_length(cliente_email) between 3 and 320),
  cliente_telefono   text not null default '' check (char_length(cliente_telefono) <= 50),
  cliente_codice     text not null default '' check (char_length(cliente_codice) <= 50),    -- P.IVA o codice fiscale
  cliente_indirizzo  text not null default '' check (char_length(cliente_indirizzo) <= 300),

  -- Sito richiesto
  tipo_sito          text not null default '' check (char_length(tipo_sito) <= 100),
  nome_attivita      text not null default '' check (char_length(nome_attivita) <= 200),
  pagine             text not null default '' check (char_length(pagine) <= 50),
  funzionalita       text[] not null default '{}' check (cardinality(funzionalita) <= 30),
  lingue             text not null default '' check (char_length(lingue) <= 200),
  dominio            text not null default '' check (char_length(dominio) <= 300),
  stile              text not null default '' check (char_length(stile) <= 2000),
  descrizione        text not null default '' check (char_length(descrizione) <= 5000),
  scadenza           text not null default '' check (char_length(scadenza) <= 200),
  budget             text not null default '' check (char_length(budget) <= 200),

  -- Preventivo (compilato dall'admin)
  prezzo             numeric(12,2) check (prezzo is null or prezzo >= 0),
  acconto            numeric(12,2) check (acconto is null or acconto >= 0),   -- importo da pagare adesso (null = tutto)
  consegna_giorni    integer check (consegna_giorni is null or consegna_giorni between 1 and 1000),
  nota_preventivo    text not null default '' check (char_length(nota_preventivo) <= 5000),
  nota_interna       text not null default '' check (char_length(nota_interna) <= 5000),
  preventivo_il      timestamptz,

  -- Accettazione del contratto e pagamento
  firmatario         text not null default '',
  accettato_il       timestamptz,
  accettato_ip       text not null default '',
  stripe_session_id  text,
  importo_pagato     numeric(12,2),
  pagato_il          timestamptz,
  contratto_finale   text,                       -- testo del contratto compilato, congelato al pagamento
  email_inviata      boolean not null default false,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  check (acconto is null or prezzo is null or acconto <= prezzo)
);

alter table public.ordini_siti add column if not exists email_inviata boolean not null default false;

create index if not exists ordini_siti_stato_idx on public.ordini_siti (stato, created_at desc);
create index if not exists ordini_siti_email_idx on public.ordini_siti (lower(cliente_email), created_at desc);

create or replace function public.ordini_siti_tocca()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  -- Dopo il pagamento il preventivo e il contratto non si toccano più
  if old.stato = 'pagato' and (
       new.prezzo is distinct from old.prezzo
    or new.acconto is distinct from old.acconto
    or (old.contratto_finale is not null and new.contratto_finale is distinct from old.contratto_finale)
    or new.cliente_nome is distinct from old.cliente_nome
  ) then
    raise exception 'Ordine già pagato: preventivo e contratto non sono modificabili.';
  end if;
  return new;
end $$;

drop trigger if exists ordini_siti_tocca on public.ordini_siti;
create trigger ordini_siti_tocca before update on public.ordini_siti
  for each row execute function public.ordini_siti_tocca();

alter table public.ordini_siti enable row level security;

drop policy if exists "ordini_siti: admin tutto" on public.ordini_siti;
create policy "ordini_siti: admin tutto"
  on public.ordini_siti for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.ordini_siti from anon, authenticated;
grant select, update, delete on public.ordini_siti to authenticated;   -- l'inserimento passa da crea_richiesta_sito()

-- -----------------------------------------------------------------------------
-- Modello di contratto (una sola riga). Modificabile dall'admin dal sito.
-- Segnaposto: {{cliente_nome}} {{cliente_codice}} {{cliente_indirizzo}} {{cliente_email}}
--   {{cliente_telefono}} {{numero_ordine}} {{data}} {{tipo_sito}} {{nome_attivita}} {{pagine}}
--   {{funzionalita}} {{lingue}} {{dominio}} {{descrizione}} {{prezzo}} {{acconto}} {{saldo}}
--   {{consegna_giorni}} {{firmatario}}
-- Formato: "# Titolo" = titolo, riga vuota = nuovo paragrafo.
-- -----------------------------------------------------------------------------
create table if not exists public.ordini_contratto (
  id          integer primary key default 1 check (id = 1),
  testo       text not null,
  updated_at  timestamptz not null default now()
);

alter table public.ordini_contratto enable row level security;

drop policy if exists "ordini_contratto: lettura"    on public.ordini_contratto;
drop policy if exists "ordini_contratto: admin tutto" on public.ordini_contratto;
create policy "ordini_contratto: lettura"
  on public.ordini_contratto for select to anon, authenticated using (true);
create policy "ordini_contratto: admin tutto"
  on public.ordini_contratto for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.ordini_contratto from anon, authenticated;
grant select on public.ordini_contratto to anon, authenticated;
grant insert, update on public.ordini_contratto to authenticated;

-- Testo di partenza: SOSTITUISCILO con il tuo contratto (Area riservata → Preventivi → Modello contratto)
insert into public.ordini_contratto (id, testo) values (1, $contratto$
# CONTRATTO PER LA REALIZZAZIONE DI UN SITO WEB
Ordine n. {{numero_ordine}} del {{data}}

# 1. Le parti
Tra Forma Web (di seguito "il Fornitore") e {{cliente_nome}}, codice fiscale / P.IVA {{cliente_codice}}, residente / con sede in {{cliente_indirizzo}}, email {{cliente_email}}, telefono {{cliente_telefono}} (di seguito "il Cliente").

# 2. Oggetto
Il Fornitore realizza per il Cliente il seguente sito web.
Tipologia: {{tipo_sito}}
Nome del progetto / attività: {{nome_attivita}}
Numero di pagine: {{pagine}}
Funzionalità richieste: {{funzionalita}}
Lingue: {{lingue}}
Dominio: {{dominio}}
Descrizione e indicazioni del Cliente: {{descrizione}}

# 3. Corrispettivo e pagamento
Il prezzo complessivo concordato è di {{prezzo}}. Con il presente ordine il Cliente versa {{acconto}}; l'eventuale saldo di {{saldo}} è dovuto alla consegna del sito. Il pagamento online è gestito da un fornitore di servizi di pagamento terzo.

# 4. Tempi di consegna
Il Fornitore si impegna a consegnare il sito entro {{consegna_giorni}} giorni dal pagamento e dalla ricezione di tutti i materiali (testi, immagini, logo) necessari. I ritardi dovuti alla mancata o tardiva collaborazione del Cliente prorogano i termini.

# 5. Obblighi del Cliente
Il Cliente fornisce contenuti e materiali di cui detiene i diritti e risponde della loro liceità. Il Cliente verifica il sito e segnala eventuali difetti entro 15 giorni dalla consegna.

# 6. Modifiche
Sono incluse due revisioni migliorative del lavoro consegnato. Modifiche successive o richieste non indicate al punto 2 sono preventivate a parte.

# 7. Proprietà e diritti
Al saldo completo del corrispettivo il Cliente acquisisce il diritto di utilizzare il sito. Il Fornitore può citare il lavoro nel proprio portfolio, salvo diversa richiesta scritta del Cliente.

# 8. Recesso e rimborsi
Il lavoro è personalizzato su indicazioni del Cliente. Dopo l'avvio delle attività l'acconto versato non è rimborsabile, salvo mancata consegna per causa imputabile al Fornitore.

# 9. Trattamento dei dati
I dati del Cliente sono trattati solo per l'esecuzione del contratto e per gli obblighi di legge, ai sensi del Regolamento (UE) 2016/679.

# 10. Legge applicabile
Il contratto è regolato dalla legge italiana. Per ogni controversia è competente il foro del luogo di residenza o sede del Fornitore, salvo diversa norma inderogabile a tutela del consumatore.

# Accettazione
Il Cliente dichiara di aver letto e di accettare integralmente il presente contratto, cliccando "Accetta e paga" e digitando il proprio nome.
Firmato da: {{firmatario}}
$contratto$)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Compila il contratto con i dati di un ordine (uso interno: sempre lato server)
-- -----------------------------------------------------------------------------
create or replace function public._importo_it(n numeric)
returns text language sql immutable as $$
  select case when n is null then '—' else
    replace(replace(replace(to_char(n, 'FM999,999,999,990.00'), ',', '#'), '.', ','), '#', '.') || ' €'
  end;
$$;

create or replace function public._contratto_compilato(p_id uuid)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  o public.ordini_siti;
  t text;
  v jsonb;
  k text;
  x text;
  da_pagare numeric;
begin
  select * into o from public.ordini_siti where id = p_id;
  if not found then return null; end if;
  select testo into t from public.ordini_contratto where id = 1;
  t := coalesce(t, '');
  da_pagare := coalesce(o.acconto, o.prezzo);

  v := jsonb_build_object(
    'numero_ordine',     'W-' || lpad(o.numero::text, 5, '0'),
    'data',              to_char(coalesce(o.pagato_il, now()) at time zone 'Europe/Rome', 'DD/MM/YYYY'),
    'cliente_nome',      o.cliente_nome,
    'cliente_codice',    o.cliente_codice,
    'cliente_indirizzo', o.cliente_indirizzo,
    'cliente_email',     o.cliente_email,
    'cliente_telefono',  o.cliente_telefono,
    'tipo_sito',         o.tipo_sito,
    'nome_attivita',     o.nome_attivita,
    'pagine',            o.pagine,
    'funzionalita',      array_to_string(o.funzionalita, ', '),
    'lingue',            o.lingue,
    'dominio',           o.dominio,
    'descrizione',       o.descrizione,
    'prezzo',            public._importo_it(o.prezzo),
    'acconto',           public._importo_it(da_pagare),
    'saldo',             public._importo_it(case when o.prezzo is null then null else o.prezzo - da_pagare end),
    'consegna_giorni',   coalesce(o.consegna_giorni::text, ''),
    'firmatario',        coalesce(nullif(o.firmatario, ''), '________________')
  );

  for k, x in select key, value from jsonb_each_text(v) loop
    t := replace(t, '{{' || k || '}}', coalesce(nullif(trim(x), ''), '—'));
  end loop;
  return trim(both E'\n ' from t);
end $$;

revoke all on function public._contratto_compilato(uuid) from public, anon, authenticated;
grant execute on function public._contratto_compilato(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Funzioni pubbliche (usate dal sito senza login)
-- -----------------------------------------------------------------------------

-- Il cliente invia la richiesta di preventivo; restituisce il token del suo ordine.
create or replace function public.crea_richiesta_sito(p jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_token uuid;
  v_email text := lower(trim(coalesce(p ->> 'cliente_email', '')));
  v_funz text[];
begin
  if char_length(trim(coalesce(p ->> 'cliente_nome', ''))) < 2 then
    raise exception 'Inserisci il tuo nome.';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Inserisci un indirizzo email valido.';
  end if;
  if char_length(trim(coalesce(p ->> 'cliente_indirizzo', ''))) < 5 then
    raise exception 'Inserisci l''indirizzo: serve per il contratto.';
  end if;
  if char_length(trim(coalesce(p ->> 'cliente_codice', ''))) < 5 then
    raise exception 'Inserisci codice fiscale o partita IVA: servono per il contratto.';
  end if;
  if char_length(trim(coalesce(p ->> 'descrizione', ''))) < 10 then
    raise exception 'Descrivi brevemente il sito che vuoi.';
  end if;

  -- Antispam semplice: massimo 5 richieste all'ora per email
  if (select count(*) from public.ordini_siti
       where lower(cliente_email) = v_email and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Troppe richieste ravvicinate: riprova tra un po''.';
  end if;

  select coalesce(array_agg(left(f, 100)), '{}') into v_funz
    from jsonb_array_elements_text(coalesce(p -> 'funzionalita', '[]'::jsonb)) f;

  insert into public.ordini_siti (
    cliente_nome, cliente_email, cliente_telefono, cliente_codice, cliente_indirizzo,
    tipo_sito, nome_attivita, pagine, funzionalita, lingue, dominio, stile, descrizione, scadenza, budget
  ) values (
    trim(p ->> 'cliente_nome'), v_email,
    coalesce(p ->> 'cliente_telefono', ''), trim(p ->> 'cliente_codice'), trim(p ->> 'cliente_indirizzo'),
    coalesce(p ->> 'tipo_sito', ''), coalesce(p ->> 'nome_attivita', ''), coalesce(p ->> 'pagine', ''),
    v_funz, coalesce(p ->> 'lingue', ''), coalesce(p ->> 'dominio', ''), coalesce(p ->> 'stile', ''),
    trim(p ->> 'descrizione'), coalesce(p ->> 'scadenza', ''), coalesce(p ->> 'budget', '')
  ) returning token into v_token;

  return v_token;
end $$;

revoke all on function public.crea_richiesta_sito(jsonb) from public;
grant execute on function public.crea_richiesta_sito(jsonb) to anon, authenticated;

-- Il cliente legge il proprio ordine dal token (nessun dato interno)
create or replace function public.leggi_ordine(p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  o public.ordini_siti;
begin
  select * into o from public.ordini_siti where token = p_token;
  if not found then return null; end if;

  return jsonb_build_object(
    'numero_ordine',     'W-' || lpad(o.numero::text, 5, '0'),
    'stato',             o.stato,
    'cliente_nome',      o.cliente_nome,
    'cliente_email',     o.cliente_email,
    'tipo_sito',         o.tipo_sito,
    'nome_attivita',     o.nome_attivita,
    'pagine',            o.pagine,
    'funzionalita',      to_jsonb(o.funzionalita),
    'dominio',           o.dominio,
    'descrizione',       o.descrizione,
    'prezzo',            o.prezzo,
    'acconto',           coalesce(o.acconto, o.prezzo),
    'consegna_giorni',   o.consegna_giorni,
    'nota_preventivo',   o.nota_preventivo,
    'pagato_il',         o.pagato_il,
    'importo_pagato',    o.importo_pagato,
    'created_at',        o.created_at,
    'contratto',         case
                           when o.stato = 'pagato' then o.contratto_finale
                           when o.stato = 'preventivo_inviato' then public._contratto_compilato(o.id)
                           else null
                         end
  );
end $$;

revoke all on function public.leggi_ordine(uuid) from public;
grant execute on function public.leggi_ordine(uuid) to anon, authenticated;

-- Contratto compilato per l'anteprima admin (stesso testo che vede il cliente)
create or replace function public.admin_anteprima_contratto(p_id uuid)
returns text
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Non autorizzato.'; end if;
  return public._contratto_compilato(p_id);
end $$;

revoke all on function public.admin_anteprima_contratto(uuid) from public, anon;
grant execute on function public.admin_anteprima_contratto(uuid) to authenticated;

-- Usata SOLO dalle Edge Functions (service role)
create or replace function public._ordine_segna_pagato(p_session text, p_importo numeric)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  o public.ordini_siti;
begin
  select * into o from public.ordini_siti where stripe_session_id = p_session for update;
  if not found then return null; end if;
  if o.stato = 'pagato' then return o.id; end if;     -- webhook ripetuto: nulla da fare

  update public.ordini_siti
     set stato = 'pagato', pagato_il = now(), importo_pagato = p_importo
   where id = o.id;
  update public.ordini_siti
     set contratto_finale = public._contratto_compilato(o.id)
   where id = o.id;
  return o.id;
end $$;

revoke all on function public._ordine_segna_pagato(text, numeric) from public, anon, authenticated;
grant execute on function public._ordine_segna_pagato(text, numeric) to service_role;

grant usage on schema public to service_role;
grant select, update on public.ordini_siti to service_role;

notify pgrst, 'reload schema';
