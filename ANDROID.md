# Svela su Android

Il progetto Android è nella cartella `android/` e usa Capacitor 8. Il gioco Three.js e i font sono inclusi nel pacchetto: non richiede un server esterno, un account giocatore o una connessione per giocare. Il manifest mantiene il normale permesso INTERNET del template Capacitor per compatibilità con WebView; non richiede permessi runtime per fotocamera, contatti o altri dati del dispositivo. Il gioco non effettua richieste a servizi esterni.

## Comandi senza finestre

```sh
npm ci
npm test
npm run test:browser
npm run android:assets
npm run android:sync
npm run android:debug
```

`test:browser` usa sempre un browser headless, con un profilo temporaneo separato. Su macOS usa Chrome se installato; su altre macchine installa prima il Chromium di Playwright (`npx playwright install chromium`). Non apre il gioco sul desktop.

`android:debug` verifica l'ambiente, compila il web, sincronizza Capacitor e compila Android da terminale. Non apre Android Studio o emulatori e non installa nulla su telefoni collegati. Il primo build necessita di rete per scaricare Gradle e le dipendenze native.

Output APK: `android/app/build/outputs/apk/debug/app-debug.apk`. La firma è di sviluppo: utilizzalo per prove, non per la pubblicazione.

La prima build verificata è anche in `artifacts/android/svela-0.1.0-debug.apk`, con checksum e riepilogo delle verifiche nel file JSON accanto. Questa copia di consegna non si aggiorna automaticamente dopo nuove compilazioni: l'output canonico rimane quello dentro `android/app/build/outputs/`.

## Ambiente di compilazione

- Node.js 22.18+ (consigliato 24 o 26).
- JDK 21: `JAVA_HOME`, JDK di Android Studio, oppure una distribuzione dentro `.android-cache/java/`.
- Android SDK Platform 36, Build-Tools 36.0.0 e Platform-Tools.
- Licenze Android SDK accettate dal titolare.

Lo script cerca l'SDK tramite `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `.android-sdk/` nel progetto e i percorsi utente standard. Gradle conserva la cache dentro `.android-cache/gradle/`. SDK, JDK, cache e chiavi di firma sono esclusi dal versionamento. Lo script non accetta automaticamente licenze; per questa sessione l'utente ha autorizzato esplicitamente installazione e licenza SDK.

Il progetto è configurato con minSdk 24, compileSdk/targetSdk 36 e richiede OpenGL ES 3.0. La compatibilità effettiva dipende anche dal WebView aggiornato e dalle prestazioni grafiche del dispositivo.

## Comportamento mobile

- Salvataggio dopo estrazioni, annullamenti, cambi livello e sospensione. Ogni livello conserva il proprio stato; il pulsante Ricomincia azzera solo la partita del livello corrente.
- Salvataggi nativi con Capacitor Preferences e cache locale. Dati corrotti o sequenze non valide vengono riparati mantenendo il prefisso valido.
- In background il rendering si arresta; un'estrazione in corso viene completata e salvata. A figura ferma il ciclo grafico si ferma anche in primo piano.
- Indietro chiude prima un dialogo, poi deseleziona una freccia; altrimenti salva e minimizza l'app.
- Pulsanti touch più grandi, safe area per le barre di sistema, densità grafica e ombre ridotte sui dispositivi touch.
- Font e relative licenze sono inclusi. Nessuna pubblicità, acquisto o analisi remota.

## Pubblicazione futura

L'identificatore `com.svela.puzzle` è provvisorio e non ne è stata verificata la disponibilità come marchio. Scegli l'identificatore definitivo prima di caricare il gioco sullo store.

`npm run android:bundle` genera un AAB release **non firmato**. Prima di Google Play servono una configurazione di firma gestita dal proprietario, versionamento delle release, scheda e dichiarazioni dello store, test chiuso quando applicabile e verifiche di prestazioni su dispositivi Android reali. Non vengono create o caricate chiavi di pubblicazione automaticamente.

Le prove headless verificano il livello web e non equivalgono all'esecuzione di APK su Android: plugin nativi, navigazione di sistema, consumi e fluidità su hardware reale richiedono ancora una prova sul dispositivo.

## Esito della prima preparazione

L'APK archiviato appartiene alla prima preparazione. Le successive modifiche web (tutorial **Primi passi** e gestione dei gesti touch) richiedono una nuova esecuzione di `npm run android:debug` per essere incluse nell'APK.

JDK 21 e SDK 36 installati localmente con autorizzazione dell'utente. Build Android debug riuscita, firma APK v2 verificata e contenuto controllato: font, licenze, risorse web e plugin App/Preferences inclusi, nessun server remoto configurato. Superati 12 test unitari e 5 test headless. Nessuna finestra, emulatore visibile o installazione su dispositivo è stata avviata durante questa preparazione.
