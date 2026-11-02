/**
 * Offline campaign authoring tool. Run `node scripts/author-campaign.mjs` to
 * reproduce the fixed level snippets. This script is never imported by the app.
 * Silhouettes are hand drawn; seeded extraction assigns acyclic exit rays and
 * selects the requested measured depth. Runtime only decodes the saved arrows.
 */
const directions = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const symbols = ['R','L','U','D','F','B'];
const records = [
  [4,'giardini','bell',12,'La campana d’aria','Un rintocco apre il giardino sospeso.','Campana delle nuvole','Comincia dai bordi: il vuoto centrale lascia respirare le file.','Suona soltanto quando una nuvola trova il coraggio di partire.','Il primo rintocco raggiunge le isole lontane.'],
  [4,'giardini','feather',14,'Una piuma fra le isole','La costa sottile collega due piccoli cieli.','Piuma dell’aurora','Segui la costa della piuma e controlla le punte sul retro.','Ogni sua barba conserva il colore di un’alba diversa.','L’aurora ha ritrovato la propria leggerezza.'],
  [4,'giardini','flower',13,'Petali nel vuoto','Una corolla protegge un centro d’aria.','Fiore del cielo','Alterna i petali: uno spazio vuoto può nascondere un allineamento.','Cresce senza terra, nutrita dalle promesse dei viaggiatori.','Una nuova corolla si apre sopra le nuvole.'],
  [4,'giardini','lantern',16,'La sera delle lucciole','Una luce passa da una parete all’altra.','Lanterna delle lucciole','Leggi le pareti sottili da entrambi i lati della lanterna.','Dentro la sua luce, le lucciole riposano anche d’inverno.','Il sentiero sospeso brilla fino all’ultima isola.'],
  [4,'giardini','nest',17,'Il nido delle correnti','Le fronde si raccolgono in una piccola conca.','Nido del vento gentile','Libera il bordo della conca, poi cerca le frecce sul fondo.','Aspetta un uovo deposto da un vento che non ha ancora nome.','Il giardino custodisce di nuovo un luogo dove tornare.'],
  [5,'fucina','ember',14,'Brace sotto la cenere','Tre lingue di fuoco cercano spazio.','Brace della prima forgia','Le lingue del fuoco si aprono a ritmi diversi: cambia fila.','Non brucia le mani. Scalda le idee ancora da costruire.','La fucina si risveglia con un piccolo respiro rosso.'],
  [5,'fucina','hammer',18,'Il colpo silenzioso','Una testa larga, un manico da svelare.','Martello degli echi','Dalla testa al manico, controlla dove prosegue ogni raggio.','Ogni colpo ripete il suono della prima montagna.','Un’eco limpida attraversa le sale della fucina.'],
  [5,'fucina','anvil',16,'Il ponte del ferro','Due spalle sostengono un peso invisibile.','Incudine delle promesse','Passa fra le due spalle e osserva i sostegni più bassi.','Custodisce le promesse che meritano di diventare materia.','Il ferro riposa, pronto a prendere una forma nuova.'],
  [5,'fucina','gear',19,'Denti nel buio','Ogni dente mette in moto il successivo.','Ruota del risveglio','Segui un dente fino al mozzo, poi confronta il lato opposto.','Ha girato per secoli senza perdere un solo istante.','La grande ruota rimette in moto la fucina.'],
  [5,'fucina','phoenix',20,'Ali di cenere','Due ali raccolgono l’ultimo bagliore.','Fenice della forgia','Le ali si rispondono: cerca il passaggio che collega i loro strati.','Rinasce dalle cose che abbiamo imparato a lasciare andare.','La fenice porta la prima scintilla oltre le montagne.'],
  [6,'cittadella','mirror',15,'Il cortile riflesso','Una cornice spezzata trattiene il cielo.','Specchio del cielo quieto','Confronta le estremità della cornice prima di seguire il riflesso.','Mostra il cielo di un luogo in cui ti sei sentito a casa.','Il cortile riflette di nuovo un cielo sereno.'],
  [6,'cittadella','mask',19,'Il volto senza voce','Due occhi osservano strade differenti.','Maschera delle due voci','Gli occhi sono varchi: segui anche le file che li attraversano.','Ascolta ciò che le parole non riescono ancora a dire.','La cittadella riconosce il passo di un nuovo ospite.'],
  [6,'cittadella','crown',17,'Tre punte per un regno','Le guglie celano passaggi sotto la fascia.','Corona delle soglie','Scendi dalle punte alla fascia e cerca le uscite fra le guglie.','Il suo regno comincia dove qualcuno sceglie di accogliere.','Le tre torri salutano chi attraversa la cittadella.'],
  [6,'cittadella','prism',21,'La luce obliqua','Le facce dividono un unico cammino.','Prisma dei sette sentieri','Ruota lungo le facce oblique: la stessa fila cambia aspetto.','Divide la luce nei colori delle strade ancora possibili.','Ogni colore trova il proprio sentiero nella pietra.'],
  [6,'cittadella','castle',22,'La porta delle torri','Un ponte tiene unite due alte sentinelle.','Castello dei riflessi','Alterna le torri e verifica i raggi che attraversano il ponte.','Le sue finestre conservano le luci di tutti i ritorni.','La porta si apre e la cittadella torna ad abitarsi.'],
  [7,'abissi','pearl',16,'La perla nella coppa','Un guscio aperto custodisce una luce.','Perla delle profondità','La coppa ha due rive: passa dall’una all’altra per leggere il fondo.','È nata da una lacrima che il mare ha scelto di proteggere.','Una luce morbida rischiara il primo abisso.'],
  [7,'abissi','coral',20,'Rami sotto il mare','Le correnti separano una foresta sommersa.','Corallo dei ricordi','Segui ogni ramo fino al tronco e controlla gli incroci nascosti.','I suoi rami crescono di un ricordo a ogni nuova marea.','La foresta sommersa riprende a raccontare il mare.'],
  [7,'abissi','shell',18,'La conchiglia aperta','Costole sottili si raccolgono in un ventaglio.','Valva dell’orizzonte','Leggi le costole del ventaglio, poi cerca il loro punto d’incontro.','Si apre quando sente il nome di una riva sconosciuta.','Una riva lontana risponde attraverso la conchiglia.'],
  [7,'abissi','jellyfish',22,'La danza trasparente','Una cupola e fili che oscillano al buio.','Medusa delle stelle sommerse','Distingui la cupola dai fili e segui i raggi lungo tutta la profondità.','Porta sul fondo le costellazioni cadute durante le tempeste.','Le stelle sommerse tornano a danzare nell’acqua.'],
  [7,'abissi','leviathan',23,'Il sonno del gigante','Una lunga schiena curva protegge gli abissi.','Leviatano di cristallo','Dalla coda alla testa, cambia lato quando una curva chiude la vista.','Dorme finché ogni creatura del mare non ha trovato riparo.','Il gigante apre gli occhi e gli abissi si fanno quieti.'],
  [8,'maree','anchor',17,'Il peso della quiete','Due braccia trovano un fondale comune.','Ancora delle acque calme','Segui le braccia fino al fusto e controlla la traversa sul retro.','Sa fermare una nave senza trattenere il desiderio di partire.','Il labirinto concede un primo approdo tranquillo.'],
  [8,'maree','wave',21,'Il dorso della marea','Una cresta piegata nasconde la risacca.','Onda del ritorno','La cresta e la risacca si incastrano: cerca le file oltre la curva.','Torna sempre, ma porta ogni volta un mare diverso.','La marea ritrova un passaggio fra le pareti del labirinto.'],
  [8,'maree','ship',19,'La nave senza ombra','Una vela alta incontra uno scafo sottile.','Nave dei porti impossibili','Alterna vela e scafo: il loro incrocio tiene unite le catene.','Ha gettato l’ancora soltanto nei luoghi che parevano irraggiungibili.','Un nuovo porto compare sulla carta delle maree.'],
  [8,'maree','conch',23,'La voce nella spirale','Il guscio avvolge un corridoio di luce.','Conchiglia delle rotte','Segui la spirale per strati, senza fermarti al primo spazio vuoto.','Nella sua voce si incontrano tutte le partenze del mondo.','La conchiglia indica la rotta oltre il labirinto.'],
  [8,'maree','trident',24,'Le tre correnti','Tre punte conducono allo stesso fondale.','Tridente delle maree','Confronta le tre punte e libera il raccordo che sostiene le correnti.','Non comanda il mare: gli ricorda come ritrovare l’equilibrio.','Le tre correnti si accordano e il labirinto si apre.'],
  [9,'santuario','flute',18,'Un soffio fra le colonne','I fori lasciano passare una melodia.','Flauto del primo soffio','I fori separano le file, ma alcuni raggi proseguono oltre il vuoto.','Ricorda la prima nota suonata dal vento fra le canne.','Una nota lieve raggiunge il santuario addormentato.'],
  [9,'santuario','kite',22,'Il cielo legato a un filo','La vela apre due diagonali sopra la coda.','Aquilone delle alture','Esplora le diagonali della vela e torna al filo quando si apre un varco.','Sale più in alto quando chi lo tiene impara a cedere un poco.','L’aquilone trova la corrente che conduce alle alture.'],
  [9,'santuario','chime',20,'Le canne del mattino','Canne diverse aspettano lo stesso soffio.','Sonaglio delle correnti','Alterna le canne lunghe e corte: il sostegno nasconde altri passaggi.','Ogni canna conosce il nome di un vento che verrà domani.','Le correnti fanno risuonare il mattino nel santuario.'],
  [9,'santuario','fanfare',23,'Il richiamo delle vette','Un padiglione raccoglie il fiato delle cime.','Fanfara delle alte vette','Segui l’apertura del padiglione verso il tubo e controlla i raccordi.','Il suo richiamo arriva soltanto a chi ha smesso di avere fretta.','Le vette rispondono, una dopo l’altra, al richiamo.'],
  [9,'santuario','griffin',24,'Il custode dell’aria','Ali aperte e artigli sospesi sulla soglia.','Grifone dei venti','Metti in relazione ali e zampe: le uscite si aprono su facce lontane.','Veglia sulle strade che esistono soltanto per chi osa alzare lo sguardo.','Il grifone ti affida la corrente verso il cuore dei mondi.'],
  [10,'cuore','rune',19,'Il segno che respira','Una scrittura antica tiene aperte due soglie.','Runa del principio','Segui i tratti della runa e verifica i raggi che uniscono le sue parti.','Cambia significato ogni volta che qualcuno impara a leggerla.','Il primo segno si accende nella sala dei mondi.'],
  [10,'cuore','eye',23,'L’occhio dell’orizzonte','Due palpebre circondano un piccolo cielo.','Occhio dei mondi lontani','Cerca i passaggi fra le palpebre e osserva il centro da più lati.','Vede i mondi possibili senza dimenticare quello che abiti.','Un orizzonte nuovo si apre nel cuore della sala.'],
  [10,'cuore','chalice',20,'La coppa delle origini','Una vasca luminosa poggia su un solo stelo.','Calice della prima luce','Passa dal bordo allo stelo e controlla la profondità della coppa.','Raccoglie la luce che avanza quando una notte finisce.','La prima luce riempie il calice senza traboccare.'],
  [10,'cuore','infinity',24,'La strada che ritorna','Due anelli si incontrano senza chiudere il viaggio.','Nodo dell’infinito','Attraversa entrambi gli anelli e segui i raggi oltre il loro incontro.','Ogni ritorno aggiunge una strada al disegno del viaggio.','Le due strade si riconoscono e il viaggio continua.'],
  [10,'cuore','heart',24,'Il cuore dei mondi','Ogni spazio liberato accende una nuova possibilità.','Cuore di tutti i mondi','Riunisci ciò che hai imparato: leggi le sei direzioni attraverso ogni strato.','Batte in ogni luogo in cui qualcuno fa spazio a una meraviglia.','Hai aperto cinquanta meraviglie. Ora ogni mondo custodisce il tuo viaggio.'],
];

