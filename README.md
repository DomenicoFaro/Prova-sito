# Sito agenzia web: portfolio e area riservata collaboratori

Il sito ha due parti:

- **Parte pubblica** (sito privato, non indicizzato): home, portfolio con filtri per categoria e pagina di dettaglio di ogni progetto.
- **Area riservata**:
  - **Admin**: gestisce progetti, assegnazioni con le percentuali, pagamenti e collaboratori, e può aprire la "vista come" di un collaboratore.
  - **Collaboratore**: vede, in sola lettura, solo i propri siti, i propri guadagni e i pagamenti ricevuti.

**Stack**: React, TypeScript, Vite, Tailwind CSS v4, Supabase (Auth, Postgres, Storage, RLS) e Vercel.

```
supabase/
  schema.sql                     tabelle, view, is_admin(), policy RLS, bucket Storage
  seed.sql                       i due progetti del portfolio e il collaboratore di prova "Diego"
  functions/crea-collaboratore/  Edge Function che crea gli account e invia l'invito
src/
  config.ts                      titolo e descrizione del sito
  index.css                      palette colori (variabili --color-brand-*)
  pages/public/                  Home, Portfolio, Dettaglio
  pages/auth/                    Login, Password dimenticata, Imposta password
  pages/area/                    Dashboard collaboratore, Profilo, pagine admin
```

---

## Guida passo passo

### 1. Crea il progetto Supabase
1. Vai su <https://supabase.com>, crea un account e poi un **New project**. Scegli la regione più vicina, per esempio Frankfurt.
2. Attendi che il progetto sia pronto.

### 2. Crea il database
1. In Supabase apri **SQL Editor → New query**.
2. Incolla tutto il contenuto di [`supabase/schema.sql`](supabase/schema.sql) e premi **Run**.
   Lo script crea tabelle, view, trigger, la funzione `is_admin()`, tutte le policy RLS e i bucket Storage `screenshots` e `avatars`. Si può rieseguire senza problemi.
3. Apri una nuova query, incolla [`supabase/seed.sql`](supabase/seed.sql) e premi **Run**. Inserisce i due progetti del portfolio: Café Sauvage e Barbiere (demo).

