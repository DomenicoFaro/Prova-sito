-- =============================================================================
-- Notifiche email (Resend): segna quali email sono già partite per ogni ordine,
-- così non ne arrivano due uguali (doppio clic, webhook Stripe ripetuto…).
-- Esegui UNA VOLTA: SQL Editor → New query → incolla → Run. Si può rieseguire.
-- =============================================================================
alter table public.ordini_siti add column if not exists email_richiesta_inviata    boolean not null default false;
alter table public.ordini_siti add column if not exists email_accettazione_inviata boolean not null default false;