// # cells are intentional sculpture silhouettes, rows y=2…−2, x=−2…2.
const extrude = (mask, zs = [-1,0,1]) => zs.map(z => [z,mask]);
const shapes = [
  extrude('..#../.###./.#.#./.#.#./#####'), // bell with an airy open chamber
  [...extrude('.##../####./.###./..##./...#.'),[-2,'...../.#.../...../...../.....'],[2,'...../...../...../...#./.....']],
  extrude('.###./##.##/#...#/##.##/.###.'), // four hollow petals
  extrude('.###./#...#/#...#/#...#/.###.'),
  [[-2,'...../...../...../.###./.###.'],[-1,'...../...../##.##/#####/.###.'],[0,'...../...../##.##/#...#/#####'],[1,'...../...../##.##/#####/.###.'],[2,'...../...../...../.###./.###.']],
  extrude('..#../#.#../###.#/.####/.###.'),
  extrude('#####/#####/..#../..#../..#..'),
  [[-2,'...../...../.###./..#../.###.'],[-1,'...../#####/.###./..#../#####'],[0,'...../#####/.#.#./..#../#####'],[1,'...../#####/.###./..#../#####'],[2,'...../...../.###./..#../.###.']],
  extrude('.#.#./#####/.#.#./#####/.#.#.'),
  [[-2,'...../#...#/##.##/...../.....'],[-1,'#...#/##.##/.###./..#../.#.#.'],[0,'#...#/#####/.#.#./.###./.#.#.'],[1,'#...#/##.##/.###./..#../.#.#.'],[2,'...../#...#/##.##/...../.....']],
  [[-2,'...../.###./.#.../.###./.....'],[-1,'.###./#...#/#...#/#...#/.###.'],[0,'.###./#...#/#...#/....#/.###.'],[1,'.###./#...#/#...#/#...#/.###.'],[2,'...../.###./...#./.###./.....']],
  extrude('.###./#.#.#/#...#/.###./..#..'),
  extrude('#.#.#/#.#.#/#####/.#.#./.###.'),
  [[-2,'...../..#../.###./..#../.....'],[-1,'..#../.###./#####/.###./..#..'],[0,'..#../.###./##.##/.###./..#..'],[1,'...../..#../.###./#####/.###.'],[2,'...../...../..#../.###./..#..']],
  [[-1,'#...#/#...#/##.##/#####/#...#'],[0,'#...#/##.##/#...#/#####/#...#'],[1,'#...#/#...#/##.##/#####/#...#'],[-2,'...../#...#/#...#/...../.....'],[2,'...../#...#/#...#/...../.....']],
  [[-2,'...../...../...../.###./.....'],[-1,'...../.###./#...#/.###./#####'],[0,'...../..#../#...#/#...#/#####'],[1,'...../.###./#...#/.###./#####'],[2,'...../...../...../.###./.....']],
  extrude('#...#/.#.#./##.##/.###./..#..',[-2,-1,0,1]),
  [[-2,'...../...../..#../.###./..#..'],[-1,'#...#/#.#.#/.###./.###./..#..'],[0,'#...#/#.#.#/.#.#./.###./..#..'],[1,'#...#/#.#.#/.###./.###./..#..'],[2,'...../...../..#../.###./..#..']],
  extrude('.###./#####/#...#/.#.#./.#.#.',[-2,-1,0,1]),
  [[-2,'...../...../.###./#...#/.....'],[-1,'..###/.##../##.../.###./....#'],[0,'..###/.##../.#.../.###./....#'],[1,'..###/.##../##.../.###./....#'],[2,'...../...../.###./#...#/.....']],
  extrude('.###./..#../#####/#.#.#/.###.'),
  [[-2,'...../.###./#...#/...../.....'],[-1,'.###./##..#/#...#/.##../..###'],[0,'.###./##..#/#...#/.##../..###'],[1,'.###./##..#/#...#/.##../..###'],[2,'...../...../...../.##../..###']],
  extrude('..#../.###./####./..#../#####'),
  [[-2,'...../.###./.#.#./...#./.....'],[-1,'.###./#...#/#.###/#.#.#/.###.'],[0,'.###./#...#/#..##/#.#.#/.###.'],[1,'...../.###./.#.#./.###./.....']],
  extrude('#.#.#/#.#.#/#####/..#../.###.',[-2,-1,0,1]),
  [[-2,'...../.###./...../.###./.....'],[-1,'#####/#.#.#/#####/#.#.#/#####'],[0,'...../#.#.#/#...#/#.#.#/.....'],[1,'...../#.#.#/#####/#.#.#/.....']],
  [[-2,'...../...../..#../...../.....'],[-1,'..#../.###./#####/.###./..#..'],[0,'..#../.###./##.##/.###./..#..'],[1,'..#../.###./#####/..#../.##..'],[2,'...../...../..#../.##../#....']],
  [[-2,'...../#.#.#/#.#.#/#...#/.....'],[-1,'#####/#.#.#/#.#.#/#...#/.....'],[0,'#####/#.#.#/#...#/#...#/.....'],[1,'#####/#.#.#/#.#.#/#...#/.....']],
  [[-2,'...../...##/..#.#/..#.#/...##'],[-1,'...../...##/###.#/#.#.#/...##'],[0,'...../....#/##..#/#.#.#/....#'],[1,'...../...##/###.#/#.#.#/...##'],[2,'...../...##/..#.#/..#.#/...##']],
  [[-2,'...../#...#/##.##/...../.....'],[-1,'#..##/##.##/.###./..#../.#.#.'],[0,'#..##/#####/.#.#./.###./.#.#.'],[1,'#..##/##.##/.###./..#../.#.#.'],[2,'...../#...#/##.##/...../.....']],
  extrude('#..#./##.#./.#.##/.#.##/.#..#',[-2,-1,0,1]),
  [[-2,'...../.###./#...#/.###./.....'],[-1,'.###./#...#/#.#.#/#...#/.###.'],[0,'.###./#...#/#...#/#...#/.###.'],[1,'...../.###./#.#.#/.###./.....']],
  [[-2,'#...#/#...#/.###./..#../.###.'],[-1,'#...#/##.##/.###./..#../.###.'],[0,'#...#/#...#/.#.#./..#../.###.'],[1,'#...#/##.##/.###./..#../.###.']],
  [[-2,'.#.#./#.#.#/..#../#.#.#/.#.#.'],[-1,'.#.#./#.#.#/#...#/#.#.#/.#.#.'],[0,'.#.#./#.#.#/#...#/#.#.#/.#.#.'],[1,'.#.#./#.#.#/#...#/#.#.#/.#.#.'],[2,'.#.#./#.#.#/..#../#.#.#/.#.#.']],
  [[-2,'...../.#.#./.###./..#../.....'],[-1,'.#.#./#####/#####/.###./..#..'],[0,'.#.#./#####/##.##/.###./..#..'],[1,'.#.#./#####/#####/.###./..#..'],[2,'...../.#.#./.###./..#../.....']],
];

