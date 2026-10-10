-- =============================================================================
-- Configuratore «Acquista il tuo sito» (PRD FormaWeb)
-- Esegui UNA VOLTA dopo schema.sql, soci.sql e ordini.sql:
--   SQL Editor → New query → incolla → Run.
-- Si può rieseguire senza problemi: listino e impostazioni già modificati da te
-- NON vengono sovrascritti (i dati iniziali entrano con "on conflict do nothing").
--
-- Cosa aggiunge
--   configuratore_voci          listino: tipologie di sito, funzionalità extra, servizi esterni
--   configuratore_impostazioni  % urgenza e testi di avviso
--   calcola_preventivo(jsonb)   calcolo del preventivo, SEMPRE lato server
--   ordini_siti (nuove colonne) configurazione scelta, totale indicativo, allegati…
--   crea_richiesta_sito()       ricalcola il prezzo dal listino: il browser non decide i prezzi
--   leggi_ordine()              restituisce anche riepilogo e stato di approvazione
--   bucket privato «richieste-allegati»  file caricati dal cliente (solo l'admin li legge)
--
-- Il prezzo di un ordine (ordini_siti.prezzo) resta deciso SOLO dall'admin: il
-- pagamento (Edge Function crea-checkout) usa quello, mai il totale indicativo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Listino
-- -----------------------------------------------------------------------------
create table if not exists public.configuratore_voci (
  codice          text primary key check (codice ~ '^[a-z0-9_]{2,60}$'),
  gruppo          text not null check (gruppo in ('tipologia', 'extra', 'servizio_esterno')),
  nome            text not null check (char_length(trim(nome)) between 1 and 200),
  descrizione     text not null default '' check (char_length(descrizione) <= 1000),
  prezzo          numeric(12,2) check (prezzo is null or prezzo >= 0),
  -- fisso = prezzo certo · da = prezzo di partenza, da confermare · preventivo = nessun prezzo automatico
  modalita        text not null default 'fisso' check (modalita in ('fisso', 'da', 'preventivo')),
  pagine_incluse  integer not null default 0 check (pagine_incluse between 0 and 100),   -- solo tipologie
  incluse         text[] not null default '{}',                                          -- solo tipologie: codici degli extra già compresi
  a_quantita      boolean not null default false,                                        -- solo extra: si può scegliere più volte
  costo_testo     text not null default '' check (char_length(costo_testo) <= 200),      -- solo servizi esterni: testo libero (niente somme $/€)
  ordine          integer not null default 0,
  attivo          boolean not null default true,
  created_at      timestamptz not null default now(),
  check (gruppo = 'servizio_esterno' or modalita = 'preventivo' or prezzo is not null)
);

create index if not exists configuratore_voci_gruppo_idx on public.configuratore_voci (gruppo, ordine);

create table if not exists public.configuratore_impostazioni (
  chiave  text primary key check (char_length(chiave) between 1 and 60),
  valore  text not null default '' check (char_length(valore) <= 2000)
);

alter table public.configuratore_voci          enable row level security;
alter table public.configuratore_impostazioni  enable row level security;

drop policy if exists "voci: lettura pubblica"    on public.configuratore_voci;
drop policy if exists "voci: admin tutto"         on public.configuratore_voci;
drop policy if exists "impostazioni: lettura"     on public.configuratore_impostazioni;
drop policy if exists "impostazioni: admin tutto" on public.configuratore_impostazioni;

create policy "voci: lettura pubblica"
  on public.configuratore_voci for select to anon, authenticated using (attivo);
create policy "voci: admin tutto"
  on public.configuratore_voci for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "impostazioni: lettura"
  on public.configuratore_impostazioni for select to anon, authenticated using (true);
create policy "impostazioni: admin tutto"
  on public.configuratore_impostazioni for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.configuratore_voci, public.configuratore_impostazioni from anon, authenticated;
grant select on public.configuratore_voci, public.configuratore_impostazioni to anon;
grant select, insert, update, delete on public.configuratore_voci, public.configuratore_impostazioni to authenticated;

-- -----------------------------------------------------------------------------
-- Dati iniziali (dal PRD). Le pagine incluse e le funzionalità già comprese in
-- ogni tipologia NON sono nel PRD: sono valori di partenza ragionevoli, da
-- controllare e correggere da Area riservata → Preventivi → Listino configuratore.
-- -----------------------------------------------------------------------------
insert into public.configuratore_voci (codice, gruppo, nome, descrizione, prezzo, modalita, pagine_incluse, incluse, ordine) values
  ('landing_page',        'tipologia', 'Landing Page',               'Una sola pagina pensata per presentare un''offerta e raccogliere contatti.',                199,  'fisso',     1, '{}', 10),
  ('sito_vetrina',        'tipologia', 'Sito Vetrina',               'Presenta la tua attività con poche pagine chiare: chi sei, cosa offri, come contattarti.',   299,  'fisso',     3, '{}', 20),
  ('sito_aziendale',      'tipologia', 'Sito Aziendale',             'Sito completo per aziende e professionisti: servizi, team, contatti e sezioni dedicate.',    449,  'fisso',     5, '{}', 30),
  ('ristorante_bar',      'tipologia', 'Ristorante / Bar',           'Menù, orari, foto dei piatti e posizione per far conoscere il tuo locale.',                  399,  'fisso',     4, '{}', 40),
  ('barbiere_estetica',   'tipologia', 'Barbiere / Centro Estetico', 'Servizi, listino, galleria dei lavori e contatti per i tuoi clienti.',                        399,  'fisso',     4, '{}', 50),
  ('prenotazioni_online', 'tipologia', 'Prenotazioni Online',        'Sito con sistema di prenotazione per appuntamenti, tavoli o servizi.',                       599,  'fisso',     5, '{sistema_prenotazioni}', 60),
  ('hotel_bnb',           'tipologia', 'Hotel / B&B',                'Camere, servizi, galleria e richiesta di disponibilità per la tua struttura.',               599,  'fisso',     6, '{}', 70),
  ('catalogo_prodotti',   'tipologia', 'Catalogo Prodotti',          'Vetrina dei tuoi prodotti con schede dettagliate, senza acquisto online.',                   449,  'fisso',     6, '{}', 80),
  ('agenzia_immobiliare', 'tipologia', 'Agenzia Immobiliare',        'Schede degli immobili, ricerca e contatto diretto con l''agenzia.',                          699,  'fisso',     8, '{}', 90),
  ('eventi',              'tipologia', 'Eventi',                     'Programma, location, iscrizioni e informazioni per il tuo evento.',                          399,  'fisso',     4, '{}', 100),
  ('ecommerce',           'tipologia', 'E-commerce',                 'Negozio online con carrello e pagamento per vendere i tuoi prodotti.',                       899,  'fisso',     6, '{pagamenti_online}', 110),
  ('gestionale',          'tipologia', 'Gestionale Personalizzato',  'Applicazione su misura per gestire clienti, ordini o processi della tua attività.',          1199, 'da',        1, '{pannello_amministrativo}', 120),
  ('sito_personalizzato', 'tipologia', 'Sito Personalizzato',        'Hai un''esigenza particolare? Descrivici il progetto e ti prepariamo un preventivo.',        null, 'preventivo',0, '{}', 130)
on conflict (codice) do nothing;

insert into public.configuratore_voci (codice, gruppo, nome, descrizione, prezzo, modalita, a_quantita, ordine) values
  ('pagina_aggiuntiva',     'extra', 'Pagina aggiuntiva',      'Ogni pagina oltre a quelle incluse nel tipo di sito.',                 49,  'fisso', true,  10),
  ('modulo_contatti',       'extra', 'Modulo contatti',        'Form per ricevere i messaggi dei clienti via email.',                  39,  'fisso', false, 20),
  ('pulsante_whatsapp',     'extra', 'Pulsante WhatsApp',      'Pulsante per far scriverti i clienti direttamente su WhatsApp.',       19,  'fisso', false, 30),
  ('menu_digitale_qr',      'extra', 'Menù digitale QR',       'Menù consultabile da telefono con QR code da stampare.',               99,  'fisso', false, 40),
  ('sistema_prenotazioni',  'extra', 'Sistema prenotazioni',   'I clienti prenotano online giorno e orario.',                          199, 'fisso', false, 50),
  ('pagamenti_online',      'extra', 'Pagamenti online',       'Incassa online con carta tramite un servizio di pagamento sicuro.',    199, 'fisso', false, 60),
  ('area_riservata_utenti', 'extra', 'Area riservata utenti',  'Zona con login dove i tuoi clienti trovano i propri dati.',            249, 'fisso', false, 70),
  ('pannello_amministrativo','extra','Pannello amministrativo','Area per modificare tu stesso contenuti e dati del sito.',            299, 'fisso', false, 80),
  ('lingua_aggiuntiva',     'extra', 'Lingua aggiuntiva',      'Il sito tradotto in un''altra lingua (prezzo per ogni lingua).',       99,  'fisso', true,  90),
  ('seo_base',              'extra', 'SEO di base',            'Impostazioni di base per farti trovare meglio su Google.',             99,  'fisso', false, 100),
  ('sistema_recensioni',    'extra', 'Sistema recensioni',     'Raccogli e mostra le recensioni dei clienti.',                         79,  'fisso', false, 110),
  ('chatbot_ai',            'extra', 'Chatbot AI',             'Assistente virtuale che risponde alle domande dei visitatori.',        199, 'da',    false, 120),
  ('newsletter',            'extra', 'Newsletter',             'Iscrizione e invio di email ai tuoi contatti.',                        99,  'fisso', false, 130),
  ('gestione_ordini',       'extra', 'Gestione ordini',        'Pannello per seguire e gestire gli ordini ricevuti.',                  299, 'da',    false, 140)
on conflict (codice) do nothing;

insert into public.configuratore_voci (codice, gruppo, nome, descrizione, costo_testo, modalita, ordine) values
  ('vercel',           'servizio_esterno', 'Vercel',           'Hosting e pubblicazione',        'Pro da $20/mese',              'fisso', 10),
  ('supabase',         'servizio_esterno', 'Supabase',         'Database e autenticazione',      'Gratis o da $25/mese',         'fisso', 20),
  ('resend',           'servizio_esterno', 'Resend',           'Email automatiche',              'Gratis o da $20/mese',         'fisso', 30),
  ('stripe',           'servizio_esterno', 'Stripe',           'Pagamenti online',               'Commissioni per transazione',  'fisso', 40),
  ('dominio',          'servizio_esterno', 'Dominio',          'Indirizzo del sito',             'circa 10–25 €/anno',           'fisso', 50),
  ('sendcloud',        'servizio_esterno', 'Sendcloud',        'Spedizioni',                     'Gratis o a pagamento',         'fisso', 60),
  ('cloudflare',       'servizio_esterno', 'Cloudflare',       'Sicurezza e prestazioni',        'Gratis o a pagamento',         'fisso', 70),
  ('google_workspace', 'servizio_esterno', 'Google Workspace', 'Email aziendali',                'Abbonamento per utente',       'fisso', 80)
on conflict (codice) do nothing;

insert into public.configuratore_impostazioni (chiave, valore) values
  ('urgenza_percentuale',   '20'),
  ('avviso_servizi_esterni','I costi dei servizi esterni variano in base alle funzionalità richieste e ai piani scelti. Verranno comunicati e concordati prima dell’attivazione.'),
  ('avviso_preventivo',     'Preventivo indicativo, soggetto a conferma da parte di FormaWeb.')
on conflict (chiave) do nothing;

-- -----------------------------------------------------------------------------
-- Colonne nuove su ordini_siti
-- -----------------------------------------------------------------------------
alter table public.ordini_siti add column if not exists tipologia_codice     text;
alter table public.ordini_siti add column if not exists pagine_numero        integer;
alter table public.ordini_siti add column if not exists extra_selezionati    jsonb not null default '{}'::jsonb;
alter table public.ordini_siti add column if not exists urgenza_richiesta    boolean not null default false;
alter table public.ordini_siti add column if not exists urgenza_confermata   boolean not null default false;
alter table public.ordini_siti add column if not exists totale_indicativo    numeric(12,2);
alter table public.ordini_siti add column if not exists dettaglio_preventivo jsonb;
alter table public.ordini_siti add column if not exists approvazione_manuale boolean not null default false;
alter table public.ordini_siti add column if not exists allegati             text[] not null default '{}';

-- -----------------------------------------------------------------------------
-- Calcolo del preventivo (unica fonte di verità; il sito ne mostra una copia
-- istantanea solo per comodità).
--   totale = prezzo base + pagine aggiuntive + extra (esclusi quelli già inclusi)
--            + supplemento urgenza SOLO se confermato da FormaWeb
-- Input: {"tipologia":"codice","pagine":6,"extra":{"codice":quantità,…},"urgenza_confermata":false}
-- -----------------------------------------------------------------------------
create or replace function public.calcola_preventivo(p jsonb)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  t            public.configuratore_voci;
  v            public.configuratore_voci;
  n            integer;
  qty          integer;
  k            text;
  val          jsonb;
  extra_in     jsonb;
  righe        jsonb := '[]'::jsonb;
  importo      numeric;
  incluso      boolean;
  pag_prezzo   numeric;
  pag_extra    integer := 0;
  pag_importo  numeric := 0;
  sub          numeric := 0;
  appr         boolean := false;
  pct          numeric := 20;
  urg          numeric;
  urg_ok       boolean := false;
  txt          text;
begin
  select * into t from public.configuratore_voci
   where codice = p ->> 'tipologia' and gruppo = 'tipologia' and attivo;
  if not found then
    raise exception 'Scegli il tipo di sito.';
  end if;

  -- pagine
  txt := coalesce(p ->> 'pagine', '');
  if txt = '' then
    n := greatest(t.pagine_incluse, 1);
  elsif txt ~ '^[0-9]{1,3}$' then
    n := txt::integer;
  else
    raise exception 'Numero di pagine non valido.';
  end if;
  if n < 1 or n > 100 then
    raise exception 'Il numero di pagine deve essere tra 1 e 100.';
  end if;

  if coalesce(p ->> 'urgenza_confermata', 'false') = 'true' then urg_ok := true; end if;

  select case when valore ~ '^[0-9]{1,3}([.,][0-9]+)?$' then replace(valore, ',', '.')::numeric else 20 end
    into pct
    from public.configuratore_impostazioni where chiave = 'urgenza_percentuale';
  pct := coalesce(pct, 20);

  -- prezzo base
  if t.modalita in ('da', 'preventivo') then appr := true; end if;
  sub := coalesce(t.prezzo, 0);

  -- pagine aggiuntive (non per i siti a preventivo)
  if t.modalita <> 'preventivo' then
    pag_extra := greatest(0, n - t.pagine_incluse);
  end if;
  if pag_extra > 0 then
    select prezzo into pag_prezzo from public.configuratore_voci
     where codice = 'pagina_aggiuntiva' and gruppo = 'extra' and attivo;
    if pag_prezzo is null then
      raise exception 'Prezzo della pagina aggiuntiva non configurato.';
    end if;
    pag_importo := pag_extra * pag_prezzo;
    sub := sub + pag_importo;
  end if;

  -- extra
  extra_in := case when jsonb_typeof(p -> 'extra') = 'object' then p -> 'extra' else '{}'::jsonb end;
  for k, val in select key, value from jsonb_each(extra_in) loop
    txt := val #>> '{}';
    if txt !~ '^[0-9]{1,2}$' then
      continue;
    end if;
    if txt::integer = 0 then
      continue;
    end if;

    select * into v from public.configuratore_voci
     where codice = k and gruppo = 'extra' and attivo and codice <> 'pagina_aggiuntiva';
    if not found then
      raise exception 'Funzionalità non valida: %', k;
    end if;

    qty := case when v.a_quantita then least(txt::integer, 20) else 1 end;
    incluso := k = any (t.incluse);
    importo := case when incluso then 0 else coalesce(v.prezzo, 0) * qty end;
    if not incluso and v.modalita in ('da', 'preventivo') then appr := true; end if;

    righe := righe || jsonb_build_array(jsonb_build_object(
      'codice', v.codice, 'nome', v.nome, 'quantita', qty,
      'importo', importo, 'incluso', incluso, 'modalita', v.modalita, 'ordine', v.ordine));
    sub := sub + importo;
  end loop;

  urg := round(sub * pct / 100, 2);

  return jsonb_build_object(
    'tipologia', jsonb_build_object('codice', t.codice, 'nome', t.nome, 'prezzo', t.prezzo, 'modalita', t.modalita),
    'pagine', n,
    'pagine_incluse', t.pagine_incluse,
    'pagine_extra', pag_extra,
    'pagine_extra_importo', pag_importo,
    'righe', righe,
    'subtotale', sub,
    'urgenza_percentuale', pct,
    'urgenza_importo', urg,
    'urgenza_confermata', urg_ok,
    'totale', sub + case when urg_ok then urg else 0 end,
    'approvazione_manuale', appr
  );
end $$;

revoke all on function public.calcola_preventivo(jsonb) from public;
grant execute on function public.calcola_preventivo(jsonb) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Il cliente invia la richiesta. Con il configuratore (campo "tipologia") il
-- prezzo indicativo è RICALCOLATO qui dal listino: qualunque numero arrivi dal
-- browser viene ignorato. L'ordine nasce senza prezzo: il pagamento resta
-- bloccato finché l'admin non conferma l'importo e invia il preventivo.
-- -----------------------------------------------------------------------------
create or replace function public.crea_richiesta_sito(p jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_token   uuid;
  v_email   text := lower(trim(coalesce(p ->> 'cliente_email', '')));
  v_funz    text[];
  v_tip     text := nullif(trim(coalesce(p ->> 'tipologia', '')), '');
  c         jsonb;
  v_tipo    text := coalesce(p ->> 'tipo_sito', '');
  v_pagine  text := coalesce(p ->> 'pagine', '');
  v_pag_n   integer;
  v_extra   jsonb := '{}'::jsonb;
  v_scad    text := coalesce(p ->> 'scadenza', '');
  v_urg     boolean := false;
  v_tot     numeric;
  v_appr    boolean := false;
  v_all     text[] := '{}';
  v_cart    text := lower(coalesce(p ->> 'cartella', ''));
  a         text;
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

  if v_tip is not null then
    -- Configuratore: prezzo ricalcolato dal listino (urgenza mai confermata dal cliente)
    c := public.calcola_preventivo(jsonb_build_object(
           'tipologia', v_tip, 'pagine', p -> 'pagine', 'extra', coalesce(p -> 'extra', '{}'::jsonb),
           'urgenza_confermata', false));
    v_tipo   := c -> 'tipologia' ->> 'nome';
    v_pag_n  := (c ->> 'pagine')::integer;
    v_pagine := v_pag_n || case when v_pag_n = 1 then ' pagina' else ' pagine' end;
    v_tot    := (c ->> 'subtotale')::numeric;
    v_appr   := (c ->> 'approvazione_manuale')::boolean;

    select coalesce(array_agg(left(
             (r ->> 'nome')
             || case when (r ->> 'incluso')::boolean then ' (inclusa)'
                     when (r ->> 'quantita')::integer > 1 then ' ×' || (r ->> 'quantita') else '' end, 100)
             order by (r ->> 'ordine')::integer), '{}'),
           coalesce(jsonb_object_agg(r ->> 'codice', (r ->> 'quantita')::integer), '{}'::jsonb)
      into v_funz, v_extra
      from jsonb_array_elements(c -> 'righe') r;

    if coalesce(p ->> 'scadenza_tipo', '') = 'urgente' then
      v_urg  := true;
      v_scad := 'Consegna urgente (da confermare)';
    elsif coalesce(p ->> 'scadenza_tipo', '') = 'nessuna' then
      v_scad := 'Nessuna scadenza precisa';
    else
      v_scad := 'Consegna standard';
    end if;
  else
    -- Modulo precedente (senza configuratore)
    select coalesce(array_agg(left(f, 100)), '{}') into v_funz
      from jsonb_array_elements_text(coalesce(p -> 'funzionalita', '[]'::jsonb)) f;
  end if;

  -- Allegati: solo percorsi del bucket privato, nella cartella scelta da questa richiesta
  if jsonb_typeof(p -> 'allegati') = 'array' then
    if jsonb_array_length(p -> 'allegati') > 10 then
      raise exception 'Puoi allegare al massimo 10 file.';
    end if;
    if v_cart !~ '^[0-9a-f-]{36}$' then
      raise exception 'Allegati non validi.';
    end if;
    for a in select jsonb_array_elements_text(p -> 'allegati') loop
      if a !~ ('^richieste/' || v_cart || '/[A-Za-z0-9._-]{1,120}$') then
        raise exception 'Allegato non valido.';
      end if;
      v_all := v_all || a;
    end loop;
  end if;

  insert into public.ordini_siti (
    cliente_nome, cliente_email, cliente_telefono, cliente_codice, cliente_indirizzo,
    tipo_sito, nome_attivita, pagine, funzionalita, lingue, dominio, stile, descrizione, scadenza, budget,
    tipologia_codice, pagine_numero, extra_selezionati, urgenza_richiesta, totale_indicativo,
    dettaglio_preventivo, approvazione_manuale, allegati
  ) values (
    trim(p ->> 'cliente_nome'), v_email,
    coalesce(p ->> 'cliente_telefono', ''), trim(p ->> 'cliente_codice'), trim(p ->> 'cliente_indirizzo'),
    v_tipo, coalesce(p ->> 'nome_attivita', ''), v_pagine,
    v_funz, coalesce(p ->> 'lingue', ''), coalesce(p ->> 'dominio', ''), coalesce(p ->> 'stile', ''),
    trim(p ->> 'descrizione'), v_scad, coalesce(p ->> 'budget', ''),
    v_tip, v_pag_n, v_extra, v_urg, v_tot,
    c, v_appr, v_all
  ) returning token into v_token;

  return v_token;
end $$;

revoke all on function public.crea_richiesta_sito(jsonb) from public;
grant execute on function public.crea_richiesta_sito(jsonb) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Il cliente legge il proprio ordine dal token (nessun dato interno)
-- -----------------------------------------------------------------------------
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
    'numero_ordine',        'W-' || lpad(o.numero::text, 5, '0'),
    'stato',                o.stato,
    'cliente_nome',         o.cliente_nome,
    'cliente_email',        o.cliente_email,
    'tipo_sito',            o.tipo_sito,
    'nome_attivita',        o.nome_attivita,
    'pagine',               o.pagine,
    'funzionalita',         to_jsonb(o.funzionalita),
    'dominio',              o.dominio,
    'descrizione',          o.descrizione,
    'budget',               o.budget,
    'scadenza',             o.scadenza,
    'prezzo',               o.prezzo,
    'acconto',              coalesce(o.acconto, o.prezzo),
    'consegna_giorni',      o.consegna_giorni,
    'nota_preventivo',      o.nota_preventivo,
    'pagato_il',            o.pagato_il,
    'importo_pagato',       o.importo_pagato,
    'created_at',           o.created_at,
    'totale_indicativo',    o.totale_indicativo,
    'dettaglio_preventivo', o.dettaglio_preventivo,
    'approvazione_manuale', o.approvazione_manuale,
    'urgenza_richiesta',    o.urgenza_richiesta,
    'urgenza_confermata',   o.urgenza_confermata,
    'n_allegati',           cardinality(o.allegati),
    'contratto',            case
                              when o.stato = 'pagato' then o.contratto_finale
                              when o.stato = 'preventivo_inviato' then public._contratto_compilato(o.id)
                              else null
                            end
  );
end $$;

revoke all on function public.leggi_ordine(uuid) from public;
grant execute on function public.leggi_ordine(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Storage: bucket PRIVATO per gli allegati dei clienti
--   • il cliente (senza account) può SOLO caricare, in richieste/<cartella>/<file>
--   • solo l'admin legge, aggiorna ed elimina
--   • tipi e dimensione sono limitati dal bucket (5 MB; immagini, PDF, Word, testo)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'richieste-allegati', 'richieste-allegati', false, 5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "richieste-allegati: carica"        on storage.objects;
drop policy if exists "richieste-allegati: admin legge"   on storage.objects;
drop policy if exists "richieste-allegati: admin aggiorna" on storage.objects;
drop policy if exists "richieste-allegati: admin elimina" on storage.objects;

create policy "richieste-allegati: carica"
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'richieste-allegati'
    and name ~ '^richieste/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'
  );

create policy "richieste-allegati: admin legge"
  on storage.objects for select to authenticated
  using (bucket_id = 'richieste-allegati' and public.is_admin());

create policy "richieste-allegati: admin aggiorna"
  on storage.objects for update to authenticated
  using (bucket_id = 'richieste-allegati' and public.is_admin());

create policy "richieste-allegati: admin elimina"
  on storage.objects for delete to authenticated
  using (bucket_id = 'richieste-allegati' and public.is_admin());

notify pgrst, 'reload schema';
