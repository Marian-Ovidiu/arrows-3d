# Account Google e progressi con Supabase

La versione web/PWA supporta accesso Google, nome modificabile, sincronizzazione, uscita e cancellazione definitiva dell’account. Senza configurazione si gioca come ospite. Non sono state inserite credenziali né pubblicato il progetto.

## 1. Crea il progetto Supabase

Nel pannello Supabase crea un progetto e apri **SQL Editor**. Esegui il file `supabase/migrations/202610300001_accounts.sql`. Con Supabase CLI puoi usare `supabase db push` dopo aver collegato il progetto.

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

L’accesso Google è predisposto per browser/PWA. Nel contenitore Android nativo è disabilitato: servirà un flusso OAuth con browser di sistema e deep link prima di distribuire quella versione.

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

Verificato localmente: build, 41 test di logica, 17 test browser del gioco e un test browser account con API simulate. I test SQL non sono stati eseguiti: l’avvio del PostgreSQL temporaneo è stato bloccato dai permessi della sandbox. Nessun database reale è stato modificato.

Riferimenti ufficiali: [Google con Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [dati utente](https://supabase.com/docs/guides/auth/managing-user-data).