function cellsOf(layers) {
  const cells = [];
  for (const [z,mask] of layers) mask.split('/').forEach((row,j) => [...row].forEach((c,i) => {
    if(c === '#' && (i !== 2 || j !== 2 || z !== 0)) cells.push([i-2,2-j,z]);
  }));
  return cells;
}
function onRay(a,d,b) {
  const axis=d.findIndex(v=>v!==0);
  return a.every((v,i)=> i===axis || v===b[i]) && (b[axis]-a[axis])*d[axis]>0;
}
function author(cells, target, seed) {
  let state=seed;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const rays=cells.map(p=>directions.map(d=>onRay(p,d,[0,0,0]) ? null : cells.flatMap((q,i)=>onRay(p,d,q)?[i]:[])));
  let best=null;
  for(let attempt=0;attempt<24000;attempt++) {
    const remaining=new Set(cells.map((_,i)=>i));
    const depths=Array(cells.length).fill(0), arrows=Array(cells.length).fill(-1);
    while(remaining.size) {
      const choices=[];
      for(const i of remaining) for(let d=0;d<6;d++) {
        const ray=rays[i][d];
        if(ray===null || ray.some(j=>remaining.has(j))) continue;
        const depth=1+Math.max(0,...ray.map(j=>depths[j]));
        // Bias toward a long current chain while retaining multiple branches.
        choices.push({i,d,depth,score:depth*(0.35+random())+random()*5});
      }
      choices.sort((a,b)=>b.score-a.score);
      const chosen=choices[0];
      if(!chosen) break;
      depths[chosen.i]=chosen.depth; arrows[chosen.i]=chosen.d; remaining.delete(chosen.i);
    }
    if(remaining.size || new Set(arrows).size!==6) continue;
    const depth=Math.max(...depths), free=depths.filter(v=>v===1).length;
    if(free<3 || free>cells.length/2) continue;
    const score=Math.abs(depth-target)*100+Math.abs(free-Math.round(cells.length*0.18));
    if(!best || score<best.score) best={arrows,depth,free,score};
    if(score===0) break;
  }
  if(!best || best.depth!==target) throw Error(`Cannot author ${seed}: ${cells.length} cells, target ${target}, best ${JSON.stringify(best)}`);
  return best;
}

