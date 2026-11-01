# Svela — demo di un puzzle spaziale

Puzzle realizzato con TypeScript, Three.js e Vite, con progetto Android Capacitor 8. Un'introduzione giocabile di quattro cubi precede una campagna di **15 livelli curati**, da 8 a 64 pezzi. Ogni figura custodisce una reliquia fantastica da collezionare. Per compilare l'app Android senza aprire finestre, vedi [ANDROID.md](ANDROID.md).

## Avvio

Richiede Node.js 22.18+ (consigliato Node 24 o 26, anche per i test TypeScript nativi).

```sh
npm install
npm run dev
```

Apri http://localhost:5178. Il server espone anche un indirizzo di rete: per provare dal telefono, collega entrambi i dispositivi alla stessa rete e apri l'indirizzo Network stampato da Vite. Il computer e il server devono restare accesi.

```sh
npm test
npm run test:browser
npm run build
npm run preview
```

La cartella `dist` contiene la build statica. Il gioco da ospite funziona senza chiavi; accesso Google e progressi online usano Supabase. Configurazione in [ACCOUNT_SETUP.md](ACCOUNT_SETUP.md), variabili in [.env.example](.env.example). Font e risorse sono inclusi nella build e nell'app Android. Le licenze delle risorse sono in `public/licenses/`.

## Interazioni

- Trascina per ruotare; rotella o pinch per avvicinarti.
- Tocca un cubo per vedere un solo fascio lungo la direzione della freccia. La luce si ferma sulla superficie del primo ostacolo, oppure sfuma all'esterno.
- Tocca nuovamente lo stesso cubo per estrarlo. Puoi subito selezionare ed estrarre altri cubi mentre i precedenti volano via: la mossa e il salvataggio sono immediati. Anche Annulla funziona durante il volo. I pezzi bloccati tornano nella posizione iniziale senza interrompere gli altri comandi.
- Lampadina: seleziona e porta in vista una freccia libera.
- Cubo: ripristina la vista. Freccia curva: annulla l'ultima estrazione. Dal menu Pausa puoi ricominciare il livello.
- Con la scena a fuoco: frecce per orbitare, N per selezionare, Invio per estrarre, Esc per deselezionare o aprire la pausa, +/− per zoom.
- Il percorso **Le tue scoperte**, raggiungibile dal menu iniziale o dalla pausa, cambia livello mantenendo la partita di ciascuno. Completamento, pezzi rimossi, passi del tutorial e cronologia per annullare vengono salvati: localStorage sul web, Preferences native su Android. Ricomincia azzera soltanto la partita corrente.

Il menu iniziale presenta una scultura 3D animata e **Gioca / Continua**. La partita mostra figura, contatore, un breve obiettivo del livello, pausa e tre controlli a icona. Collezione e classifiche sono raggiungibili dal menu iniziale. Il percorso delle scoperte e le impostazioni sono schermate separate. Istruzioni contestuali visibili solo nel tutorial; i comandi completi restano disponibili nelle impostazioni. I suoni sintetizzati si attivano solo durante le azioni del giocatore e si possono disattivare. Il menu rispetta la preferenza di sistema per movimento ridotto e si sospende in background.

Il menu account permette accesso Google, modifica del nome, uscita, sincronizzazione e cancellazione definitiva dell’account con i progressi online. I salvataggi ospite e quelli di ogni account restano separati; l’importazione dei progressi ospite richiede una scelta esplicita. Le modifiche offline vengono conservate localmente. Se la partita cambia su due dispositivi, il giocatore sceglie quale conservare. Senza configurazione Supabase si continua a giocare come ospite. L’integrazione Google è destinata alla versione web/PWA; quella Android nativa richiede ancora il flusso OAuth dedicato.

## Campagna e reliquie

Tre capitoli da cinque livelli introducono lettura delle frecce, dipendenze tra pezzi e incastri su più lati:

