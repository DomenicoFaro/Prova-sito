-- =============================================================================
-- Soci + listino prezzi pubblico.
-- Esegui UNA VOLTA dopo schema.sql, account.sql, vendite.sql e opportunita.sql:
-- SQL Editor → New query → incolla → Run. Si può rieseguire senza problemi.
--
-- Ruoli:
--   admin  (tu)    vede e fa tutto, su tutti i collaboratori (i tuoi e quelli dei soci).
--   socio  (Diego) ha la tua stessa area, ma vede/gestisce solo il PROPRIO team
--                  (collaboratori e progetti suoi). Dell'azienda vede solo i
--                  totali (fatturato), mai i tuoi guadagni né i tuoi collaboratori.
--   collaboratore  invariato.
--
-- Come si decide "di chi" è un collaboratore / un progetto:
--   profiles.responsabile_id  → admin o socio che lo gestisce (null = admin)
--   progetti.gestore_id       → admin o socio proprietario del progetto (null = admin)
-- I dati già presenti restano quindi tuoi, senza nessuna migrazione.
-- =============================================================================

-- Nuovo ruolo. (Se l'editor segnala che il valore non è ancora utilizzabile,
-- esegui prima solo questa riga e poi il resto dello script.)
alter type public.ruolo_utente add value if not exists 'socio';

alter table public.profiles add column if not exists responsabile_id uuid references public.profiles (id) on delete set null;
alter table public.progetti add column if not exists gestore_id      uuid references public.profiles (id) on delete set null;

create index if not exists profiles_responsabile_idx on public.profiles (responsabile_id);
create index if not exists progetti_gestore_idx      on public.progetti (gestore_id);

-- -----------------------------------------------------------------------------
-- Funzioni di supporto (security definer: leggono senza passare dalle RLS,
-- così le policy non diventano ricorsive)
-- -----------------------------------------------------------------------------
create or replace function public.is_socio()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and ruolo::text = 'socio' and attivo
  );
$$;