for(let index=0;index<records.length;index++) {
  const [chapter,slug,reward,target,name,subtitle,artifact,focus,lore,ending]=records[index];
  const id=index+16, key=`${slug}-${String(index%5+1).padStart(2,'0')}-v2`;
  const cells=cellsOf(shapes[index]);
  if(cells.length>64) throw Error(`${key}: ${cells.length} cells exceeds 64`);
  const result=author(cells,target,id*9029);
  const rarity=index===34?'epic':index%5===4?'rare':index%5===1||index%5===3?'uncommon':'common';
  console.error(`${id}: ${cells.length} pieces / ${result.free} initial / ${result.depth} layers`);
  const byPosition=new Map(cells.map((p,i)=>[p.join(','),symbols[result.arrows[i]]]));
  const layers=[...new Set(cells.map(p=>p[2]))].sort((a,b)=>a-b).map(z=>[z,Array.from({length:5},(_,j)=>Array.from({length:5},(_,i)=>byPosition.get([i-2,2-j,z].join(','))??'.').join('')).join('/')]);
  const metadata={id,key,chapter,name,subtitle,artifact,reward,rarity,focus,lore,ending};
  process.stdout.write(`  // ${cells.length} pieces · ${result.free} initial exits · ${result.depth} dependency layers.\n  authoredLevel(${JSON.stringify(metadata,null,4).replaceAll('\n','\n  ')}, [\n${layers.map(layer=>`    ${JSON.stringify(layer)},`).join('\n')}\n  ]),\n`);
}
