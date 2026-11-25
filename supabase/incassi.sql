-- =============================================================================
-- Incassi sui progetti + progetto creato in automatico quando un cliente paga.
-- Esegui UNA VOLTA dopo schema.sql, soci.sql e ordini.sql:
--   SQL Editor → New query → incolla → Run.
-- Si può rieseguire senza problemi.
--
--   progetti.incassato  → soldi davvero ricevuti dal cliente (acconto, saldo…).
--                         Da incassare = prezzo_totale - incassato.
--   progetti.ordine_id  → l'ordine del sito (ordini_siti) da cui nasce il progetto.
--
-- Quando il pagamento Stripe di un ordine va a buon fine, il webhook chiama
-- _ordine_segna_pagato(): oltre a segnare l'ordine come pagato, crea il progetto
-- «in lavorazione» (del team dell'admin) con il prezzo pieno e come incassato
-- solo l'importo realmente pagato (l'acconto).
-- =============================================================================

-- Colonna incassato. Alla prima esecuzione i progetti già consegnati (o in
-- manutenzione) risultano interamente incassati; quelli in lavorazione a zero:
-- puoi correggerli dal form del progetto.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'progetti' and column_name = 'incassato'
  ) then
    alter table public.progetti
      add column incassato numeric(12,2) not null default 0 check (incassato >= 0);
    update public.progetti set incassato = prezzo_totale where stato <> 'in_lavorazione';
  end if;
end $$;

alter table public.progetti
  add column if not exists ordine_id uuid unique references public.ordini_siti (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Segna l'ordine come pagato E crea il progetto (usata SOLO dal webhook Stripe)
-- -----------------------------------------------------------------------------
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

  -- Il sito entra subito tra i progetti ancora da fare: prezzo pieno, incassato = acconto
  insert into public.progetti (
    nome, cliente, categoria, descrizione, funzionalita,
    prezzo_totale, incassato, data_consegna, stato, pubblico, gestore_id, ordine_id
  ) values (
    coalesce(nullif(trim(o.nome_attivita), ''), nullif(trim(o.tipo_sito), ''), 'Sito di ' || o.cliente_nome),
    o.cliente_nome,
    o.tipo_sito,
    o.descrizione,
    o.funzionalita,
    coalesce(o.prezzo, p_importo),
    least(p_importo, coalesce(o.prezzo, p_importo)),
    case when o.consegna_giorni is not null then current_date + o.consegna_giorni end,
    'in_lavorazione',
    false,
    null,
    o.id
  )
  on conflict (ordine_id) do nothing;

  return o.id;
end $$;

revoke all on function public._ordine_segna_pagato(text, numeric) from public, anon, authenticated;
grant execute on function public._ordine_segna_pagato(text, numeric) to service_role;

notify pgrst, 'reload schema';
