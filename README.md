# Svela — demo di un puzzle spaziale

Puzzle realizzato con TypeScript, Three.js e Vite, con progetto Android Capacitor 8. Un'introduzione giocabile di quattro cubi precede una campagna di **50 livelli curati**, da 8 a 64 pezzi. Ogni figura custodisce una reliquia fantastica da collezionare. Per compilare l'app Android senza aprire finestre, vedi [ANDROID.md](ANDROID.md).

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

Dieci capitoli da cinque livelli introducono lettura delle frecce, dipendenze tra pezzi e incastri su più lati. I primi tre mantengono i puzzle originali:

- **Bosco dei sussurri**, 8–18 pezzi: seme, foglia, fungo lanterna, talismano e spirito.
- **Osservatorio perduto**, 24–36 pezzi: bussola, cristallo, luna, pianeta e astrolabio.
- **Archivio dei mondi**, 36–64 pezzi: chiave, clessidra, portale, stella e un piccolo mondo.

Sette nuovi capitoli proseguono il viaggio con figure fisse da 36 a 59 pezzi e pause fra le sfide:

- **Giardini sospesi** (16–20): forme aperte, petali, ponti e cavità.
- **Fucina degli echi** (21–25): rami e incroci fra le catene.
- **Cittadella degli specchi** (26–30): cornici, simmetrie e torri.
- **Abissi di cristallo** (31–35): coppe, gusci e strutture in profondità.
- **Labirinto delle maree** (36–40): corridoi e allineamenti a distanza.
- **Santuario dei venti** (41–45): strutture sottili e lunghe catene.
- **Cuore dei mondi** (46–50): sintesi delle direzioni e finale della campagna.

Il percorso consiglia un ordine; il selettore permette di esplorare liberamente. Il nucleo sigillato nasconde il reperto fino all'ultima estrazione. La qualità della reliquia dipende dal tempo attivo della partita: comune, insolita, rara o epica. Ogni livello ha soglie proprie. La collezione conserva sempre la qualità migliore raggiunta; le scoperte dei vecchi salvataggi mantengono almeno la loro rarità precedente.

La stanza delle reliquie mostra sagome per gli oggetti mancanti e sculture 3D ruotabili per quelli svelati, con nome, storia, rarità e record personale. Si può filtrare per rarità. Completare una serie aggiunge un piedistallo con miniature al visualizzatore. Ricominciare o annullare non toglie i reperti già ottenuti.

Ogni capitolo ha un'atmosfera dedicata e due scenografie diverse modellate in Blender: tronco con funghi e pietra del sentiero nel Bosco; arco spezzato e sfera armillare nell'Osservatorio; portale e antichi volumi sospesi nell'Archivio. Restano ai margini e sono disegnate prima del puzzle, in una scena separata: non coprono i pezzi e non entrano nel raycasting o nelle collisioni. Non aggiungono animazioni continue o ombre. Alla scoperta del reperto diventano più tenui; tutorial, menu e collezione mantengono il proprio sfondo.

I capitoli 4–10 usano scenografie procedurali dedicate e aggregate in poche mesh: giardini e lanterne, forgia, torri e specchi, coralli, maree, strumenti del vento e santuario finale. Non richiedono modelli da scaricare e funzionano offline.

I tre GLB locali pesano complessivamente 625.708 byte e non dipendono da texture o servizi esterni. Ogni capitolo usa 6–13 primitive e meno di 8.000 vertici. Il modello viene caricato al primo ingresso e riutilizzato; durante il caricamento o in caso di errore resta disponibile la decorazione procedurale. Il precache PWA comprende tutti i modelli per l'uso offline. Sorgente Blender, anteprima, script riproducibile e metriche sono descritti in [art/environments/README.md](art/environments/README.md).

## Tempo discreto, reliquie evolutive e classifiche

Ogni partita di campagna misura automaticamente il tempo appena il puzzle è giocabile, senza pulsante di partenza e senza cronometro durante il gioco. Il tempo si ferma all’accettazione dell’ultima estrazione; il risultato compare insieme alla reliquia. Pause, istruzioni, finestre modali, cambio schermata, perdita del fuoco e background sospendono il tempo locale. La partita riprende con lo stesso tempo anche dopo un reload. La qualità dipende dalle soglie specifiche del livello in `src/progression.ts`, consultabili dopo la scoperta nel dettaglio della reliquia. Le soglie iniziali sono una taratura di progetto da validare con giocatori, non statistiche osservate.

