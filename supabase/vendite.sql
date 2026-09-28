-- =============================================================================
-- Vendite: il collaboratore segnala un sito venduto (dati cliente, accordi,
-- contratto firmato); l'admin le vede tutte, le approva e ne crea il progetto.
-- Esegui UNA VOLTA dopo schema.sql: SQL Editor → New query → incolla → Run.
-- Si può rieseguire senza problemi.
-- =============================================================================

do $$ begin
  create type public.stato_vendita as enum ('in_attesa', 'approvata', 'rifiutata');
exception when duplicate_object then null; end $$;

create table if not exists public.vendite (
  id                 uuid primary key default gen_random_uuid(),
  collaboratore_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Cliente
  cliente_nome       text not null check (char_length(trim(cliente_nome)) between 1 and 200),
  cliente_codice     text not null default '' check (char_length(cliente_codice) <= 50),   -- P.IVA o codice fiscale
  cliente_email      text not null default '' check (char_length(cliente_email) <= 320),
  cliente_telefono   text not null default '' check (char_length(cliente_telefono) <= 50),
  cliente_indirizzo  text not null default '' check (char_length(cliente_indirizzo) <= 300),
  -- Sito
  sito_nome          text not null check (char_length(trim(sito_nome)) between 1 and 200),
  tipo_sito          text not null default '' check (char_length(tipo_sito) <= 100),
  dominio            text not null default '' check (char_length(dominio) <= 300),
  -- Accordi
  prezzo             numeric(12,2) not null check (prezzo >= 0),
  acconto            numeric(12,2) not null default 0 check (acconto >= 0),
  data_firma         date not null default current_date,
  consegna_prevista  date,
  note               text not null default '' check (char_length(note) <= 5000),
  -- Contratto firmato: percorsi nel bucket "contratti" (firmati/<id utente>/...)
  allegati           text[] not null check (cardinality(allegati) between 1 and 20),
  -- Gestione admin
  stato              public.stato_vendita not null default 'in_attesa',
  progetto_id        uuid references public.progetti (id) on delete set null,
  created_at         timestamptz not null default now()
);

create index if not exists vendite_collaboratore_idx on public.vendite (collaboratore_id);

alter table public.vendite enable row level security;

drop policy if exists "vendite: collaboratore legge le proprie" on public.vendite;
drop policy if exists "vendite: collaboratore inserisce"        on public.vendite;
drop policy if exists "vendite: admin tutto"                    on public.vendite;

create policy "vendite: collaboratore legge le proprie"
  on public.vendite for select to authenticated
  using (collaboratore_id = auth.uid() and public.is_attivo());

-- Può solo creare vendite a proprio nome, in attesa, con file nella propria cartella
create policy "vendite: collaboratore inserisce"
  on public.vendite for insert to authenticated
  with check (
    collaboratore_id = auth.uid()
    and public.is_attivo()
    and stato = 'in_attesa'
    and progetto_id is null
    and coalesce((select bool_and(a like 'firmati/' || auth.uid()::text || '/%') from unnest(allegati) a), false)
  );

create policy "vendite: admin tutto"
  on public.vendite for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.vendite from anon, authenticated;
grant select, insert, update, delete on public.vendite to authenticated;

-- Fa vedere subito la nuova tabella all'API del sito
notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Storage: bucket PRIVATO "contratti"
--   modello/...                  modello di contratto (carica l'admin, scaricano tutti gli utenti attivi)
--   firmati/<id utente>/...      contratti firmati (li vede solo chi li carica e l'admin)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contratti', 'contratti', false, 15728640,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "contratti: lettura"  on storage.objects;
drop policy if exists "contratti: carica"   on storage.objects;
drop policy if exists "contratti: aggiorna" on storage.objects;
drop policy if exists "contratti: elimina"  on storage.objects;

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

create policy "contratti: carica"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'contratti' and (
      public.is_admin()
      or (public.is_attivo()
          and (storage.foldername(name))[1] = 'firmati'
          and (storage.foldername(name))[2] = auth.uid()::text)
    )
  );

create policy "contratti: aggiorna"
  on storage.objects for update to authenticated
  using (bucket_id = 'contratti' and public.is_admin());

-- Il collaboratore può eliminare solo i propri file (serve se l'invio fallisce a metà)
create policy "contratti: elimina"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'contratti' and (
      public.is_admin()
      or ((storage.foldername(name))[1] = 'firmati' and (storage.foldername(name))[2] = auth.uid()::text)
    )
  );