- **Bosco dei sussurri**, 8–18 pezzi: seme, foglia, fungo lanterna, talismano e spirito.
- **Osservatorio perduto**, 24–36 pezzi: bussola, cristallo, luna, pianeta e astrolabio.
- **Archivio dei mondi**, 36–64 pezzi: chiave, clessidra, portale, stella e un piccolo mondo.

Il percorso consiglia un ordine; il selettore permette di esplorare liberamente. Il nucleo sigillato nasconde il reperto fino all'ultima estrazione. La rarità è prestabilita: 8 comuni, 4 insoliti, 2 rari (livelli 5 e 10) e 1 epico (livello 15).

La stanza delle reliquie mostra sagome per gli oggetti mancanti e sculture 3D ruotabili per quelli svelati, con nome, storia, rarità e record personale. Si può filtrare per rarità. Completare una serie aggiunge un piedistallo con miniature al visualizzatore. Ricominciare o annullare non toglie i reperti già ottenuti.

## Prove a tempo e classifiche

Dopo la prima scoperta di un livello si sblocca **Prova a tempo**, dalla collezione, dalla pausa e dalla vittoria. Il cronometro parte con **Inizia** e si ferma all'accettazione dell'ultima estrazione; le animazioni non allungano il record personale. Suggerimenti, annullamenti, pausa, cambio livello, perdita del fuoco o passaggio in background interrompono il tentativo. Si può continuare liberamente senza registrare un tempo. I record personali sono disponibili anche come ospite e offline.

Le classifiche online richiedono un account e la nuova migrazione SQL:

- **Esploratori**: numero di livelli distinti completati con soluzione verificata. I replay non aumentano il conteggio e i punteggi uguali condividono la posizione.
- **Tempi per livello**: migliore prova registrata dal server per quel puzzle. Partenza, durata, proprietà del tentativo e soluzione completa sono verificati sul server. I tentativi sono monouso, associati alla sessione e sostituiti dall'avvio di un altro.

Il tempo online comprende la comunicazione di partenza e arrivo al server e può differire dal cronometro personale. Queste verifiche respingono tempi arbitrari e sequenze illegali; non proteggono da bot che risolvono automaticamente il puzzle. I nomi pubblici sono quelli scelti nel profilo o pseudonimi; le classifiche non espongono email. Non ci sono partecipanti o punteggi simulati nell'app. Attivazione e test sono descritti in [CAMPAIGN_SETUP.md](CAMPAIGN_SETUP.md).

## Primi passi

Dal menu iniziale, **Gioca** avvia un’introduzione con quattro cubi e una guida nella scena: trascinare per ruotare, toccare un cubo evidenziato, seguire un fascio libero e osservare un percorso bloccato. Rimuovendo l'ostacolo si apre il passaggio. Ogni indicazione segue un'azione reale; non ci sono avanzamenti a tempo. La guida si può saltare, riprendere dalla tappa **Primi passi** o ricominciare. Il bordo identifica il bersaglio senza affidarsi solo al colore. Da tastiera si può ruotare con le frecce, selezionare con N ed estrarre con Invio.

Il salvataggio v2 usa chiavi stabili del catalogo, indipendenti dagli indici del menu. La migrazione dalla demo conserva tutorial, passi appresi e cronologia del tutorial; i tre puzzle dimostrativi ritirati non contano come scoperte della nuova campagna. La chiave di archiviazione rimane `svela-save-v1` per il passaggio automatico. Le soluzioni completate vengono conservate separatamente dai replay per poter registrare in seguito una scoperta fatta offline.

Un tocco dura al massimo 500 ms e tollera piccoli movimenti (10 pixel CSS touch, 6 mouse). Superare la soglia resta un trascinamento anche tornando al punto iniziale. Pinch, sequenze con più dita, cancellazioni e rilasci fuori dalla scena non provocano estrazioni. Le soglie sono verificate in automazione e restano da valutare su telefoni reali.

## PWA