Completare il livello assegna sempre la reliquia. **Rigioca** avvia una nuova partita che può migliorarne qualità e tempo personale, senza abbassare una qualità già ottenuta. Materiali e ornamenti cambiano con la qualità. Le partite parziali provenienti dai vecchi salvataggi possono ancora essere completate, ma non ricevono un tempo inventato: per un nuovo record occorre ricominciare.

Gli aiuti e gli annullamenti sono ammessi. Dopo ciascuna lampadina occorre attendere 5, 10, 15, 20, 25 e poi al massimo 30 secondi prima di riutilizzarla. L’attesa trascorre solo mentre si gioca e viene salvata con il numero di aiuti; pausa e riapertura non la azzerano. Il tutorial resta guidato senza questo intervallo.

Le classifiche online richiedono un account e tutte le migrazioni SQL:

- **Scoperte**: numero di livelli distinti completati con soluzione verificata. I replay non aumentano il conteggio e i punteggi uguali condividono la posizione.
- **Tempi per livello**: ogni nuova partita online può registrare un tempo già alla prima scoperta. Gli aiuti e gli annullamenti sono ammessi; per il tempo online la partita deve essere continua nella stessa sessione. Pausa, uscita, reload, perdita del fuoco o background escludono quel tempo online, ma conservano tempo personale e qualità locale. Partenza, durata, proprietà del tentativo e soluzione completa vengono verificati sul server.

Il tempo online comprende la comunicazione di partenza e arrivo al server e può differire dal tempo attivo personale. I record e le qualità locali non attestano un tempo nella classifica online. Le verifiche respingono tempi arbitrari e sequenze illegali; non proteggono da bot che risolvono automaticamente il puzzle. Il nome pubblico è modificabile dal menu account. Non ci sono partecipanti o punteggi simulati nell’app; le classifiche non espongono email. Attivazione e test sono descritti in [CAMPAIGN_SETUP.md](CAMPAIGN_SETUP.md).

## Primi passi

Dal menu iniziale, **Gioca** avvia un’introduzione con quattro cubi e una guida nella scena: trascinare per ruotare, toccare un cubo evidenziato, seguire un fascio libero e osservare un percorso bloccato. Rimuovendo l'ostacolo si apre il passaggio. Ogni indicazione segue un'azione reale; non ci sono avanzamenti a tempo. La guida si può saltare, riprendere dalla tappa **Primi passi** o ricominciare. Il bordo identifica il bersaglio senza affidarsi solo al colore. Da tastiera si può ruotare con le frecce, selezionare con N ed estrarre con Invio.

Il salvataggio v2 usa chiavi stabili del catalogo, indipendenti dagli indici del menu. La migrazione dalla demo conserva tutorial, passi appresi e cronologia del tutorial; i tre puzzle dimostrativi ritirati non contano come scoperte della nuova campagna. La chiave di archiviazione rimane `svela-save-v1` per il passaggio automatico. Le soluzioni completate vengono conservate separatamente dai replay per poter registrare in seguito una scoperta fatta offline.

Un tocco dura al massimo 500 ms e tollera piccoli movimenti (10 pixel CSS touch, 6 mouse). Superare la soglia resta un trascinamento anche tornando al punto iniziale. Pinch, sequenze con più dita, cancellazioni e rilasci fuori dalla scena non provocano estrazioni. Le soglie sono verificate in automazione e restano da valutare su telefoni reali.

## PWA

La build di produzione include manifest, icone normali/maskable/Apple e un service worker con precache delle risorse. Dopo il primo caricamento online completato, può riaprirsi e giocare offline. Gli aggiornamenti aspettano la chiusura delle pagine precedenti, senza sostituire la versione durante una partita.

