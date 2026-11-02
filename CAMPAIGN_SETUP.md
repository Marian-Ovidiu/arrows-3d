# Campagna, collezione e classifiche

La campagna e i record personali funzionano senza un server. La sincronizzazione v2 e le classifiche richiedono il progetto Supabase configurato in [ACCOUNT_SETUP.md](ACCOUNT_SETUP.md) e le due migrazioni in ordine:

1. `supabase/migrations/20261030163554_accounts.sql`
2. `supabase/migrations/20261101162235_fantasy_campaign_rankings.sql`

La migrazione `20261102090348_google_first_name.sql` aggiorna inoltre i nomi pubblici: soprannome scelto, altrimenti solo nome Google, infine pseudonimo. Non modifica i dati degli utenti. Su un progetto già configurato si applicano solo le migrazioni mancanti. Con un progetto collegato alla CLI:

```sh
supabase db push
```

In alternativa esegui il file completo nel SQL Editor come proprietario del database. La migrazione conserva la tabella dei progressi, la revisione atomica e il supporto ai salvataggi v1 dei client precedenti. Il nuovo client legge v1 e v2, migra il tutorial e salva v2. I tre livelli dimostrativi ritirati non diventano reperti della nuova campagna.

## Dati e privacy

Il catalogo autorevole e le classifiche risiedono nello schema `svela_private`, con RLS attiva e senza accesso diretto per `anon` o `authenticated`. Le RPC pubbliche controllano l'account e le scritture riguardano soltanto le righe del chiamante. La lettura delle classifiche espone soltanto i campi pubblici previsti. Le tabelle di risultati e tentativi vengono eliminate a cascata cancellando l'account.

- `submit_discovery`: verifica una sequenza completa contro posizioni, direzioni e nucleo del catalogo, poi registra una scoperta permanente per coppia account/livello.
- `start_timed_run`: richiede la scoperta verificata, registra l'ora del server e associa un tentativo alla sessione. Una nuova partenza sostituisce quella precedente dell'account.
- `finish_timed_run`: verifica proprietà, sessione, scadenza e sequenza completa, consuma il tentativo e conserva il miglior tempo.
- `get_leaderboard`: restituisce fino a 50 posizioni, con nome pubblico o pseudonimo, valore e indicazione della propria riga. Non espone email o dati di sessione.

Il salvataggio locale/cloud include `bestTimes`, ma questi valori non vengono usati come prove per la classifica online. I tempi online sono misurati dal server e comprendono la latenza di rete. Il protocollo respinge tempi inviati dal client, sequenze impossibili e riuso di un tentativo; non impedisce a un bot di calcolare e inviare una soluzione valida. Pause, aiuti e sospensioni vengono esclusi dal client ufficiale, non costituiscono un'attestazione del comportamento di client modificati.

Le soluzioni completate vengono conservate in `levels[key].solutionIds`, separatamente da `removedIds`, che descrive la partita corrente. Aprire o aggiornare le classifiche pubblica le prove disponibili: una scoperta offline resta registrabile anche dopo aver ricominciato il puzzle. I tempi offline restano record personali, senza essere promossi retroattivamente a tempi online.

## Verifica

```sh
npm test
npm run test:browser
```

`supabase/tests/accounts.sql` e `supabase/tests/campaign.sql` sono controlli SQL transazionali: eseguili dopo le migrazioni su un database di test come proprietario. I dati temporanei terminano con `ROLLBACK`.

Per i flussi account e classifiche del browser si usa una build isolata: tutte le richieste al backend fittizio sono intercettate, senza accesso Google o account reali.

```sh
VITE_SUPABASE_URL=https://svela-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test npm run build
SVELA_ACCOUNT_TEST=1 npx playwright test tests/browser/account-cloud.spec.ts tests/browser/rankings.spec.ts
npm run build
```

L'ultimo comando ripristina la build con la configurazione abituale. Il test browser standard include anche collezione, filtri, layout, persistenza, migrazione della demo, sblocco e invalidazione delle prove a tempo.

## Estendere il catalogo

Le chiavi dei livelli sono versionate e indipendenti dall'ordine del menu. Per aggiungere livelli:

1. Aggiungi griglie e metadati in `src/puzzle.ts`, con una nuova chiave stabile e un capitolo.
2. Verifica soluzione, numero di uscite iniziali e profondità delle dipendenze con i test del catalogo.
3. Aggiungi gli stessi dati al catalogo autorevole tramite una nuova migrazione. `node scripts/export-catalog.mjs --print` stampa i dati da revisionare, senza modificare file; `--check` confronta il catalogo e le soluzioni con le fixture pubblicate. Non modificare una migrazione già applicata.
4. Se cambi frecce o geometria di un livello pubblicato, assegna una nuova chiave/versione: i suoi record devono confrontare lo stesso puzzle.

Menu, filtri e selettori dei livelli derivano dal catalogo. I salvataggi accettano fino a 2 MB; il servizio limita ogni puzzle a 500 pezzi e le liste dei completamenti a 5.000 elementi. La stanza delle reliquie mostra tre serie iniziali; per cataloghi molto più grandi serviranno paginazione dei capitoli e un diverso budget di archiviazione, senza cambiare l'identità dei progressi esistenti.