La build di produzione include manifest, icone normali/maskable/Apple e un service worker con precache delle risorse. Dopo il primo caricamento online completato, può riaprirsi e giocare offline. Gli aggiornamenti aspettano la chiusura delle pagine precedenti, senza sostituire la versione durante una partita.

Usa `npm run build` e `npm run preview` per provarla localmente. In sviluppo (`npm run dev`) il service worker è disattivato. La distribuzione richiede HTTPS (localhost è ammesso per sviluppo); un indirizzo LAN HTTP non equivale a una PWA installabile. **Installa Svela** compare quando il browser fornisce il prompt di installazione. Gli altri browser gestiscono l’installazione tramite il proprio menu. Non è stata eseguita un’installazione sul dispositivo dell’utente.

L’integrazione Capacitor non registra il service worker. `node scripts/pwa-assets.mjs` rigenera le icone.

## Struttura e regole

- `src/puzzle.ts`: catalogo versionato di 15 livelli, metadati delle reliquie, collisioni e risolutore, indipendenti dal rendering.
- `src/relics.ts`: 15 sculture procedurali, contenute nella cella centrale.
- `src/metagame-ui.ts`: collezione, filtri, visualizzatore e classifiche.
- `src/time-trial.ts`: durata e validità delle prove senza interruzioni.
- `src/leaderboard.ts`: registrazione delle scoperte e prove online.
- `src/main.ts`: scena, oggetti procedurali, animazioni, input e interfaccia.
- `src/tutorial.ts`: istruzioni e bersagli derivati da progressi, pezzi rimasti e selezione.
- `src/pointer-gesture.ts`: riconoscimento di tocco, trascinamento e multitouch.
- `src/style.css`: schermate iniziali, percorso delle scoperte, HUD e menu responsive.
- `src/sound.ts`: brevi suoni delle azioni e preferenza locale.
- `src/pwa.ts`, `public/manifest.webmanifest` e `vite.config.ts`: installazione e cache offline versionata.
- `src/save-state.ts` e `src/persistence.ts`: validazione e salvataggi versionati.
- `android/` e `capacitor.config.ts`: progetto nativo e configurazione.
- `tests/puzzle.test.ts`: integrità dei livelli, collisioni in tutte le direzioni, nucleo, soluzioni e 640 ordini di estrazione alternativi.

Ogni pezzo occupa una cella intera e si muove lungo uno dei sei versi cartesiani. Un ostacolo su qualsiasi punto del percorso infinito impedisce l'uscita. La cella centrale è riservata all'oggetto e rimane un ostacolo. Le figure usano griglie e frecce fisse, verificate dal risolutore: esiste sempre una sequenza completa. Il catalogo si decodifica in tempo lineare senza cercare soluzioni durante il caricamento. Togliere pezzi non introduce nuovi ostacoli.

La demo usa cubi arrotondati con frecce sulle quattro facce laterali e un segno sull'estremità di uscita. Si sfilano in linea retta. Il fascio mostra il corridoio e il punto di luce incontra la superficie visibile dell'ostacolo tramite raycasting. Include preferenza di sistema per movimento ridotto, controlli da tastiera e annunci di stato. È comunque un puzzle spaziale prevalentemente visivo, non una modalità equivalente per utenti non vedenti.

## Verifiche

I test unitari coprono livelli, salvataggi, gesti e sequenza del tutorial. I test browser headless coprono ripresa e annullamento dopo reload, stato indipendente dei livelli, risorse locali e layout mobile, completamento del primo livello, sospensione durante estrazione e dati corrotti. Il tutorial viene completato con input touch nel browser; si verificano anche trascinamento su un cubo selezionato, pinch, salto, ripresa e riavvio. Altri controlli coprono menu/pausa, preferenza audio, riapertura offline e continuazione dopo un livello completato. Screenshot desktop/mobile vengono prodotti senza finestre visibili; i test non modificano profili browser personali.

L'emulazione responsive e il browser headless non sostituiscono una prova dell'APK su Android: verifiche native dei plugin, fluidità, consumi e comportamento su hardware reale restano separate.
