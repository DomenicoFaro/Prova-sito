-- =============================================================================
-- Creazione account dall'area admin (nome, email, password, ruolo).
-- Esegui UNA VOLTA dopo schema.sql: SQL Editor → New query → incolla → Run.
-- Si può rieseguire senza problemi.
--
--  • public.admin_crea_account(...)        → usata dal form "Nuovo account"
--  • public.admin_imposta_password(...)    → usata da "Cambia password"
-- Entrambe controllano che chi le chiama sia un admin attivo.
-- =============================================================================

-- Funzione interna: crea l'utente in auth.users già confermato, con la password
-- scelta. NON è richiamabile dal sito (niente grant): la usano solo le funzioni
-- qui sotto e lo script owner.sql.
create or replace function public._crea_utente_auth(p_email text, p_password text, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Email non valida' using errcode = '22023';
  end if;
  if char_length(coalesce(p_password, '')) < 8 then
    raise exception 'La password deve contenere almeno 8 caratteri' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Esiste già un account con questa email' using errcode = '23505';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', trim(p_nome)), now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  -- Il trigger on_auth_user_created ha già creato il profilo
  return v_id;
end;
$$;

revoke all on function public._crea_utente_auth(text, text, text) from public, anon, authenticated;

-- Crea un account dal form admin --------------------------------------------------
create or replace function public.admin_crea_account(
  p_nome text,
  p_email text,
  p_password text,
  p_ruolo public.ruolo_utente default 'collaboratore',
  p_percentuale numeric default 0
)
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
  if p_percentuale is null or p_percentuale < 0 or p_percentuale > 100 then
    raise exception 'La percentuale deve essere tra 0 e 100' using errcode = '22023';
  end if;

  v_id := public._crea_utente_auth(p_email, p_password, p_nome);

  update public.profiles
     set nome = trim(p_nome), ruolo = p_ruolo, percentuale_default = p_percentuale, attivo = true
   where id = v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_crea_account(text, text, text, public.ruolo_utente, numeric) from public, anon;
grant execute on function public.admin_crea_account(text, text, text, public.ruolo_utente, numeric) to authenticated;

-- Cambia la password di un account (utile se qualcuno la dimentica) --------------
create or replace function public.admin_imposta_password(p_user_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un amministratore può cambiare le password' using errcode = '42501';
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

revoke all on function public.admin_imposta_password(uuid, text) from public, anon;
grant execute on function public.admin_imposta_password(uuid, text) to authenticated;