Usa `npm run build` e `npm run preview` per provarla localmente. In sviluppo (`npm run dev`) il service worker è disattivato. La distribuzione richiede HTTPS (localhost è ammesso per sviluppo); un indirizzo LAN HTTP non equivale a una PWA installabile. **Installa Svela** compare quando il browser fornisce il prompt di installazione. Gli altri browser gestiscono l’installazione tramite il proprio menu. Non è stata eseguita un’installazione sul dispositivo dell’utente.

L’integrazione Capacitor non registra il service worker. `node scripts/pwa-assets.mjs` rigenera le icone.

## Struttura e regole

- `scripts/author-campaign.mjs`: authoring offline riproducibile dei 35 nuovi diagrammi; non viene incluso nel gioco.
- `src/puzzle.ts`: catalogo versionato di 50 livelli, metadati delle reliquie, collisioni e risolutore, indipendenti dal rendering.
- `src/relics.ts`: 50 sculture procedurali, contenute nella cella centrale.
- `src/chapter-environment.ts`: decorazioni di capitolo e disposizione ai margini indipendente dalla camera orbitale.
- `src/chapter-assets.ts`: caricamento dei GLB, istanze con materiali indipendenti e normalizzazione nello spazio protetto.
- `src/metagame-ui.ts`: collezione, filtri, visualizzatore e classifiche.
- `src/time-trial.ts`: tempo attivo e attesa degli aiuti, entrambi ripristinabili.
- `src/progression.ts`: soglie per livello e qualità permanente delle reliquie.
- `src/leaderboard.ts`: registrazione delle scoperte e prove online.
- `src/main.ts`: scena, oggetti procedurali, animazioni, input e interfaccia.
- `src/tutorial.ts`: istruzioni e bersagli derivati da progressi, pezzi rimasti e selezione.
- `src/pointer-gesture.ts`: riconoscimento di tocco, trascinamento e multitouch.
- `src/style.css`: schermate iniziali, percorso delle scoperte, HUD e menu responsive.
- `src/sound.ts`: brevi suoni delle azioni e preferenza locale.
- `src/pwa.ts`, `public/manifest.webmanifest` e `vite.config.ts`: installazione e cache offline versionata.
- `src/save-state.ts` e `src/persistence.ts`: validazione e salvataggi versionati.
- `android/` e `capacitor.config.ts`: progetto nativo e configurazione.
- `tests/puzzle.test.ts`: integrità dei livelli, collisioni in tutte le direzioni, nucleo, soluzioni e 2.040 ordini di estrazione alternativi.

Ogni pezzo occupa una cella intera e si muove lungo uno dei sei versi cartesiani. Un ostacolo su qualsiasi punto del percorso infinito impedisce l'uscita. La cella centrale è riservata all'oggetto e rimane un ostacolo. Le figure usano griglie e frecce fisse, verificate dal risolutore: esiste sempre una sequenza completa. Il catalogo si decodifica in tempo lineare senza cercare soluzioni durante il caricamento. Togliere pezzi non introduce nuovi ostacoli.

La demo usa cubi arrotondati con frecce sulle quattro facce laterali e un segno sull'estremità di uscita. Si sfilano in linea retta. Il fascio mostra il corridoio e il punto di luce incontra la superficie visibile dell'ostacolo tramite raycasting. Include preferenza di sistema per movimento ridotto, controlli da tastiera e annunci di stato. È comunque un puzzle spaziale prevalentemente visivo, non una modalità equivalente per utenti non vedenti.

## Verifiche

I test unitari coprono livelli, salvataggi, gesti e sequenza del tutorial. I test browser headless coprono ripresa e annullamento dopo reload, stato indipendente dei livelli, risorse locali e layout mobile, completamento del primo livello, sospensione durante estrazione e dati corrotti. Il tutorial viene completato con input touch nel browser; si verificano anche trascinamento su un cubo selezionato, pinch, salto, ripresa e riavvio. Altri controlli coprono menu/pausa, preferenza audio, riapertura offline e continuazione dopo un livello completato. Screenshot desktop/mobile vengono prodotti senza finestre visibili; i test non modificano profili browser personali.

L'emulazione responsive e il browser headless non sostituiscono una prova dell'APK su Android: verifiche native dei plugin, fluidità, consumi e comportamento su hardware reale restano separate.
