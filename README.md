# Svela — demo di un puzzle spaziale

Demo realizzata con TypeScript, Three.js e Vite, con progetto Android Capacitor 8. Un'introduzione giocabile di quattro cubi precede tre figure da smontare (26, 56 e 80 pezzi), ognuna con un piccolo oggetto al centro. Per compilare l'app Android senza aprire finestre, vedi [ANDROID.md](ANDROID.md).

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

Il menu iniziale presenta una scultura 3D animata e **Gioca / Continua**. La partita mostra solo figura, contatore, pausa e tre controlli a icona. Il percorso delle scoperte e le impostazioni sono schermate separate. Istruzioni contestuali visibili solo nel tutorial; i comandi completi restano disponibili nelle impostazioni. I suoni sintetizzati si attivano solo durante le azioni del giocatore e si possono disattivare. Il menu rispetta la preferenza di sistema per movimento ridotto e si sospende in background.

Il menu account permette accesso Google, modifica del nome, uscita, sincronizzazione e cancellazione definitiva dell’account con i progressi online. I salvataggi ospite e quelli di ogni account restano separati; l’importazione dei progressi ospite richiede una scelta esplicita. Le modifiche offline vengono conservate localmente. Se la partita cambia su due dispositivi, il giocatore sceglie quale conservare. Senza configurazione Supabase si continua a giocare come ospite. L’integrazione Google è destinata alla versione web/PWA; quella Android nativa richiede ancora il flusso OAuth dedicato.

## Primi passi

Dal menu iniziale, **Gioca** avvia un’introduzione con quattro cubi e una guida nella scena: trascinare per ruotare, toccare un cubo evidenziato, seguire un fascio libero e osservare un percorso bloccato. Rimuovendo l'ostacolo si apre il passaggio. Ogni indicazione segue un'azione reale; non ci sono avanzamenti a tempo. La guida si può saltare, riprendere dalla tappa **Primi passi** o ricominciare. Il bordo identifica il bersaglio senza affidarsi solo al colore. Da tastiera si può ruotare con le frecce, selezionare con N ed estrarre con Invio.

I salvataggi precedenti mantengono livelli e progressi: il tutorial è visualizzato per primo ma aggiunto all'indice 3, senza spostare gli indici esistenti. Chi ha già una partita può aprire **Primi passi** dal selettore.

Un tocco dura al massimo 500 ms e tollera piccoli movimenti (10 pixel CSS touch, 6 mouse). Superare la soglia resta un trascinamento anche tornando al punto iniziale. Pinch, sequenze con più dita, cancellazioni e rilasci fuori dalla scena non provocano estrazioni. Le soglie sono verificate in automazione e restano da valutare su telefoni reali.

## PWA

La build di produzione include manifest, icone normali/maskable/Apple e un service worker con precache delle risorse. Dopo il primo caricamento online completato, può riaprirsi e giocare offline. Gli aggiornamenti aspettano la chiusura delle pagine precedenti, senza sostituire la versione durante una partita.

Usa `npm run build` e `npm run preview` per provarla localmente. In sviluppo (`npm run dev`) il service worker è disattivato. La distribuzione richiede HTTPS (localhost è ammesso per sviluppo); un indirizzo LAN HTTP non equivale a una PWA installabile. **Installa Svela** compare quando il browser fornisce il prompt di installazione. Gli altri browser gestiscono l’installazione tramite il proprio menu. Non è stata eseguita un’installazione sul dispositivo dell’utente.

L’integrazione Capacitor non registra il service worker. `node scripts/pwa-assets.mjs` rigenera le icone.

## Struttura e regole

- `src/puzzle.ts`: livelli deterministici, collisioni e risolutore, indipendenti dal rendering.
- `src/main.ts`: scena, oggetti procedurali, animazioni, input e interfaccia.
- `src/tutorial.ts`: istruzioni e bersagli derivati da progressi, pezzi rimasti e selezione.
- `src/pointer-gesture.ts`: riconoscimento di tocco, trascinamento e multitouch.
- `src/style.css`: schermate iniziali, percorso delle scoperte, HUD e menu responsive.
- `src/sound.ts`: brevi suoni delle azioni e preferenza locale.
- `src/pwa.ts`, `public/manifest.webmanifest` e `vite.config.ts`: installazione e cache offline versionata.
- `src/save-state.ts` e `src/persistence.ts`: validazione e salvataggi versionati.
- `android/` e `capacitor.config.ts`: progetto nativo e configurazione.
- `tests/puzzle.test.ts`: integrità dei livelli, collisioni in tutte le direzioni, nucleo, soluzioni e 160 sequenze di estrazione diverse.

Ogni pezzo occupa una cella intera e si muove lungo uno dei sei versi cartesiani. Un ostacolo su qualsiasi punto del percorso infinito impedisce l'uscita. La cella centrale è riservata all'oggetto e rimane un ostacolo. Le figure vengono costruite assegnando le direzioni durante uno smontaggio deterministico: esiste sempre una sequenza completa. Togliere pezzi non introduce nuovi ostacoli.

La demo usa cubi arrotondati con frecce sulle quattro facce laterali e un segno sull'estremità di uscita. Si sfilano in linea retta. Il fascio mostra il corridoio e il punto di luce incontra la superficie visibile dell'ostacolo tramite raycasting. Include preferenza di sistema per movimento ridotto, controlli da tastiera e annunci di stato. È comunque un puzzle spaziale prevalentemente visivo, non una modalità equivalente per utenti non vedenti.

## Verifiche

I test unitari coprono livelli, salvataggi, gesti e sequenza del tutorial. I test browser headless coprono ripresa e annullamento dopo reload, stato indipendente dei livelli, risorse locali e layout mobile, completamento del primo livello, sospensione durante estrazione e dati corrotti. Il tutorial viene completato con input touch nel browser; si verificano anche trascinamento su un cubo selezionato, pinch, salto, ripresa e riavvio. Altri controlli coprono menu/pausa, preferenza audio, riapertura offline e continuazione dopo un livello completato. Screenshot desktop/mobile vengono prodotti senza finestre visibili; i test non modificano profili browser personali.

L'emulazione responsive e il browser headless non sostituiscono una prova dell'APK su Android: verifiche native dei plugin, fluidità, consumi e comportamento su hardware reale restano separate.
