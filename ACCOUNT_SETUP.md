# Account Google e progressi con Supabase

Database configurato sul progetto Supabase **arrows-3d** (`gkocwhaxvxpbvmiulsso`), migrazione remota `20261030163554_accounts`. Test SQL eseguiti e passati sul progetto, con fixture annullate tramite ROLLBACK.

La versione web/PWA supporta accesso Google, nome modificabile, sincronizzazione, uscita e cancellazione definitiva dell’account. Senza configurazione si gioca come ospite. URL e publishable key sono configurati in `.env.local` e nelle variabili Vercel di produzione e sviluppo. Le preview restano separate. Il provider Google è abilitato e il redeploy Vercel di produzione è completato. Site URL e redirect verso https://arrows-3d.vercel.app/ verificati il 30 ottobre 2026 con un nuovo flusso OAuth e ritorno di annullamento. Il login completo con un account Google personale va provato dal giocatore.

## 1. Crea il progetto Supabase

**Già eseguito sul progetto arrows-3d. Non rieseguire la migrazione su quel database.** Le istruzioni seguenti servono per un eventuale nuovo progetto.

Nel pannello Supabase crea un progetto e apri **SQL Editor**. Esegui il file `supabase/migrations/20261030163554_accounts.sql`. Con Supabase CLI puoi usare `supabase db push` dopo aver collegato il progetto.

La migrazione crea `game_progress`, protetta da Row Level Security: ciascun utente legge soltanto il proprio salvataggio. Le scritture passano dalla funzione `save_game_progress`, che confronta la revisione e segnala un conflitto invece di sovrascrivere una partita più recente. `delete_own_account()` cancella l’utente autenticato e i suoi progressi, usando l’identità del token e senza accettare ID dal browser. Le funzioni vanno create come proprietario del database, come avviene nel SQL Editor del progetto.

## 2. Configura Google

In Google Cloud crea un client OAuth di tipo **Applicazione web** e configura la schermata di consenso. Nel client Google aggiungi come URI di reindirizzamento autorizzato l’URL callback mostrato da Supabase per Google, normalmente:

```text
https://TUO-PROJECT-REF.supabase.co/auth/v1/callback
```

In Supabase apri **Authentication → Sign In / Providers → Google**, abilita Google e inserisci Client ID e Client Secret del client OAuth. Il secret Google resta nel pannello Supabase. Se la configurazione Google è in modalità test, aggiungi gli indirizzi dei tuoi amici fra gli utenti di test della schermata di consenso.

In **Authentication → URL Configuration** imposta come Site URL l’URL pubblico HTTPS del gioco. Aggiungi fra le Redirect URLs l’URL esatto del gioco e, per lo sviluppo:

```text
http://localhost:5178/
```

Se pubblichi in una sottocartella, autorizza anche quel percorso completo. Il gioco torna alla pagina dalla quale è stato avviato il login: eventuali parametri dell’app devono essere compatibili con la lista delle Redirect URLs.

## 3. Aggiungi le due variabili pubbliche

Copia `.env.example` in `.env.local` e compila:

```dotenv
VITE_SUPABASE_URL=https://TUO-PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Trovi URL e publishable key nel pannello del progetto Supabase. È supportata anche la vecchia chiave `anon`, con il nome `VITE_SUPABASE_ANON_KEY` se necessario.

Le variabili `VITE_` sono incluse nel JavaScript pubblico: usa esclusivamente la publishable key o la chiave anon. **Non inserire service_role, secret key o Google Client Secret nel progetto frontend.** I file `.env` locali sono ignorati da Git. Riavvia il server di sviluppo dopo averli modificati.

```sh
npm run dev
```

## 4. Pubblica la PWA

Imposta le stesse due variabili nel servizio che compila il sito, quindi esegui:

```sh
npm install
npm run build
```

Pubblica la cartella `dist` su un hosting statico HTTPS. Le variabili vengono lette durante la compilazione: cambiare una chiave richiede una nuova build. SQL, documentazione e `.env` restano fuori da `dist`. La configurazione Google/Supabase deve autorizzare il dominio finale. La versione web resta giocabile offline dopo il primo caricamento; accesso e cancellazione richiedono una connessione.

## Comportamento degli account

- Il salvataggio ospite resta separato da ogni account; accedere non lo importa automaticamente. Il menu account offre un’importazione esplicita con conferma, che sostituisce la partita dell’account.
- I progressi di un account sono conservati anche sul dispositivo e sincronizzati online. Dopo modifiche offline, una revisione online diversa richiede di scegliere quale partita conservare. Annullamento e ricomincia sono conservati come modifiche reali.
- Uscire torna alla partita ospite. La cache dell’account resta separata per poter recuperare eventuali modifiche offline al prossimo accesso.
- **Elimina account** richiede di scrivere `ELIMINA`. La conferma del server precede la pulizia della cache e della sessione locale. Un errore non viene presentato come cancellazione riuscita. La cancellazione riguarda account Svela e progressi online, senza eliminare l’account Google personale.
- La cancellazione dell’utente elimina i dati collegati da chiavi esterne con `ON DELETE CASCADE`. Nuove tabelle o file introdotti in futuro dovranno essere inclusi nella gestione della cancellazione.

L’accesso Google è disponibile anche su Android tramite browser di sistema (Custom Tabs), PKCE e ritorno esatto `com.svela.puzzle://auth/callback`. Questo indirizzo deve comparire in **Authentication → URL Configuration → Redirect URLs**, insieme agli URL web esistenti. Il callback Google nel client OAuth resta quello HTTPS di Supabase: non va sostituito con lo schema Android.

Il redirect Android è stato aggiunto dal proprietario e verificato il 3 novembre 2026 con un flusso OAuth annullato: il ritorno arriva all’app. `node scripts/android-auth-check.mjs` ripete questo controllo senza accedere a un account Google. La prova con Google personale richiede il telefono.

Su Android sessione, verificatore PKCE e salvataggi sono conservati in Preferences private dell’app, con cache WebView e scritture ordinate. I vecchi progressi ospite restano separati dagli account; il backup automatico Android è disabilitato per evitare il ripristino delle credenziali su un altro dispositivo. Il login viene richiesto prima di giocare quando il servizio è configurato e raggiungibile; offline resta disponibile il ripiego previsto dalla PWA.

## Verifiche

```sh
npm test
npm run test:browser
```

La suite normale verifica anche la modalità senza chiavi. Il test account con sessione simulata si esegue separatamente, senza contattare Google o un progetto reale:

```sh
VITE_SUPABASE_URL=https://svela-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test npm run build
SVELA_ACCOUNT_TEST=1 npx playwright test account-cloud.spec.ts
npm run build
```

`supabase/tests/accounts.sql` contiene verifiche SQL transazionali per isolamento tra utenti, scritture vietate, revisioni, validazione e cancellazione. Eseguilo come proprietario del database su un progetto di test dopo la migrazione; termina con ROLLBACK. Le prove automatiche con risposte simulate non sostituiscono una prova reale di accesso Google sul dominio finale, da completare dopo l’inserimento delle credenziali.

Verificato localmente: build, 41 test di logica, 17 test browser del gioco e un test browser account con API simulate. I test SQL sono stati eseguiti e superati il 30 ottobre 2026 sul progetto Supabase collegato; nessun utente o salvataggio di prova è rimasto nel database.

Riferimenti ufficiali: [Google con Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [dati utente](https://supabase.com/docs/guides/auth/managing-user-data).

## Controlli del database collegato

Verificati sul database reale: isolamento RLS fra due utenti, accesso del proprietario, CAS e rifiuto revisioni obsolete, validazione dei dati, scritture dirette vietate, RPC vietate agli anonimi, cancellazione e blocco dei token di utenti eliminati. Le richieste HTTP senza sessione a tabella e cancellazione rispondono 401. Advisor performance senza segnalazioni.

L’advisor sicurezza segnala intenzionalmente due funzioni SECURITY DEFINER accessibili agli autenticati: `save_game_progress` e `delete_own_account`. Sono gli endpoint previsti dal gioco; non accettano ID utente, ricavano il proprietario da `auth.uid()`, impostano un search_path vuoto e negano EXECUTE a PUBLIC/anon. I test confermano l’isolamento. Il privilegio è necessario per applicare il CAS senza concedere scritture dirette e per cancellare il solo utente autenticato. [Spiegazione del controllo Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
