# Scenografie di Svela

Sei modelli originali creati in Blender per i margini della scena. Non incorporano asset, immagini o texture di terze parti. Il file `svela-environments.blend` contiene i tre capitoli; `contact-sheet.png` permette di ispezionare le sei sagome. `manifest.json` riporta dimensioni e conteggi esportati.

| Capitolo | Elementi | GLB | Vertici esportati | Primitive |
| --- | --- | ---: | ---: | ---: |
| Bosco | Tronco con vegetazione; pietra del sentiero | 247.184 byte | 6.780 | 13 |
| Osservatorio | Arco frammentato; sfera armillare | 180.608 byte | 5.896 | 6 |
| Archivio | Portale spezzato; volumi su frammento sospeso | 197.916 byte | 7.104 | 8 |

Gli oggetti vengono raggruppati per materiale prima dell'esportazione. Ogni GLB ha due gruppi radice chiamati `left` e `right`, coordinate glTF Y-up, altezza massima di un'unità e base a Y=0. Non include luci, camere, animazioni, immagini o buffer esterni. Non richiede decoder di compressione.

## Rigenerare

Lo script `scripts/blender/build-environments.py` è la sorgente riproducibile e ricostruisce modelli, file Blender, anteprima e manifest. Verificato con Blender 5.1.2. Dalla radice del repository, su macOS:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/blender/build-environments.py
```

Con Blender disponibile nel PATH si può usare `blender` al posto del percorso assoluto. Gli export finiscono in `public/models/environments/`; sorgente e anteprima restano qui e non vengono inclusi nella build web.

## Integrazione e controllo

`src/chapter-assets.ts` carica ogni capitolo su richiesta, condivide la geometria immutabile e assegna materiali indipendenti alle istanze. La disposizione limita altezza e larghezza per proteggere il centro dello schermo. `src/chapter-environment.ts` conserva il fallback procedurale se il caricamento fallisce, mantiene le decorazioni separate dalle collisioni e riduce l'opacità alla scoperta della reliquia.

```sh
npm test
npm run build
npx playwright test tests/browser/atmosphere.spec.ts
```

I test verificano i GLB effettivi, i limiti di geometria, la regione centrale protetta in più proporzioni dello schermo, il riuso degli asset, i caricamenti tardivi, il fallback e il caricamento dei tre capitoli offline. I test responsive non sostituiscono una prova su hardware Android reale.
