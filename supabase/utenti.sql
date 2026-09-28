-- =============================================================================
-- Crea il tuo account OWNER (admin, vede tutto). Da eseguire UNA VOLTA,
-- DOPO account.sql. Cambia le tre righe segnate con ← e premi Run.
-- Gli altri account li crei poi dal sito: Area riservata → Collaboratori.
-- =============================================================================
do $$
declare
  v_nome     constant text := 'Owner';                   -- ← il tuo nome
  v_email    constant text := 'TUA-EMAIL@esempio.it';    -- ← la tua email (per accedere)
  v_password constant text := 'CambiaQuestaPassword1';   -- ← la tua password (min. 8 caratteri)
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);
  if v_id is null then
    v_id := public._crea_utente_auth(v_email, v_password, v_nome);
  end if;

  update public.profiles
     set nome = v_nome, ruolo = 'admin', attivo = true
   where id = v_id;
end $$;

select nome, email, ruolo, attivo from public.profiles order by ruolo, nome;
