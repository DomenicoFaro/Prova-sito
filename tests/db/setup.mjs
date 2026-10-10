// Database di prova (PGlite = Postgres in memoria): finte parti di Supabase (utenti, ruoli, storage)
// + gli script SQL VERI della cartella supabase/. Serve ai test; non tocca nessun database reale.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PROGETTO = fileURLToPath(new URL('../../supabase', import.meta.url))

const STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, encrypted_password text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
grant usage on schema auth, storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
`

export async function creaDb({ conConfiguratore = true } = {}) {
  const db = new PGlite()
  await db.exec(STUB)
  const log = []
  const ordine = ['schema.sql', 'account.sql', 'utenti.sql', 'vendite.sql', 'opportunita.sql', 'soci.sql', 'ordini.sql', 'incassi.sql', 'prezzi_abbonamenti.sql']
  for (const f of [...ordine, ...(conConfiguratore ? ['configuratore.sql'] : [])]) {
    let sql = readFileSync(`${PROGETTO}/${f}`, 'utf8').replace(/create extension if not exists pgcrypto;/g, '')
    try {
      await db.exec(sql)
      log.push(`OK    ${f}`)
    } catch (e) {
      log.push(`ERRORE ${f}: ${e.message}`)
      if (f === 'configuratore.sql' || f === 'ordini.sql') throw Object.assign(e, { log })
    }
  }
  return { db, log }
}

if (process.argv[1].endsWith('setup.mjs')) {
  const { log } = await creaDb().catch((e) => { console.log((e.log ?? []).join('\n')); console.error(e.message); process.exit(1) })
  console.log(log.join('\n'))
}