-- true se l'utente corrente può gestire p_user: admin → chiunque;
-- socio → sé stesso e i collaboratori del proprio team.
create or replace function public.gestisce(p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin()
      or (
        public.is_socio() and exists (
          select 1 from public.profiles
          where id = p_user and (id = auth.uid() or responsabile_id = auth.uid())
        )
      );
$$;

create or replace function public.progetto_del_socio(p_progetto uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_socio() and exists (
    select 1 from public.progetti where id = p_progetto and gestore_id = auth.uid()
  );
$$;

create or replace function public.assegnazione_del_socio(p_assegnazione uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_socio() and exists (
    select 1 from public.assegnazioni a
    join public.progetti p on p.id = a.progetto_id
    where a.id = p_assegnazione and p.gestore_id = auth.uid()
  );
$$;

revoke all on function public.is_socio()                  from public;
revoke all on function public.gestisce(uuid)              from public;
revoke all on function public.progetto_del_socio(uuid)    from public;
revoke all on function public.assegnazione_del_socio(uuid) from public;
grant execute on function public.is_socio()                   to authenticated;
grant execute on function public.gestisce(uuid)               to authenticated;
grant execute on function public.progetto_del_socio(uuid)     to authenticated;
grant execute on function public.assegnazione_del_socio(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Trigger sul profilo: il socio può modificare nome, % e stato attivo dei SUOI
-- collaboratori, ma non può promuoverli, spostarli ad altri o toccare l'email.
-- Chiunque altro (non admin) continua a non poter cambiare i campi sensibili.
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

  -- Creazione account in corso (impostato solo da admin_crea_account, valido per questa transazione)
  if current_setting('app.creazione_account', true) = 'on' then
    return new;
  end if;

  if public.is_socio() and old.id <> auth.uid()
     and old.responsabile_id = auth.uid() and old.ruolo::text = 'collaboratore' then
    if new.ruolo::text <> 'collaboratore'
       or new.responsabile_id is distinct from old.responsabile_id
       or new.email is distinct from old.email
       or new.id is distinct from old.id
       or new.created_at is distinct from old.created_at then
      raise exception 'Non hai i permessi per modificare questi campi del profilo'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.ruolo is distinct from old.ruolo
     or new.percentuale_default is distinct from old.percentuale_default
     or new.attivo is distinct from old.attivo
     or new.email is distinct from old.email
     or new.id is distinct from old.id
     or new.responsabile_id is distinct from old.responsabile_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Non hai i permessi per modificare questi campi del profilo'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Policy del socio (si sommano a quelle esistenti, che restano invariate)
-- -----------------------------------------------------------------------------
drop policy if exists "profiles: socio legge il suo team"          on public.profiles;
drop policy if exists "profiles: socio modifica il suo team"       on public.profiles;
drop policy if exists "progetti: socio gestisce i propri"          on public.progetti;
drop policy if exists "assegnazioni: socio gestisce le proprie"    on public.assegnazioni;
drop policy if exists "pagamenti: socio gestisce i propri"         on public.pagamenti;
drop policy if exists "vendite: socio legge il suo team"           on public.vendite;
drop policy if exists "vendite: socio modifica il suo team"        on public.vendite;
drop policy if exists "vendite: socio elimina dal suo team"        on public.vendite;

create policy "profiles: socio legge il suo team"
  on public.profiles for select to authenticated
  using (public.is_socio() and responsabile_id = auth.uid());

create policy "profiles: socio modifica il suo team"
  on public.profiles for update to authenticated
  using (public.is_socio() and responsabile_id = auth.uid() and ruolo::text = 'collaboratore')
  with check (responsabile_id = auth.uid());

create policy "progetti: socio gestisce i propri"
  on public.progetti for all to authenticated
  using (public.is_socio() and gestore_id = auth.uid())
  with check (public.is_socio() and gestore_id = auth.uid());

create policy "assegnazioni: socio gestisce le proprie"
  on public.assegnazioni for all to authenticated
  using (public.progetto_del_socio(progetto_id) and public.gestisce(collaboratore_id))
  with check (public.progetto_del_socio(progetto_id) and public.gestisce(collaboratore_id));

create policy "pagamenti: socio gestisce i propri"
  on public.pagamenti for all to authenticated
  using (public.assegnazione_del_socio(assegnazione_id))
  with check (public.assegnazione_del_socio(assegnazione_id));

create policy "vendite: socio legge il suo team"
  on public.vendite for select to authenticated
  using (public.is_socio() and public.gestisce(collaboratore_id));

create policy "vendite: socio modifica il suo team"
  on public.vendite for update to authenticated
  using (public.is_socio() and public.gestisce(collaboratore_id))
  with check (public.is_socio() and public.gestisce(collaboratore_id));

create policy "vendite: socio elimina dal suo team"
  on public.vendite for delete to authenticated
  using (public.is_socio() and public.gestisce(collaboratore_id));

-- Contratti firmati: il socio legge anche quelli del suo team
drop policy if exists "contratti: lettura"        on storage.objects;
drop policy if exists "contratti: lettura socio"  on storage.objects;

create policy "contratti: lettura"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'contratti' and (
      public.is_admin()
      or (public.is_attivo() and (
        (storage.foldername(name))[1] = 'modello'
        or ((storage.foldername(name))[1] = 'firmati' and (storage.foldername(name))[2] = auth.uid()::text)
      ))
    )
  );

create policy "contratti: lettura socio"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'contratti'
    and public.is_socio()
    and (storage.foldername(name))[1] = 'firmati'
    and (storage.foldername(name))[2] in (
      select id::text from public.profiles where responsabile_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Creazione account: l'admin crea chiunque (e sceglie il responsabile);
-- il socio crea solo collaboratori, sempre sotto di sé.
-- -----------------------------------------------------------------------------
drop function if exists public.admin_crea_account(text, text, text, public.ruolo_utente, numeric);

create or replace function public.admin_crea_account(
  p_nome text,
  p_email text,
  p_password text,
  p_ruolo public.ruolo_utente default 'collaboratore',
  p_percentuale numeric default 0,
  p_responsabile uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_id          uuid;
  v_responsabile uuid;
begin
  if public.is_admin() then
    v_responsabile := case when p_ruolo::text = 'collaboratore' then p_responsabile else null end;
    if v_responsabile is not null and not exists (
      select 1 from public.profiles
      where id = v_responsabile and ruolo::text in ('admin', 'socio') and attivo
    ) then
      raise exception 'Il responsabile deve essere un admin o un socio attivo' using errcode = '22023';
    end if;
  elsif public.is_socio() then
    if p_ruolo::text <> 'collaboratore' then
      raise exception 'Un socio può creare solo collaboratori' using errcode = '42501';
    end if;
    v_responsabile := auth.uid();
  else
    raise exception 'Non hai i permessi per creare account' using errcode = '42501';
  end if;

  if trim(coalesce(p_nome, '')) = '' then
    raise exception 'Il nome è obbligatorio' using errcode = '22023';
  end if;
  if p_percentuale is null or p_percentuale < 0 or p_percentuale > 100 then
    raise exception 'La percentuale deve essere tra 0 e 100' using errcode = '22023';
  end if;

  v_id := public._crea_utente_auth(p_email, p_password, p_nome);

  -- Autorizza il trigger protect_profile_fields solo per questo aggiornamento
  perform set_config('app.creazione_account', 'on', true);

  update public.profiles
     set nome = trim(p_nome), ruolo = p_ruolo, percentuale_default = p_percentuale,
         attivo = true, responsabile_id = v_responsabile
   where id = v_id;

  perform set_config('app.creazione_account', 'off', true);

  return v_id;
end;
$$;

revoke all on function public.admin_crea_account(text, text, text, public.ruolo_utente, numeric, uuid) from public, anon;
grant execute on function public.admin_crea_account(text, text, text, public.ruolo_utente, numeric, uuid) to authenticated;

-- Cambio password: admin per chiunque, socio solo per il proprio team
create or replace function public.admin_imposta_password(p_user_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
begin
  if not (
    public.is_admin()
    or (public.is_socio() and exists (
          select 1 from public.profiles where id = p_user_id and responsabile_id = auth.uid()))
  ) then
    raise exception 'Non hai i permessi per cambiare questa password' using errcode = '42501';
  end if;
  if char_length(coalesce(p_password, '')) < 8 then
    raise exception 'La password deve contenere almeno 8 caratteri' using errcode = '22023';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user_id;
  if not found then
    raise exception 'Account non trovato' using errcode = 'P0002';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Riepilogo azienda: al socio servono i TOTALI dell'azienda, non i dettagli.
-- Restituisce solo importo, data e stato di ogni progetto (niente nomi, clienti,
-- collaboratori, percentuali o guadagni di nessuno).
-- -----------------------------------------------------------------------------
create or replace function public.riepilogo_azienda()
returns table (prezzo_totale numeric, data_riferimento date, stato public.stato_progetto)
language sql
stable
security definer
set search_path = public
as $$
  select p.prezzo_totale, coalesce(p.data_consegna, p.created_at::date), p.stato
  from public.progetti p
  where public.is_admin() or public.is_socio();
$$;

revoke all on function public.riepilogo_azienda() from public, anon;
grant execute on function public.riepilogo_azienda() to authenticated;

-- -----------------------------------------------------------------------------
-- Opportunità: il socio vede i link privati dei collaboratori del suo team
-- (e i loro esiti). L'admin le vede già tutte.
-- -----------------------------------------------------------------------------
drop policy if exists "opportunita: socio legge il suo team" on public.opportunita;
drop policy if exists "esiti: socio legge il suo team"       on public.opportunita_esiti;
drop policy if exists "prese: socio legge il suo team"       on public.opportunita_prese;

create policy "opportunita: socio legge il suo team"
  on public.opportunita for select to authenticated
  using (public.is_socio() and owner_id is not null and public.gestisce(owner_id));

create policy "esiti: socio legge il suo team"
  on public.opportunita_esiti for select to authenticated
  using (public.is_socio() and public.gestisce(collaboratore_id));

create policy "prese: socio legge il suo team"
  on public.opportunita_prese for select to authenticated
  using (public.is_socio() and public.gestisce(collaboratore_id));

-- -----------------------------------------------------------------------------
-- Opportunità per TEAM: i posti che aggiungi tu li vede solo il tuo team; quelli
-- di Diego solo il suo. Ognuno ha poi «Le mie opportunità» (creato_da = io).
--   team_id    → di chi è il team a cui è destinata un'opportunità condivisa
--                (null = team dell'admin)
--   creato_da  → chi l'ha caricata
-- -----------------------------------------------------------------------------
alter table public.opportunita add column if not exists team_id   uuid references public.profiles (id) on delete set null;
alter table public.opportunita add column if not exists creato_da uuid references public.profiles (id) on delete set null default auth.uid();

-- Dati già presenti: i link privati sono del collaboratore, quelli condivisi dell'admin
update public.opportunita
   set creato_da = coalesce(owner_id, (select id from public.profiles where ruolo::text = 'admin' order by created_at limit 1))
 where creato_da is null;

create index if not exists opportunita_team_idx on public.opportunita (team_id);

-- Il team a cui appartiene l'utente corrente (null = team dell'admin)
create or replace function public.mio_team()
returns uuid
language sql stable security definer set search_path = public
as $$
  select responsabile_id from public.profiles where id = auth.uid();
$$;

revoke all on function public.mio_team() from public, anon;
grant execute on function public.mio_team() to authenticated;

-- Un collaboratore vede solo le opportunità condivise del PROPRIO team
drop policy if exists "opportunita: utenti attivi leggono"      on public.opportunita;
drop policy if exists "opportunita: socio gestisce il suo team" on public.opportunita;

create policy "opportunita: utenti attivi leggono"
  on public.opportunita for select to authenticated
  using (
    public.is_attivo()
    and (
      owner_id = auth.uid()
      or (
        owner_id is null and attiva
        and not public.is_socio()
        and team_id is not distinct from public.mio_team()
        and (
          exists (select 1 from public.opportunita_prese p
                  where p.opportunita_id = opportunita.id and p.collaboratore_id = auth.uid())
          or not public.opportunita_occupata_da_altri(opportunita.id)
        )
      )
    )
  );

-- Il socio crea, modifica ed elimina le opportunità condivise del suo team
create policy "opportunita: socio gestisce il suo team"
  on public.opportunita for all to authenticated
  using (public.is_socio() and owner_id is null and team_id = auth.uid())
  with check (public.is_socio() and owner_id is null and team_id = auth.uid());

-- Prendere in carico è possibile solo per le opportunità del proprio team
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

  perform pg_advisory_xact_lock(hashtext('prese:' || me::text));
  perform pg_advisory_xact_lock(hashtext('prese:' || p_opp::text));

  if not exists (
    select 1 from public.opportunita o
    where o.id = p_opp and o.attiva and o.owner_id is null
      and o.team_id is not distinct from public.mio_team()
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
-- Listino prezzi INTERNO: lo vedono solo gli utenti con un account (admin, soci,
-- collaboratori), NON i visitatori del sito. Lo modificano admin e soci.
-- Un prezzo può essere un intervallo (es. 500–600) e in € o $.
-- -----------------------------------------------------------------------------
create table if not exists public.prezzi (
  id               uuid primary key default gen_random_uuid(),
  tipo             text not null default 'sito' check (tipo in ('sito', 'servizio')),
  nome             text not null check (char_length(trim(nome)) between 1 and 200),
  descrizione      text not null default '' check (char_length(descrizione) <= 2000),
  prezzo           numeric(12,2) not null check (prezzo >= 0),
  prezzo_max       numeric(12,2) check (prezzo_max is null or prezzo_max >= prezzo),
  valuta           text not null default '€' check (valuta in ('€', '$')),
  a_partire_da     boolean not null default false,
  periodicita      text not null default '' check (char_length(periodicita) <= 50),  -- es. "una tantum", "al mese"
  caratteristiche  text[] not null default '{}',
  in_evidenza      boolean not null default false,
  ordine           integer not null default 0,
  attivo           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Se la tabella esisteva già dalla versione precedente
alter table public.prezzi add column if not exists prezzo_max numeric(12,2);
alter table public.prezzi add column if not exists valuta     text not null default '€';

create index if not exists prezzi_tipo_ordine_idx on public.prezzi (tipo, ordine);

alter table public.prezzi enable row level security;

drop policy if exists "prezzi: lettura pubblica"   on public.prezzi;
drop policy if exists "prezzi: lettura utenti"     on public.prezzi;
drop policy if exists "prezzi: gestori modificano" on public.prezzi;

create policy "prezzi: lettura utenti"
  on public.prezzi for select to authenticated
  using (attivo and public.is_attivo());

create policy "prezzi: gestori modificano"
  on public.prezzi for all to authenticated
  using (public.is_admin() or public.is_socio())
  with check (public.is_admin() or public.is_socio());

revoke all on public.prezzi from anon, authenticated;
grant select, insert, update, delete on public.prezzi to authenticated;

-- Fa vedere subito le novità all'API del sito
notify pgrst, 'reload schema';
