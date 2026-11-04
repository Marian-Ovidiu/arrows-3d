# Svela su Android

Il progetto Android è nella cartella `android/` e usa Capacitor 8. Il gioco Three.js, i 50 livelli, le ambientazioni e i font sono inclusi nel pacchetto. Account Google, progressi cloud e classifiche usano lo stesso servizio Supabase della PWA. Il login è richiesto prima di giocare quando configurato e raggiungibile; senza connessione resta il ripiego offline della PWA. Android non mostra richieste di installare la PWA e non registra il suo service worker. Non sono richiesti permessi runtime per fotocamera o contatti.

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

La copia di consegna aggiornata è `artifacts/android/svela-0.2.0-debug.apk`, con checksum e riepilogo delle verifiche nel file JSON accanto. La precedente `0.1.0` resta archiviata. Le copie di consegna non si aggiornano automaticamente: l’output canonico rimane quello dentro `android/app/build/outputs/`. La compilazione usa al massimo due worker Gradle.

## Ambiente di compilazione

- Node.js 22.18+ (consigliato 24 o 26).
- JDK 21: `JAVA_HOME`, JDK di Android Studio, oppure una distribuzione dentro `.android-cache/java/`.
- Android SDK Platform 36, Build-Tools 36.0.0 e Platform-Tools.
- Licenze Android SDK accettate dal titolare.

Lo script cerca l'SDK tramite `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `.android-sdk/` nel progetto e i percorsi utente standard. Gradle conserva la cache dentro `.android-cache/gradle/`. SDK, JDK, cache e chiavi di firma sono esclusi dal versionamento. Lo script non accetta automaticamente licenze; per questa sessione l'utente ha autorizzato esplicitamente installazione e licenza SDK.

Il progetto è configurato con minSdk 24, compileSdk/targetSdk 36 e richiede OpenGL ES 3.0. La compatibilità effettiva dipende anche dal WebView aggiornato e dalle prestazioni grafiche del dispositivo.

## Comportamento mobile

- Salvataggio dopo estrazioni, annullamenti, cambi livello e sospensione. Ogni livello conserva il proprio stato; il pulsante Ricomincia azzera solo la partita del livello corrente.
- Salvataggi nativi con Capacitor Preferences e cache locale, separati fra ospite e ciascun account. La migrazione conserva i vecchi progressi; entrare in un account non li importa senza una scelta esplicita. Dati corrotti o sequenze non valide vengono riparati mantenendo il prefisso valido.
- Login Google nel browser di sistema con PKCE, ritorno all’app anche dopo una chiusura del processo, sincronizzazione e gestione dei conflitti come nella PWA. Redirect richiesto: `com.svela.puzzle://auth/callback`, vedi [ACCOUNT_SETUP.md](ACCOUNT_SETUP.md).
- Il backup automatico Android è disabilitato: i dati locali si conservano aggiornando l’app, ma la disinstallazione li cancella. I progressi sincronizzati si recuperano accedendo allo stesso account.
- In background il rendering si arresta; un'estrazione in corso viene completata e salvata. A figura ferma il ciclo grafico si ferma anche in primo piano.
- Indietro chiude prima un dialogo o un dettaglio; dalla mappa, collezione o classifica torna al menu; durante il gioco apre la pausa; dal menu salva e minimizza l’app.
- Pulsanti touch più grandi, safe area per le barre di sistema, densità grafica e ombre ridotte sui dispositivi touch.
- Font e relative licenze sono inclusi. Nessuna pubblicità, acquisto o analisi remota.

## Pubblicazione futura

L'identificatore `com.svela.puzzle` è provvisorio e non ne è stata verificata la disponibilità come marchio. Scegli l'identificatore definitivo prima di caricare il gioco sullo store.

`npm run android:bundle` genera un AAB release **non firmato**. Prima di Google Play servono una configurazione di firma gestita dal proprietario, versionamento delle release, scheda e dichiarazioni dello store, test chiuso quando applicabile e verifiche di prestazioni su dispositivi Android reali. Non vengono create o caricate chiavi di pubblicazione automaticamente.

Le prove headless verificano il livello web e non equivalgono all'esecuzione di APK su Android: plugin nativi, navigazione di sistema, consumi e fluidità su hardware reale richiedono ancora una prova sul dispositivo.

## Prova sul telefono

1. Trasferisci `artifacts/android/svela-0.2.0-debug.apk` sul telefono con cavo USB o un servizio di file che usi già, quindi aprilo dall’app File/Download.
2. Se Android lo richiede, consenti a quella specifica app di installare app sconosciute e torna all’APK per installarlo. Puoi poi revocare il permesso. È una build di sviluppo, esterna a Google Play.
3. Se Svela è già installata con la stessa firma, scegli **Aggiorna** per conservare i dati. Se compare un conflitto di firma, non disinstallare prima di aver salvato/sincronizzato i progressi: la disinstallazione cancella i dati locali.
4. Apri **Svela** e premi **Continua con Google**. Dopo la scelta dell’account il browser deve riportarti automaticamente nell’app, senza una schermata di installazione PWA.
5. Gioca alcune mosse, chiudi e riapri l’app e controlla il ripristino. Apri poi la PWA con lo stesso account per verificare i progressi cloud. Prova anche modalità aereo, ritorno online e tasto Indietro.

Android 7 o successivo è il minimo dichiarato; serve un WebView aggiornato e hardware OpenGL ES 3.0. L’installazione sul telefono e il login Google personale non sono stati eseguiti automaticamente.

Riferimenti: [installazione da una fonte specifica](https://support.google.com/pixelphone/answer/7391672), [distribuzione esterna a Google Play](https://developer.android.com/distribute/marketing-tools/alternative-distribution).

## Verifica della versione 0.2.0

Il 3 novembre 2026: build debug completata, firma APK v2 valida e identica alla 0.1.0, 36 file web nel pacchetto identici alla build corrente. Superati 90 test di logica/salvataggio e 38 test browser (33 generali e 5 con servizi simulati), compresi accesso Android, annullamento e nuovo tentativo, ritorno a caldo e dopo chiusura del processo, isolamento ospite, sincronizzazione, uscita e classifiche. Verificato anche il redirect Supabase reale tramite annullamento OAuth senza account personale. Il precedente timeout del test pausa/riavvio non si è ripresentato nella prova mirata e nell’intera suite eseguita in sequenza. Resta da eseguire la prova su telefono con Google personale.
