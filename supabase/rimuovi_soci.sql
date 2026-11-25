-- =============================================================================
-- Toglie il ruolo «Socio» e i team separati: restano solo admin e collaboratori.
-- Esegui DOPO tutti gli altri script: SQL Editor → New query → incolla → Run.
-- Si può rieseguire. Se rilanci soci.sql, rilancia anche questo.
--
-- Cosa fa:
--   • gli account «socio» diventano collaboratori (non perdono l'accesso, ma
--     vedono solo i propri siti e guadagni);
--   • collaboratori e opportunità dei team dei soci passano tutti insieme
--     all'unico team, il tuo;
--   • nessuno può più essere creato o nominato socio.
-- Non cancella nessun account, progetto, vendita o pagamento.
-- La riassegnazione dei team non si può annullare.
-- =============================================================================

-- 1) Nessun socio: tutte le regole che lo riguardano smettono di valere
create or replace function public.is_socio()
returns boolean
language sql stable security definer set search_path = public
as $$
  select false;
$$;

drop policy if exists "profiles: socio legge il suo team"       on public.profiles;
drop policy if exists "profiles: socio modifica il suo team"    on public.profiles;
drop policy if exists "progetti: socio gestisce i propri"       on public.progetti;
drop policy if exists "assegnazioni: socio gestisce le proprie" on public.assegnazioni;
drop policy if exists "pagamenti: socio gestisce i propri"      on public.pagamenti;
drop policy if exists "vendite: socio legge il suo team"        on public.vendite;
drop policy if exists "vendite: socio modifica il suo team"     on public.vendite;
drop policy if exists "vendite: socio elimina dal suo team"     on public.vendite;
drop policy if exists "contratti: lettura socio"                on storage.objects;
drop policy if exists "opportunita: socio legge il suo team"    on public.opportunita;
drop policy if exists "opportunita: socio gestisce il suo team" on public.opportunita;
drop policy if exists "esiti: socio legge il suo team"          on public.opportunita_esiti;
drop policy if exists "prese: socio legge il suo team"          on public.opportunita_prese;

-- 2) Un solo team
update public.profiles    set ruolo = 'collaboratore' where ruolo::text = 'socio';
update public.profiles    set responsabile_id = null  where responsabile_id is not null;
update public.opportunita set team_id = null          where team_id is not null;

-- 3) Il ruolo non si può più assegnare
alter table public.profiles drop constraint if exists profiles_niente_soci;
alter table public.profiles add constraint profiles_niente_soci check (ruolo::text <> 'socio');

-- Fa vedere subito le novità all'API del sito
notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- FACOLTATIVO: per chiudere anche l'accesso a un ex socio, il modo più semplice
-- è Area riservata → Collaboratori → Disattiva.
-- -----------------------------------------------------------------------------