### 2b. Opportunità (attività con alta vendibilità)
Apri una nuova query, incolla [`supabase/opportunita.sql`](supabase/opportunita.sql) e premi **Run**.
L'admin gestisce le attività da **Area riservata → Opportunità** (link Google Maps + dettagli, modifica, nascondi, elimina) e vede l'esito di ogni collaboratore. I collaboratori le vedono in sola lettura e premono **Fatto** o **Non accettato** (premendo di nuovo lo stesso tasto l'esito si annulla).

### 2c. Soci e listino prezzi
Apri una nuova query, incolla [`supabase/soci.sql`](supabase/soci.sql) e premi **Run** (dopo `account.sql`, `vendite.sql` e `opportunita.sql`).
- **Admin** (tu): vede e gestisce tutto. **Socio** (es. Diego): stessa area, ma vede e gestisce solo il proprio team (collaboratori, progetti, vendite, pagamenti) e, dell'azienda, solo il fatturato totale. Non vede i tuoi guadagni né i tuoi collaboratori.
- Crea il socio da **Collaboratori → Nuovo account → Ruolo: Socio**. Un socio può aggiungere collaboratori solo sotto di sé; tu puoi sceglierne il team (il tuo o quello di un socio).
- **Prezzi**: il listino è pubblico su `/prezzi` e si modifica da **Area riservata → Prezzi** (admin e soci).

### 3. Configura l'autenticazione
In **Authentication → Sign In / Providers**:
- **Disattiva "Allow new users to sign up"**. Gli account li crea solo l'admin, e il database comunque assegna sempre il ruolo `collaboratore` ai nuovi utenti.
- Lascia attivo il provider **Email**.

In **Authentication → URL Configuration**:
- **Site URL**: l'indirizzo del sito, per esempio `https://tuodominio.it`. In locale usa `http://localhost:5173`.
- **Redirect URLs**: aggiungi `http://localhost:5173/**` e `https://tuodominio.it/**`. Se usi le anteprime Vercel, aggiungi anche `https://*.vercel.app/**`.

Facoltativo: in **Authentication → Emails** puoi tradurre in italiano i testi delle email di invito e di reset.

> Il servizio email integrato di Supabase ha limiti molto bassi, pochi invii all'ora. Per l'uso reale configura un SMTP tuo (Resend, Brevo e simili) in **Project Settings → Authentication → SMTP Settings**.

### 4. Imposta te stesso come primo admin
1. **Authentication → Users → Add user → Create new user**. Inserisci la tua email e una password e spunta **Auto Confirm User**.
2. In **SQL Editor** esegui, sostituendo la tua email:
   ```sql
   update public.profiles
      set ruolo = 'admin', nome = 'Il tuo nome'
    where email = 'tua@email.it';
   ```
Da questo momento puoi creare gli altri account direttamente dal sito.

### 5. Pubblica la Edge Function `crea-collaboratore`
Serve per creare gli account dal pannello admin. Usa la **service role key** solo lato server: questa chiave non finisce mai nel frontend.

Con la [Supabase CLI](https://supabase.com/docs/guides/cli):
```bash
npx supabase login
npx supabase link --project-ref <ID-PROGETTO>      # l'ID è nell'URL: https://<ID>.supabase.co
npx supabase functions deploy crea-collaboratore
```
Non devi impostare nessun secret: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sono già disponibili dentro le Edge Functions.

In alternativa, dalla dashboard: **Edge Functions → Deploy a new function → Via Editor**. Chiamala `crea-collaboratore` e incolla il contenuto di `supabase/functions/crea-collaboratore/index.ts`.

### 6. Crea il collaboratore di prova "Diego"
1. Avvia il sito (passo 7), accedi come admin e vai su **Collaboratori → Nuovo account**. Inserisci nome `Diego`, la sua email e 30 come % predefinita. Diego riceve un'email per scegliere la password.
   In alternativa crealo a mano in **Authentication → Users → Add user**.
2. Apri `supabase/seed.sql`, sostituisci `diego@example.com` con l'email di Diego e riesegui lo script. Diego viene assegnato ai due progetti, con il 30% e il 25%, e viene registrato un acconto di esempio di 200 €.

### 7. Avvia il sito in locale
```bash
cp .env.example .env.local
# inserisci in .env.local i valori presi da Project Settings → API:
#   VITE_SUPABASE_URL=https://<ID>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<chiave anon / publishable>
npm install
npm run dev           # http://localhost:5173
```
⚠️ Usa **solo** la chiave `anon` (publishable). La `service_role` non va mai messa nel file `.env` del frontend.

### 8. Deploy su Vercel
1. Carica il progetto su GitHub (è già un repository).
2. Su <https://vercel.com> scegli **Add New → Project** e importa il repository. Vercel riconosce Vite in automatico: build command `npm run build`, output `dist`.
3. In **Environment Variables** aggiungi `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Premi **Deploy**. Il file `vercel.json` è già incluso e fa funzionare le rotte della single page app, per esempio `/portfolio/...` e `/area/...`.
5. Collega il tuo dominio in **Settings → Domains** e aggiorna **Site URL** e **Redirect URLs** su Supabase (passo 3).

---

## Personalizzazione
- **Nome, slogan, email, telefono e WhatsApp**: `src/config.ts`. Aggiorna anche `<title>` e i meta tag in `index.html` e il testo di `public/og-image.svg`.
- **Colori**: le variabili `--color-brand-*` in `src/index.css`. Oggi sono impostate su indaco; per cambiarle basta sostituire la scala di colori.
- **Font**: Plus Jakarta Sans, caricato da Google Fonts in `index.html`.
- **Screenshot del portfolio**: caricali da **Admin → Progetti → (progetto) → Screenshot**. Senza screenshot il sito mostra un'anteprima grafica con il nome del progetto.

## Sicurezza: come sono applicati i permessi
I permessi sono garantiti **nel database** con le policy RLS, non solo nell'interfaccia:

| Tabella | Visitatore | Collaboratore | Admin |
|---|---|---|---|
| `progetti` | nessun accesso diretto; legge la view `portfolio`, che ha solo i campi pubblici dei progetti con `pubblico = true` e **non contiene prezzi** | legge solo i progetti a cui è assegnato | tutto |
| `assegnazioni`, `pagamenti` | — | legge solo le proprie righe | tutto |
| `profiles` | — | legge e modifica solo il proprio nome e la foto. Un trigger impedisce di cambiare `ruolo`, `percentuale_default`, `attivo` ed email | tutto |
| `richieste_contatto` | può solo inserire (con stato "nuova") | — | tutto |
| view `v_guadagni` | — | solo le proprie righe (`security_invoker`) | tutto |

Altri controlli nel database:
- Un trigger blocca le assegnazioni se la somma delle percentuali di un progetto supera il 100%.
- Un collaboratore **disattivato** non legge più nessun dato, anche se ha ancora una sessione aperta.
- Storage: gli screenshot possono essere caricati solo dall'admin. Gli avatar vanno in `avatars/<id utente>/` e ognuno può scrivere solo nella propria cartella.

> Nota: il PRD prevedeva "lettura pubblica di `progetti` se `pubblico = true`". Per non esporre i prezzi tramite l'API, i visitatori leggono invece la view `portfolio`, che contiene solo i campi pubblici.

## Script
| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo |
| `npm run build` | controllo dei tipi e build di produzione in `dist/` |
| `npm run preview` | anteprima della build |
