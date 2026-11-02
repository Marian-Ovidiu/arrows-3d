# Campagna, collezione e classifiche

La campagna e i record personali funzionano senza un server. La sincronizzazione v2 e le classifiche richiedono il progetto Supabase configurato in [ACCOUNT_SETUP.md](ACCOUNT_SETUP.md) e le migrazioni in ordine:

1. `supabase/migrations/20261030163554_accounts.sql`
2. `supabase/migrations/20261101162235_fantasy_campaign_rankings.sql`
3. `supabase/migrations/20261102090348_google_first_name.sql`
4. `supabase/migrations/20261102102822_campaign_fifty_levels.sql`
5. `supabase/migrations/20261102115114_unified_campaign_progress.sql`

La migrazione `20261102090348_google_first_name.sql` aggiorna inoltre i nomi pubblici: soprannome scelto, altrimenti solo nome Google, infine pseudonimo. Non modifica i dati degli utenti. Su un progetto già configurato si applicano solo le migrazioni mancanti. Con un progetto collegato alla CLI:

```sh
supabase db push
```

In alternativa esegui il file completo nel SQL Editor come proprietario del database. La migrazione conserva la tabella dei progressi, la revisione atomica e il supporto ai salvataggi v1 dei client precedenti. Il nuovo client legge v1 e v2, migra il tutorial e salva v2. I tre livelli dimostrativi ritirati non diventano reperti della nuova campagna.

## Dati e privacy

Il catalogo autorevole e le classifiche risiedono nello schema `svela_private`, con RLS attiva e senza accesso diretto per `anon` o `authenticated`. Le RPC pubbliche controllano l'account e le scritture riguardano soltanto le righe del chiamante. La lettura delle classifiche espone soltanto i campi pubblici previsti. Le tabelle di risultati e tentativi vengono eliminate a cascata cancellando l'account.

- `submit_discovery`: verifica una sequenza completa contro posizioni, direzioni e nucleo del catalogo, poi registra una scoperta permanente per coppia account/livello.
- `start_timed_run`: ammette qualunque livello di campagna valido già alla prima partita, registra l’ora del server e associa un tentativo alla sessione. Una nuova partenza sostituisce quella precedente dell'account.
- `finish_timed_run`: verifica proprietà, sessione, scadenza e sequenza completa, consuma il tentativo, registra anche la scoperta e conserva il miglior tempo.
- `get_leaderboard`: restituisce fino a 50 posizioni, con nome pubblico o pseudonimo, valore e indicazione della propria riga. Non espone email o dati di sessione.

Il salvataggio locale/cloud include `bestTimes`, ma questi valori non vengono usati come prove per la classifica online. I tempi online sono misurati dal server e comprendono la latenza di rete. Il protocollo respinge tempi inviati dal client, sequenze impossibili e riuso di un tentativo; non impedisce a un bot di calcolare e inviare una soluzione valida. Gli aiuti e gli annullamenti sono ammessi anche per il tempo online. Pause e sospensioni escludono il solo tentativo online nel client ufficiale; non costituiscono un’attestazione del comportamento di client modificati. Tempo attivo personale e qualità restano indipendenti dal record misurato sul server.

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

L'ultimo comando ripristina la build con la configurazione abituale. Il test browser standard include anche collezione, filtri, layout, persistenza, migrazione della demo, tempo automatico, attesa degli aiuti, qualità ottenute e compatibilità dei progressi.

## Estendere il catalogo

Le chiavi dei livelli sono versionate e indipendenti dall'ordine del menu. Per aggiungere livelli:

1. Aggiungi griglie e metadati in `src/puzzle.ts`, con una nuova chiave stabile e un capitolo.
2. Verifica soluzione, numero di uscite iniziali e profondità delle dipendenze con i test del catalogo.
3. Aggiungi gli stessi dati al catalogo autorevole tramite una nuova migrazione. `node scripts/export-catalog.mjs --print` stampa i dati da revisionare, senza modificare file; `--check` confronta il catalogo cumulativo di tutte le migrazioni e le soluzioni con le fixture pubblicate; `--fixtures` stampa le prove SQL aggiornate. L’esportazione rifiuta modifiche o rimozioni delle identità già pubblicate. Non modificare una migrazione già applicata.
4. Se cambi frecce o geometria di un livello pubblicato, assegna una nuova chiave/versione: i suoi record devono confrontare lo stesso puzzle.

Menu, filtri e selettori dei livelli derivano dal catalogo. I salvataggi accettano fino a 2 MB; il servizio limita ogni puzzle a 500 pezzi e le liste dei completamenti a 5.000 elementi. La stanza delle reliquie mostra dieci serie da cinque reperti; per cataloghi molto più grandi serviranno paginazione dei capitoli e un diverso budget di archiviazione, senza cambiare l'identità dei progressi esistenti.

## Distribuzione della campagna da 50 livelli

Applicare la quarta migrazione prima di distribuire il nuovo frontend. Aggiunge solo i 35 puzzle nuovi: geometrie, chiavi e record dei primi 15 e del tutorial restano invariati. Il formato di salvataggio rimane v2 e non richiede conversioni dei progressi esistenti.

La RPC `save_game_progress` accetta inoltre `p_catalog_version`, inviato dal client attuale. Se un salvataggio contiene progressi dei nuovi capitoli, un client precedente non può sovrascriverlo eliminandoli. Gli errori di revisione continuano a restituire il conflitto normale; una scelta esplicita del client aggiornato può ancora sostituire il proprio salvataggio. I client precedenti possono continuare a salvare finché l’account non contiene riferimenti ai nuovi livelli.

Verifiche aggiuntive: `node scripts/export-catalog.mjs --check`, `supabase/tests/expansion.sql` e `tests/browser/expansion.spec.ts`. I test SQL vanno eseguiti dopo tutte le migrazioni, su un database di test; terminano con `ROLLBACK`.

## Tempo e qualità nella partita ordinaria

Applicare la quinta migrazione prima di distribuire il frontend aggiornato. Il formato resta v2 con sei campi principali; ogni `levels[key]` può ora includere `rarity` e `attempt` (`elapsedMs`, `hintsUsed`, `hintWaitMs`, `eligible`, `finished`). Le quantità vengono validate e il server conserva lo stesso confronto atomico di revisione. I campi locali non costituiscono prove per classifiche o scoperte verificate.

Il client invia `p_progress_version: 3` a `save_game_progress`. Dopo il primo salvataggio dei nuovi campi, i client precedenti non possono eliminarli sovrascrivendo i progressi; un client aggiornato conserva la possibilità di sostituire esplicitamente il proprio salvataggio in caso di conflitto. Le identità dei 50 puzzle non cambiano.

Eseguire anche `supabase/tests/unified-progress.sql` dopo le migrazioni e `tests/browser/unified-play.spec.ts` nella suite browser. Il primo verifica forma, limiti, compatibilità, CAS e primo risultato online; il secondo verifica pause, reload, aiuti e qualità permanente.
