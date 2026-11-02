export type Vec3 = [number, number, number];

export interface Piece {
  id: string;
  position: Vec3;
  direction: Vec3;
  color: number;
}

export type RewardKind =
  | 'seed' | 'leaf' | 'mushroom' | 'talisman' | 'spirit'
  | 'compass' | 'crystal' | 'moon' | 'planet' | 'astrolabe'
  | 'key' | 'hourglass' | 'portal' | 'star' | 'world'
  | 'bell' | 'feather' | 'flower' | 'lantern' | 'nest'
  | 'ember' | 'hammer' | 'anvil' | 'gear' | 'phoenix'
  | 'mirror' | 'mask' | 'crown' | 'prism' | 'castle'
  | 'pearl' | 'coral' | 'shell' | 'jellyfish' | 'leviathan'
  | 'anchor' | 'wave' | 'ship' | 'conch' | 'trident'
  | 'flute' | 'kite' | 'chime' | 'fanfare' | 'griffin'
  | 'rune' | 'eye' | 'chalice' | 'infinity' | 'heart';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic';

export interface Level {
  id: number;
  key: string;
  chapter: number;
  focus: string;
  reward: RewardKind;
  rarity: Rarity;
  lore: string;
  ending: string;
  name: string;
  subtitle: string;
  artifact: string;
  pieces: Piece[];
}

const AXES: Vec3[] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0],
  [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

/** Positive center-to-center distance on an axis ray; Infinity means off-ray. */
function rayDistance(origin: Vec3, direction: Vec3, target: Vec3): number {
  const axis = direction.findIndex((component) => component !== 0);
  if (axis < 0) return Infinity;
  for (let index = 0; index < 3; index++) {
    if (index !== axis && origin[index] !== target[index]) return Infinity;
  }
  const distance = (target[axis] - origin[axis]) * direction[axis];
  return distance > 0 ? distance : Infinity;
}

/**
 * Test the complete infinite exit ray, including the permanent central core.
 * Distance is measured between cell centers (1 for adjacent cells), NOT the
 * available physical movement of a cube. A clear ray has Infinity.
 */
export function getExit(
  piece: Piece,
  remaining: readonly Piece[],
): { free: boolean; blockerId: string | null; distance: number } {
  let distance = rayDistance(piece.position, piece.direction, [0, 0, 0]);
  let blockerId: string | null = Number.isFinite(distance) ? 'core' : null;
  for (const other of remaining) {
    if (other.id === piece.id) continue;
    const candidate = rayDistance(piece.position, piece.direction, other.position);
    if (candidate < distance) {
      distance = candidate;
      blockerId = other.id;
    }
  }
  return { free: blockerId === null, blockerId, distance };
}

export function getAvailable(remaining: readonly Piece[]): Piece[] {
  return remaining.filter((piece) => getExit(piece, remaining).free);
}

/** Removal only clears rays, so any legal greedy order succeeds if solvable. */
export function solve(pieces: readonly Piece[]): string[] | null {
  let remaining = [...pieces];
  const order: string[] = [];
  while (remaining.length > 0) {
    const available = getAvailable(remaining);
    if (available.length === 0) return null;
    const removed = new Set(available.map((piece) => piece.id));
    order.push(...removed);
    remaining = remaining.filter((piece) => !removed.has(piece.id));
  }
  return order;
}

/** Change when published puzzle geometry or catalog membership changes. */
export const CATALOG_VERSION = 'fantasy-v2';

export const CHAPTERS = [
  { id: 1, name: 'Bosco dei sussurri', description: 'Piccoli sentieri custodiscono le prime meraviglie.' },
  { id: 2, name: 'Osservatorio perduto', description: 'Segui orbite dimenticate e ritrova la via delle stelle.' },
  { id: 3, name: 'Archivio dei mondi', description: 'Apri le soglie dove ogni oggetto conserva un universo.' },
  { id: 4, name: 'Giardini sospesi', description: 'Attraversa isole di fronde, cullate sopra le nuvole.' },
  { id: 5, name: 'Fucina degli echi', description: 'Ridesta il fuoco che trasforma le promesse in meraviglie.' },
  { id: 6, name: 'Cittadella degli specchi', description: 'Cerca nuovi sentieri fra torri, luce e riflessi.' },
  { id: 7, name: 'Abissi di cristallo', description: 'Scendi dove le stelle sommerse illuminano il mare.' },
  { id: 8, name: 'Labirinto delle maree', description: 'Segui le correnti verso porti che nessuna carta conosce.' },
  { id: 9, name: 'Santuario dei venti', description: 'Ascolta le melodie che uniscono le cime al cielo.' },
  { id: 10, name: 'Cuore dei mondi', description: 'Riunisci le strade del viaggio e accendi nuove possibilità.' },
] as const;

/**
 * Fixed authored diagrams, viewed from +z. Each row runs x=-2…2, rows run
 * y=2…-2; the pair's number is z. R/L = ±x, U/D = ±y, F/B = ±z.
 * Dots are empty cells. Decoding is linear: no search or generation at startup.
 * Coordinate-based IDs remain stable if diagram formatting changes.
 */
function authoredLevel(
  metadata: Omit<Level, 'pieces'>,
  layers: readonly (readonly [number, string])[],
): Level {
  const pieces: Piece[] = [];
  const arrows: Record<string, Vec3> = { R: AXES[0], L: AXES[1], U: AXES[2], D: AXES[3], F: AXES[4], B: AXES[5] };
  for (const [z, diagram] of layers) {
    diagram.split('/').forEach((row, rowIndex) => {
      [...row].forEach((symbol, columnIndex) => {
        if (symbol === '.') return;
        const x = columnIndex - 2;
        const y = 2 - rowIndex;
        const direction = arrows[symbol];
        if (!direction) throw new Error(`Unknown arrow ${symbol} in ${metadata.key}`);
        pieces.push({
          id: `${metadata.key}:${x},${y},${z}`,
          position: [x, y, z],
          direction: [...direction],
          color: ((x - y + z + metadata.id) % 5 + 5) % 5,
        });
      });
    });
  }
  return { ...metadata, pieces };
}

export const LEVELS: Level[] = [
  // 8 pieces · 3 initial exits · 3 dependency layers.
  authoredLevel({
    id: 1,
    key: "bosco-01-v1",
    chapter: 1,
    name: "Prime radici",
    subtitle: "Otto frecce, tre piccoli sentieri.",
    artifact: "Seme del risveglio",
    reward: "seed",
    rarity: "common",
    focus: "Cerca le uscite libere, poi segui ciò che si apre.",
    lore: "Dorme da cento inverni. Aspettava soltanto un po’ di spazio.",
    ending: "Hai fatto spazio al primo germoglio.",
  }, [
    [-1, "...../.R.F./...../.B.U./....."],
    [1, "...../.D.U./...../.F.L./....."],
  ]),
  // 10 pieces · 3 initial exits · 4 dependency layers.
  authoredLevel({
    id: 2,
    key: "bosco-02-v1",
    chapter: 1,
    name: "Una piega nel vento",
    subtitle: "Una foglia nasconde un filo di direzioni.",
    artifact: "Foglia dei sussurri",
    reward: "leaf",
    rarity: "common",
    focus: "Segui una fila anche quando le frecce cambiano verso.",
    lore: "Le sue venature ricordano ogni voce del bosco.",
    ending: "Il vento ha ritrovato la sua voce.",
  }, [
    [0, "..F../.DUL./.D.D./.BDL./..R.."],
  ]),
  // 12 pieces · 3 initial exits · 4 dependency layers.
  authoredLevel({
    id: 3,
    key: "bosco-03-v1",
    chapter: 1,
    name: "Luce sotto il muschio",
    subtitle: "Gira il cappello e scopri il gambo.",
    artifact: "Fungo lanterna",
    reward: "mushroom",
    rarity: "uncommon",
    focus: "Ruota la forma per cercare le frecce sul retro.",
    lore: "Si accende quando nessuno conosce più la strada.",
    ending: "Una piccola lanterna illumina il sentiero.",
  }, [
    [-1, "...../.FRF./...../...../....."],
    [0, "..L../.RUF./...../..D../..B.."],
    [1, "...../.RRF./...../...../....."],
  ]),
  // 16 pieces · 7 initial exits · 4 dependency layers.
  authoredLevel({
    id: 4,
    key: "bosco-04-v1",
    chapter: 1,
    name: "Sentieri intrecciati",
    subtitle: "Più varchi conducono alla stessa scoperta.",
    artifact: "Talismano del sentiero",
    reward: "talisman",
    rarity: "common",
    focus: "Alterna i sentieri liberi tra davanti e dietro.",
    lore: "Non indica la meta. Ricorda al viandante perché è partito.",
    ending: "Ogni sentiero ti ha portato fin qui.",
  }, [
    [-1, "...../..F../.L.L./..U../....."],
    [0, "..F../.D.L./D...D/.R.B./..F.."],
    [1, "...../..U../.B.L./..B../....."],
  ]),
  // 18 pieces · 3 initial exits · 6 dependency layers.
  authoredLevel({
    id: 5,
    key: "bosco-05-v1",
    chapter: 1,
    name: "Il custode verde",
    subtitle: "Un ultimo intreccio tra le fronde.",
    artifact: "Spirito del sottobosco",
    reward: "spirit",
    rarity: "rare",
    focus: "Leggi più passaggi in anticipo prima di scegliere una fila.",
    lore: "Abita il silenzio fra due foglie. Ora ha scelto di seguirti.",
    ending: "Il bosco ti affida il suo custode.",
  }, [
    [-1, "...../.RDB./.URU./...../....."],
    [0, "..B../.RRD./.F.B./...../....."],
    [1, "...../.DRB./.FLU./...../....."],
  ]),
  // 24 pieces · 9 initial exits · 8 dependency layers.
  authoredLevel({
    id: 6,
    key: "osservatorio-01-v1",
    chapter: 2,
    name: "Sei direzioni",
    subtitle: "Un ago per ogni orizzonte.",
    artifact: "Bussola senza nord",
    reward: "compass",
    rarity: "common",
    focus: "Le sei direzioni offrono ingressi diversi allo stesso incastro.",
    lore: "Il suo ago cerca i luoghi che non hai ancora immaginato.",
    ending: "La bussola ha trovato un nuovo orizzonte.",
  }, [
    [-2, "...../...../..B../...../....."],
    [-1, "...../..D../.RRF./..F../....."],
    [0, "..R../.DBL./UB.FU/.BFL./..F.."],
    [1, "...../..U../.BFD./..U../....."],
    [2, "...../...../..L../...../....."],
  ]),
  // 28 pieces · 5 initial exits · 9 dependency layers.
  authoredLevel({
    id: 7,
    key: "osservatorio-02-v1",
    chapter: 2,
    name: "Il prisma dell’eco",
    subtitle: "Le punte custodiscono una catena nascosta.",
    artifact: "Cristallo dell’eco",
    reward: "crystal",
    rarity: "uncommon",
    focus: "Libera le punte e segui la catena verso il centro.",
    lore: "Trattiene il suono delle stelle cadute nell’erba.",
    ending: "L’eco ha raggiunto il cuore del cristallo.",
  }, [
    [-1, "...../.UDL./.RRB./.ULU./....."],
    [0, "..F../.DLL./.D.F./.LRU./..D.."],
    [1, "...../.DRB./.BLL./.BLU./....."],
  ]),
  // 32 pieces · 6 initial exits · 9 dependency layers.
  authoredLevel({
    id: 8,
    key: "osservatorio-03-v1",
    chapter: 2,
    name: "Il lato quieto",
    subtitle: "Una falce, molti strati da leggere.",
    artifact: "Falce di luna",
    reward: "moon",
    rarity: "common",
    focus: "Guarda lo spessore della forma: una fila può attraversare più strati.",
    lore: "Conserva un frammento della prima notte del mondo.",
    ending: "La luna torna a mostrarsi intera nel tuo ricordo.",
  }, [
    [-1, ".FL../.UL../.RB../.UU../.UB.."],
    [0, ".DL../RDU../UB.../RDF../.LL.."],
    [1, ".UB../.BU../.BL../.BF../.DL.."],
  ]),
  // 30 pieces · 5 initial exits · 10 dependency layers.
  authoredLevel({
    id: 9,
    key: "osservatorio-04-v1",
    chapter: 2,
    name: "Un’orbita aperta",
    subtitle: "Trova il varco fra le due arcate.",
    artifact: "Pianeta tascabile",
    reward: "planet",
    rarity: "uncommon",
    focus: "Uno spazio vuoto fra due cubi non interrompe il raggio.",
    lore: "Ha oceani minuscoli e maree che seguono il tuo respiro.",
    ending: "Un piccolo pianeta entra nella tua orbita.",
  }, [
    [-1, "LRFUD/D...D/D...D/D...D/RR.UF"],
    [1, "UDUBB/R...B/B...D/B...B/LL.UL"],
  ]),
  // 36 pieces · 6 initial exits · 11 dependency layers.
  authoredLevel({
    id: 10,
    key: "osservatorio-05-v1",
    chapter: 2,
    name: "La mappa del cielo",
    subtitle: "Le orbite si incrociano in un solo cuore.",
    artifact: "Astrolabio dei sogni",
    reward: "astrolabe",
    rarity: "rare",
    focus: "Collega le uscite di una faccia ai varchi della successiva.",
    lore: "Misura la distanza fra ciò che sogni e ciò che cerchi.",
    ending: "Hai riallineato il cielo dimenticato.",
  }, [
    [-2, "...../...../RDRRR/...../....."],
    [-1, "...../.FDD./B...L/.RRF./....."],
    [0, "..R../.DLB./B...B/.BLF./..D.."],
    [1, "...../.FLL./R...B/.BBU./....."],
    [2, "...../...../BRURB/...../....."],
  ]),
  // 44 pieces · 8 initial exits · 13 dependency layers.
  authoredLevel({
    id: 11,
    key: "archivio-01-v1",
    chapter: 3,
    name: "Le soglie vuote",
    subtitle: "Gli spigoli disegnano una stanza d’aria.",
    artifact: "Chiave delle soglie",
    reward: "key",
    rarity: "common",
    focus: "Segui gli spigoli: anche un lungo corridoio può essere libero.",
    lore: "Non apre serrature. Apre possibilità rimaste in attesa.",
    ending: "La prima soglia dell’archivio è aperta.",
  }, [
    [-2, "FBFUL/U...U/R...F/D...U/RURUU"],
    [-1, "L...D/...../...../...../R...R"],
    [0, "F...D/...../...../...../R...B"],
    [1, "D...U/...../...../...../R...U"],
    [2, "LDFBB/B...B/F...L/U...D/BBRUB"],
  ]),
  // 36 pieces · 6 initial exits · 12 dependency layers.
  authoredLevel({
    id: 12,
    key: "archivio-02-v1",
    chapter: 3,
    name: "La goccia sospesa",
    subtitle: "Due coppe, un passaggio sottile.",
    artifact: "Clessidra di rugiada",
    reward: "hourglass",
    rarity: "uncommon",
    focus: "Passa da una coppa all’altra quando la catena si restringe.",
    lore: "Le sue gocce contano le meraviglie, senza fretta.",
    ending: "Ogni goccia ha trovato il proprio posto.",
  }, [
    [-1, ".RFF./.R.R./.RUF./.F.B./.FBU."],
    [0, ".UFL./..U../.U.U./..D../.ULL."],
    [1, ".BDD./.B.L./.FDL./.R.D./.FBL."],
  ]),
  // 48 pieces · 8 initial exits · 15 dependency layers.
  authoredLevel({
    id: 13,
    key: "archivio-03-v1",
    chapter: 3,
    name: "Oltre la cornice",
    subtitle: "Tre cornici custodiscono la stessa soglia.",
    artifact: "Portale delle maree",
    reward: "portal",
    rarity: "common",
    focus: "Controlla l’allineamento delle cornici, anche sul lato opposto.",
    lore: "Dietro la sua luce, un mare ricorda rive mai esistite.",
    ending: "La soglia si apre su un mare nuovo.",
  }, [
    [-1, "RFBUF/R...F/R...F/L...F/FUFFU"],
    [0, "DDBBF/B...F/B...F/B...L/RDFFU"],
    [1, "LDBBD/B...R/U...D/B...R/UDUUL"],
  ]),
  // 56 pieces · 10 initial exits · 16 dependency layers.
  authoredLevel({
    id: 14,
    key: "archivio-04-v1",
    chapter: 3,
    name: "La rotta errante",
    subtitle: "I raggi si incontrano in profondità.",
    artifact: "Stella errante",
    reward: "star",
    rarity: "common",
    focus: "Segui i raggi fino in fondo e cambia punto di vista fra le catene.",
    lore: "Ha attraversato cieli senza nome per arrivare qui.",
    ending: "La stella ha trovato un luogo dove fermarsi.",
  }, [
    [-2, "...../..L../.BDL./..F../....."],
    [-1, "..F../.DUF./FLULL/.LUF./..U.."],
    [0, ".BFL./RRURD/FL.RB/LRDUR/.DFU."],
    [1, "..D../.DDD./LRDRB/.DDL./..D.."],
    [2, "...../..B../.BUB./..U../....."],
  ]),
  // 64 pieces · 12 initial exits · 18 dependency layers.
  authoredLevel({
    id: 15,
    key: "archivio-05-v1",
    chapter: 3,
    name: "Un mondo da svelare",
    subtitle: "Ogni varco prepara l’ultima meraviglia.",
    artifact: "Mondo in un respiro",
    reward: "world",
    rarity: "epic",
    focus: "Intreccia tutte le direzioni: ogni uscita avvicina il cuore.",
    lore: "Un intero universo riposa nel palmo di chi sa fare spazio.",
    ending: "Hai svelato un mondo. Il viaggio ora ti appartiene.",
  }, [
    [-2, "...../..L../.FLL./..F../....."],
    [-1, "..U../BBRDU/RFBBB/RURFF/..D.."],
    [0, ".DLL./RRRRU/UL.RD/ULLLL/.FRU."],
    [1, "..D../DDRFB/BFFBB/RBRUU/..B.."],
    [2, "...../..D../.DRB./..D../....."],
  ]),
  // 39 pieces · 7 initial exits · 12 dependency layers.
  authoredLevel({
      "id": 16,
      "key": "giardini-01-v2",
      "chapter": 4,
      "name": "La campana d’aria",
      "subtitle": "Un rintocco apre il giardino sospeso.",
      "artifact": "Campana delle nuvole",
      "reward": "bell",
      "rarity": "common",
      "focus": "Comincia dai bordi: il vuoto centrale lascia respirare le file.",
      "lore": "Suona soltanto quando una nuvola trova il coraggio di partire.",
      "ending": "Il primo rintocco raggiunge le isole lontane."
  }, [
    [-1,"..D../.FLL./.F.F./.D.R./BFFFL"],
    [0,"..R../.FUL./.F.F./.U.L./RUFUD"],
    [1,"..U../.DLF./.D.L./.D.B./BDUUB"],
  ]),
  // 37 pieces · 7 initial exits · 14 dependency layers.
  authoredLevel({
      "id": 17,
      "key": "giardini-02-v2",
      "chapter": 4,
      "name": "Una piuma fra le isole",
      "subtitle": "La costa sottile collega due piccoli cieli.",
      "artifact": "Piuma dell’aurora",
      "reward": "feather",
      "rarity": "uncommon",
      "focus": "Segui la costa della piuma e controlla le punte sul retro.",
      "lore": "Ogni sua barba conserva il colore di un’alba diversa.",
      "ending": "L’aurora ha ritrovato la propria leggerezza."
  }, [
    [-2,"...../.F.../...../...../....."],
    [-1,".FF../FUFL./.ULR./..BL./...U."],
    [0,".RF../FUUL./.B.B./..RB./...D."],
    [1,".RD../RUDD./.DLL./..BR./...D."],
    [2,"...../...../...../...D./....."],
  ]),
  // 48 pieces · 9 initial exits · 13 dependency layers.
  authoredLevel({
      "id": 18,
      "key": "giardini-03-v2",
      "chapter": 4,
      "name": "Petali nel vuoto",
      "subtitle": "Una corolla protegge un centro d’aria.",
      "artifact": "Fiore del cielo",
      "reward": "flower",
      "rarity": "common",
      "focus": "Alterna i petali: uno spazio vuoto può nascondere un allineamento.",
      "lore": "Cresce senza terra, nutrita dalle promesse dei viaggiatori.",
      "ending": "Una nuova corolla si apre sopra le nuvole."
  }, [
    [-1,".RBD./DL.BU/B...L/RF.FF/.UUB."],
    [0,".DUU./DD.UL/F...B/RD.UF/.RBU."],
    [1,".DDB./DL.BR/R...B/BF.RU/.BBU."],
  ]),
  // 36 pieces · 6 initial exits · 16 dependency layers.
  authoredLevel({
      "id": 19,
      "key": "giardini-04-v2",
      "chapter": 4,
      "name": "La sera delle lucciole",
      "subtitle": "Una luce passa da una parete all’altra.",
      "artifact": "Lanterna delle lucciole",
      "reward": "lantern",
      "rarity": "uncommon",
      "focus": "Leggi le pareti sottili da entrambi i lati della lanterna.",
      "lore": "Dentro la sua luce, le lucciole riposano anche d’inverno.",
      "ending": "Il sentiero sospeso brilla fino all’ultima isola."
  }, [
    [-1,".LDL./D...L/R...F/L...L/.FFF."],
    [0,".RBB./R...B/U...D/U...B/.RFF."],
    [1,".RRB./D...L/B...F/B...U/.LDR."],
  ]),
  // 47 pieces · 8 initial exits · 17 dependency layers.
  authoredLevel({
      "id": 20,
      "key": "giardini-05-v2",
      "chapter": 4,
      "name": "Il nido delle correnti",
      "subtitle": "Le fronde si raccolgono in una piccola conca.",
      "artifact": "Nido del vento gentile",
      "reward": "nest",
      "rarity": "rare",
      "focus": "Libera il bordo della conca, poi cerca le frecce sul fondo.",
      "lore": "Aspetta un uovo deposto da un vento che non ha ancora nome.",
      "ending": "Il giardino custodisce di nuovo un luogo dove tornare."
  }, [
    [-2,"...../...../...../.FFL./.UUF."],
    [-1,"...../...../UF.DD/FRURF/.FUL."],
    [0,"...../...../FU.FB/R...R/UUDFU"],
    [1,"...../...../RR.DR/UFDDL/.FFL."],
    [2,"...../...../...../.LUL./.RUU."],
  ]),
  // 41 pieces · 7 initial exits · 14 dependency layers.
  authoredLevel({
      "id": 21,
      "key": "fucina-01-v2",
      "chapter": 5,
      "name": "Brace sotto la cenere",
      "subtitle": "Tre lingue di fuoco cercano spazio.",
      "artifact": "Brace della prima forgia",
      "reward": "ember",
      "rarity": "common",
      "focus": "Le lingue del fuoco si aprono a ritmi diversi: cambia fila.",
      "lore": "Non brucia le mani. Scalda le idee ancora da costruire.",
      "ending": "La fucina si risveglia con un piccolo respiro rosso."
  }, [
    [-1,"..D../U.L../FDL.F/.DRRB/.FRF."],
    [0,"..U../F.B../FF..U/.LLLF/.ULU."],
    [1,"..D../R.B../ULL.U/.UBBL/.UBR."],
  ]),
  // 38 pieces · 7 initial exits · 18 dependency layers.
  authoredLevel({
      "id": 22,
      "key": "fucina-02-v2",
      "chapter": 5,
      "name": "Il colpo silenzioso",
      "subtitle": "Una testa larga, un manico da svelare.",
      "artifact": "Martello degli echi",
      "reward": "hammer",
      "rarity": "uncommon",
      "focus": "Dalla testa al manico, controlla dove prosegue ogni raggio.",
      "lore": "Ogni colpo ripete il suono della prima montagna.",
      "ending": "Un’eco limpida attraversa le sale della fucina."
  }, [
    [-1,"DFRDD/FFFDL/..L../..L../..U.."],
    [0,"ULUBL/FUUUB/...../..D../..F.."],
    [1,"DDBDL/RRRBD/..U../..R../..U.."],
  ]),
  // 55 pieces · 10 initial exits · 16 dependency layers.
  authoredLevel({
      "id": 23,
      "key": "fucina-03-v2",
      "chapter": 5,
      "name": "Il ponte del ferro",
      "subtitle": "Due spalle sostengono un peso invisibile.",
      "artifact": "Incudine delle promesse",
      "reward": "anvil",
      "rarity": "common",
      "focus": "Passa fra le due spalle e osserva i sostegni più bassi.",
      "lore": "Custodisce le promesse che meritano di diventare materia.",
      "ending": "Il ferro riposa, pronto a prendere una forma nuova."
  }, [
    [-2,"...../...../.RDF./..F../.UDU."],
    [-1,"...../BRFFB/.RUU./..U../RUUUF"],
    [0,"...../URFDB/.U.R./..L../ULFLL"],
    [1,"...../DBDFL/.UDL./..D../RRFUR"],
    [2,"...../...../.BLF./..D../.BDB."],
  ]),
  // 48 pieces · 9 initial exits · 19 dependency layers.
  authoredLevel({
      "id": 24,
      "key": "fucina-04-v2",
      "chapter": 5,
      "name": "Denti nel buio",
      "subtitle": "Ogni dente mette in moto il successivo.",
      "artifact": "Ruota del risveglio",
      "reward": "gear",
      "rarity": "uncommon",
      "focus": "Segui un dente fino al mozzo, poi confronta il lato opposto.",
      "lore": "Ha girato per secoli senza perdere un solo istante.",
      "ending": "La grande ruota rimette in moto la fucina."
  }, [
    [-1,".D.L./RFFRF/.F.B./URUFU/.B.U."],
    [0,".R.R./UDLUU/.D.U./ULLLL/.L.U."],
    [1,".B.L./UFULD/.R.B./ULBLL/.U.U."],
  ]),
  // 50 pieces · 9 initial exits · 20 dependency layers.
  authoredLevel({
      "id": 25,
      "key": "fucina-05-v2",
      "chapter": 5,
      "name": "Ali di cenere",
      "subtitle": "Due ali raccolgono l’ultimo bagliore.",
      "artifact": "Fenice della forgia",
      "reward": "phoenix",
      "rarity": "rare",
      "focus": "Le ali si rispondono: cerca il passaggio che collega i loro strati.",
      "lore": "Rinasce dalle cose che abbiamo imparato a lasciare andare.",
      "ending": "La fenice porta la prima scintilla oltre le montagne."
  }, [
    [-2,"...../L...R/FF.FF/...../....."],
    [-1,"U...D/FD.DL/.RRD./..L../.R.F."],
    [0,"R...U/RFRBU/.F.U./.ULD./.B.F."],
    [1,"R...R/UL.LL/.ULU./..B../.B.U."],
    [2,"...../U...B/RF.DU/...../....."],
  ]),
  // 49 pieces · 9 initial exits · 15 dependency layers.
  authoredLevel({
      "id": 26,
      "key": "cittadella-01-v2",
      "chapter": 6,
      "name": "Il cortile riflesso",
      "subtitle": "Una cornice spezzata trattiene il cielo.",
      "artifact": "Specchio del cielo quieto",
      "reward": "mirror",
      "rarity": "common",
      "focus": "Confronta le estremità della cornice prima di seguire il riflesso.",
      "lore": "Mostra il cielo di un luogo in cui ti sei sentito a casa.",
      "ending": "Il cortile riflette di nuovo un cielo sereno."
  }, [
    [-2,"...../.BBU./.R.../.FUU./....."],
    [-1,".RRR./R...B/R...F/U...L/.FFF."],
    [0,".BLF./B...D/B...D/....F/.FLU."],
    [1,".BBL./B...B/F...U/U...L/.ULF."],
    [2,"...../.DDL./...F./.RBB./....."],
  ]),
  // 36 pieces · 6 initial exits · 19 dependency layers.
  authoredLevel({
      "id": 27,
      "key": "cittadella-02-v2",
      "chapter": 6,
      "name": "Il volto senza voce",
      "subtitle": "Due occhi osservano strade differenti.",
      "artifact": "Maschera delle due voci",
      "reward": "mask",
      "rarity": "uncommon",
      "focus": "Gli occhi sono varchi: segui anche le file che li attraversano.",
      "lore": "Ascolta ciò che le parole non riescono ancora a dire.",
      "ending": "La cittadella riconosce il passo di un nuovo ospite."
  }, [
    [-1,".DUB./R.F.R/F...B/.RUF./..D.."],
    [0,".DBD./R.R.D/U...B/.BBF./..F.."],
    [1,".BLL./D.R.B/R...U/.FBL./..U.."],
  ]),
  // 47 pieces · 8 initial exits · 17 dependency layers.
  authoredLevel({
      "id": 28,
      "key": "cittadella-03-v2",
      "chapter": 6,
      "name": "Tre punte per un regno",
      "subtitle": "Le guglie celano passaggi sotto la fascia.",
      "artifact": "Corona delle soglie",
      "reward": "crown",
      "rarity": "common",
      "focus": "Scendi dalle punte alla fascia e cerca le uscite fra le guglie.",
      "lore": "Il suo regno comincia dove qualcuno sceglie di accogliere.",
      "ending": "Le tre torri salutano chi attraversa la cittadella."
  }, [
    [-1,"R.D.B/R.D.R/UDDLF/.R.B./.FLL."],
    [0,"B.L.L/B.B.F/LD.DU/.D.R./.RRR."],
    [1,"F.B.L/R.B.U/RDUDU/.B.L./.DBL."],
  ]),
  // 47 pieces · 8 initial exits · 21 dependency layers.
  authoredLevel({
      "id": 29,
      "key": "cittadella-04-v2",
      "chapter": 6,
      "name": "La luce obliqua",
      "subtitle": "Le facce dividono un unico cammino.",
      "artifact": "Prisma dei sette sentieri",
      "reward": "prism",
      "rarity": "uncommon",
      "focus": "Ruota lungo le facce oblique: la stessa fila cambia aspetto.",
      "lore": "Divide la luce nei colori delle strade ancora possibili.",
      "ending": "Ogni colore trova il proprio sentiero nella pietra."
  }, [
    [-2,"...../..B../.FRF./..U../....."],
    [-1,"..D../.RFF./RRRRF/.RBU./..F.."],
    [0,"..L../.DFD./BL.FU/.RBF./..F.."],
    [1,"...../..D../.URD./RBBDU/.LLL."],
    [2,"...../...../..D../.UBL./..L.."],
  ]),
  // 53 pieces · 10 initial exits · 22 dependency layers.
  authoredLevel({
      "id": 30,
      "key": "cittadella-05-v2",
      "chapter": 6,
      "name": "La porta delle torri",
      "subtitle": "Un ponte tiene unite due alte sentinelle.",
      "artifact": "Castello dei riflessi",
      "reward": "castle",
      "rarity": "rare",
      "focus": "Alterna le torri e verifica i raggi che attraversano il ponte.",
      "lore": "Le sue finestre conservano le luci di tutti i ritorni.",
      "ending": "La porta si apre e la cittadella torna ad abitarsi."
  }, [
    [-2,"...../R...D/F...L/...../....."],
    [-1,"L...L/R...D/RR.FD/UULRR/U...R"],
    [0,"U...R/DF.BL/D...B/BBBUL/B...F"],
    [1,"F...D/F...L/DB.DB/BUDBB/B...L"],
    [2,"...../R...D/D...B/...../....."],
  ]),
  // 42 pieces · 8 initial exits · 16 dependency layers.
  authoredLevel({
      "id": 31,
      "key": "abissi-01-v2",
      "chapter": 7,
      "name": "La perla nella coppa",
      "subtitle": "Un guscio aperto custodisce una luce.",
      "artifact": "Perla delle profondità",
      "reward": "pearl",
      "rarity": "common",
      "focus": "La coppa ha due rive: passa dall’una all’altra per leggere il fondo.",
      "lore": "È nata da una lacrima che il mare ha scelto di proteggere.",
      "ending": "Una luce morbida rischiara il primo abisso."
  }, [
    [-2,"...../...../...../.DFL./....."],
    [-1,"...../.DLL./D...F/.DLL./FFFDL"],
    [0,"...../..B../B...D/U...D/RFDBF"],
    [1,"...../.BLB./B...U/.DLL./LFUUL"],
    [2,"...../...../...../.LUB./....."],
  ]),
  // 48 pieces · 9 initial exits · 20 dependency layers.
  authoredLevel({
      "id": 32,
      "key": "abissi-02-v2",
      "chapter": 7,
      "name": "Rami sotto il mare",
      "subtitle": "Le correnti separano una foresta sommersa.",
      "artifact": "Corallo dei ricordi",
      "reward": "coral",
      "rarity": "uncommon",
      "focus": "Segui ogni ramo fino al tronco e controlla gli incroci nascosti.",
      "lore": "I suoi rami crescono di un ricordo a ogni nuova marea.",
      "ending": "La foresta sommersa riprende a raccontare il mare."
  }, [
    [-2,"F...F/.F.L./FL.LL/.ULU./..U.."],
    [-1,"D...U/.D.B./LL.LL/.LDF./..D.."],
    [0,"F...D/.D.R./UF.RB/.RDU./..L.."],
    [1,"R...F/.L.B./UR.BB/.BBL./..D.."],
  ]),
  // 45 pieces · 8 initial exits · 18 dependency layers.
  authoredLevel({
      "id": 33,
      "key": "abissi-03-v2",
      "chapter": 7,
      "name": "La conchiglia aperta",
      "subtitle": "Costole sottili si raccolgono in un ventaglio.",
      "artifact": "Valva dell’orizzonte",
      "reward": "shell",
      "rarity": "common",
      "focus": "Leggi le costole del ventaglio, poi cerca il loro punto d’incontro.",
      "lore": "Si apre quando sente il nome di una riva sconosciuta.",
      "ending": "Una riva lontana risponde attraverso la conchiglia."
  }, [
    [-2,"...../...../..D../.UFL./..F.."],
    [-1,"R...F/U.L.D/.RUD./.BUL./..U.."],
    [0,"R...F/D.R.U/.U.F./.UFU./..F.."],
    [1,"D...U/B.F.U/.BUF./.ULL./..U.."],
    [2,"...../...../..D../.BLL./..L.."],
  ]),
  // 56 pieces · 10 initial exits · 22 dependency layers.
  authoredLevel({
      "id": 34,
      "key": "abissi-04-v2",
      "chapter": 7,
      "name": "La danza trasparente",
      "subtitle": "Una cupola e fili che oscillano al buio.",
      "artifact": "Medusa delle stelle sommerse",
      "reward": "jellyfish",
      "rarity": "uncommon",
      "focus": "Distingui la cupola dai fili e segui i raggi lungo tutta la profondità.",
      "lore": "Porta sul fondo le costellazioni cadute durante le tempeste.",
      "ending": "Le stelle sommerse tornano a danzare nell’acqua."
  }, [
    [-2,".FBL./RRFRD/R...F/.F.B./.R.U."],
    [-1,".DBL./UDFUL/R...U/.D.D./.D.L."],
    [0,".DLR./BDUDB/B...R/.R.D./.L.L."],
    [1,".DBB./BBUBB/L...L/.F.B./.D.U."],
  ]),
  // 42 pieces · 8 initial exits · 23 dependency layers.
  authoredLevel({
      "id": 35,
      "key": "abissi-05-v2",
      "chapter": 7,
      "name": "Il sonno del gigante",
      "subtitle": "Una lunga schiena curva protegge gli abissi.",
      "artifact": "Leviatano di cristallo",
      "reward": "leviathan",
      "rarity": "rare",
      "focus": "Dalla coda alla testa, cambia lato quando una curva chiude la vista.",
      "lore": "Dorme finché ogni creatura del mare non ha trovato riparo.",
      "ending": "Il gigante apre gli occhi e gli abissi si fanno quieti."
  }, [
    [-2,"...../...../.DRU./B...F/....."],
    [-1,"..DFL/.FD../FL.../.FLU./....L"],
    [0,"..FLB/.RF../.B.../.RRB./....F"],
    [1,"..DUB/.DL../RD.../.RDU./....U"],
    [2,"...../...../.BLL./L...U/....."],
  ]),
  // 44 pieces · 8 initial exits · 17 dependency layers.
  authoredLevel({
      "id": 36,
      "key": "maree-01-v2",
      "chapter": 8,
      "name": "Il peso della quiete",
      "subtitle": "Due braccia trovano un fondale comune.",
      "artifact": "Ancora delle acque calme",
      "reward": "anchor",
      "rarity": "common",
      "focus": "Segui le braccia fino al fusto e controlla la traversa sul retro.",
      "lore": "Sa fermare una nave senza trattenere il desiderio di partire.",
      "ending": "Il labirinto concede un primo approdo tranquillo."
  }, [
    [-1,".RDF./..B../FFDUL/F.D.L/.LFB."],
    [0,".FBF./..B../DF.UB/F.D.U/.RFD."],
    [1,".DBL./..R../DFUUL/R.U.F/.BFL."],
  ]),
  // 49 pieces · 9 initial exits · 21 dependency layers.
  authoredLevel({
      "id": 37,
      "key": "maree-02-v2",
      "chapter": 8,
      "name": "Il dorso della marea",
      "subtitle": "Una cresta piegata nasconde la risacca.",
      "artifact": "Onda del ritorno",
      "reward": "wave",
      "rarity": "uncommon",
      "focus": "La cresta e la risacca si incastrano: cerca le file oltre la curva.",
      "lore": "Torna sempre, ma porta ogni volta un mare diverso.",
      "ending": "La marea ritrova un passaggio fra le pareti del labirinto."
  }, [
    [-2,"...../.FLL./U...F/...../....."],
    [-1,".LRD./RD..D/F...D/.RF../..RRF"],
    [0,".BRB./LF..D/D...D/.RD../..RFF"],
    [1,".RRB./UL..L/F...F/.RD../..RUU"],
    [2,"...../...../...../.RD../..BDD"],
  ]),
  // 41 pieces · 7 initial exits · 19 dependency layers.
  authoredLevel({
      "id": 38,
      "key": "maree-03-v2",
      "chapter": 8,
      "name": "La nave senza ombra",
      "subtitle": "Una vela alta incontra uno scafo sottile.",
      "artifact": "Nave dei porti impossibili",
      "reward": "ship",
      "rarity": "common",
      "focus": "Alterna vela e scafo: il loro incrocio tiene unite le catene.",
      "lore": "Ha gettato l’ancora soltanto nei luoghi che parevano irraggiungibili.",
      "ending": "Un nuovo porto compare sulla carta delle maree."
  }, [
    [-1,"..F../.DUL./RFUF./..R../UFULB"],
    [0,"..F../.UUF./BF.U./..F../RFBBB"],
    [1,"..U../.DBL./BFUU./..U../DRURF"],
  ]),
  // 43 pieces · 8 initial exits · 23 dependency layers.
  authoredLevel({
      "id": 39,
      "key": "maree-04-v2",
      "chapter": 8,
      "name": "La voce nella spirale",
      "subtitle": "Il guscio avvolge un corridoio di luce.",
      "artifact": "Conchiglia delle rotte",
      "reward": "conch",
      "rarity": "uncommon",
      "focus": "Segui la spirale per strati, senza fermarti al primo spazio vuoto.",
      "lore": "Nella sua voce si incontrano tutte le partenze del mondo.",
      "ending": "La conchiglia indica la rotta oltre il labirinto."
  }, [
    [-2,"...../.BRD./.R.F./...D./....."],
    [-1,".FUD./D...F/D.LLF/F.R.U/.DUL."],
    [0,".DRB./D...D/L..UD/R.B.F/.RBD."],
    [1,"...../.RRB./.U.D./.UFB./....."],
  ]),
  // 59 pieces · 11 initial exits · 24 dependency layers.
  authoredLevel({
      "id": 40,
      "key": "maree-05-v2",
      "chapter": 8,
      "name": "Le tre correnti",
      "subtitle": "Tre punte conducono allo stesso fondale.",
      "artifact": "Tridente delle maree",
      "reward": "trident",
      "rarity": "rare",
      "focus": "Confronta le tre punte e libera il raccordo che sostiene le correnti.",
      "lore": "Non comanda il mare: gli ricorda come ritrovare l’equilibrio.",
      "ending": "Le tre correnti si accordano e il labirinto si apre."
  }, [
    [-2,"B.D.L/L.B.F/RFDFU/..B../.UFF."],
    [-1,"D.U.R/B.U.L/RDDRU/..D../.RDU."],
    [0,"R.R.D/F.B.L/UL.RR/..B../.LRU."],
    [1,"B.L.D/R.B.R/ULLLB/..L../.BLL."],
  ]),
  // 46 pieces · 8 initial exits · 18 dependency layers.
  authoredLevel({
      "id": 41,
      "key": "santuario-01-v2",
      "chapter": 9,
      "name": "Un soffio fra le colonne",
      "subtitle": "I fori lasciano passare una melodia.",
      "artifact": "Flauto del primo soffio",
      "reward": "flute",
      "rarity": "common",
      "focus": "I fori separano le file, ma alcuni raggi proseguono oltre il vuoto.",
      "lore": "Ricorda la prima nota suonata dal vento fra le canne.",
      "ending": "Una nota lieve raggiunge il santuario addormentato."
  }, [
    [-2,"...../.DBL./...../.DUL./....."],
    [-1,"FRDFB/U.B.F/BFLFF/F.B.L/ULLUL"],
    [0,"...../D.B.L/L...U/R.F.D/....."],
    [1,"...../B.B.L/ULULU/U.U.U/....."],
  ]),
  // 42 pieces · 8 initial exits · 22 dependency layers.
  authoredLevel({
      "id": 42,
      "key": "santuario-02-v2",
      "chapter": 9,
      "name": "Il cielo legato a un filo",
      "subtitle": "La vela apre due diagonali sopra la coda.",
      "artifact": "Aquilone delle alture",
      "reward": "kite",
      "rarity": "uncommon",
      "focus": "Esplora le diagonali della vela e torna al filo quando si apre un varco.",
      "lore": "Sale più in alto quando chi lo tiene impara a cedere un poco.",
      "ending": "L’aquilone trova la corrente che conduce alle alture."
  }, [
    [-2,"...../...../..U../...../....."],
    [-1,"..F../.UFL./RDUFU/.RRU./..U.."],
    [0,"..L../.RRD./UU.DF/.ULR./..F.."],
    [1,"..D../.BLL./BUFDL/..B../.UL.."],
    [2,"...../...../..D../.RB../B...."],
  ]),
  // 46 pieces · 8 initial exits · 20 dependency layers.
  authoredLevel({
      "id": 43,
      "key": "santuario-03-v2",
      "chapter": 9,
      "name": "Le canne del mattino",
      "subtitle": "Canne diverse aspettano lo stesso soffio.",
      "artifact": "Sonaglio delle correnti",
      "reward": "chime",
      "rarity": "common",
      "focus": "Alterna le canne lunghe e corte: il sostegno nasconde altri passaggi.",
      "lore": "Ogni canna conosce il nome di un vento che verrà domani.",
      "ending": "Le correnti fanno risuonare il mattino nel santuario."
  }, [
    [-2,"...../D.F.L/R.U.R/B...U/....."],
    [-1,"FBDRD/B.F.L/L.L.L/R...B/....."],
    [0,"RBFUB/R.U.R/B...F/B...B/....."],
    [1,"RRDUB/B.D.B/L.L.L/B...B/....."],
  ]),
  // 46 pieces · 8 initial exits · 23 dependency layers.
  authoredLevel({
      "id": 44,
      "key": "santuario-04-v2",
      "chapter": 9,
      "name": "Il richiamo delle vette",
      "subtitle": "Un padiglione raccoglie il fiato delle cime.",
      "artifact": "Fanfara delle alte vette",
      "reward": "fanfare",
      "rarity": "uncommon",
      "focus": "Segui l’apertura del padiglione verso il tubo e controlla i raccordi.",
      "lore": "Il suo richiamo arriva soltanto a chi ha smesso di avere fretta.",
      "ending": "Le vette rispondono, una dopo l’altra, al richiamo."
  }, [
    [-2,"...../...BF/..R.F/..U.L/...FF"],
    [-1,"...../...RD/LFL.L/F.U.L/...DF"],
    [0,"...../....U/BF..U/F.L.L/....U"],
    [1,"...../...RR/DLR.U/R.R.U/...UL"],
    [2,"...../...BU/..F.R/..B.L/...UU"],
  ]),
  // 53 pieces · 10 initial exits · 24 dependency layers.
  authoredLevel({
      "id": 45,
      "key": "santuario-05-v2",
      "chapter": 9,
      "name": "Il custode dell’aria",
      "subtitle": "Ali aperte e artigli sospesi sulla soglia.",
      "artifact": "Grifone dei venti",
      "reward": "griffin",
      "rarity": "rare",
      "focus": "Metti in relazione ali e zampe: le uscite si aprono su facce lontane.",
      "lore": "Veglia sulle strade che esistono soltanto per chi osa alzare lo sguardo.",
      "ending": "Il grifone ti affida la corrente verso il cuore dei mondi."
  }, [
    [-2,"...../F...D/LF.BL/...../....."],
    [-1,"R..DD/RD.FB/.RDD./..F../.F.B."],
    [0,"R..FU/UDLUL/.D.R./.DRU./.R.U."],
    [1,"R..DD/UB.DF/.ULB./..F../.R.F."],
    [2,"...../F...D/FU.LB/...../....."],
  ]),
  // 52 pieces · 9 initial exits · 19 dependency layers.
  authoredLevel({
      "id": 46,
      "key": "cuore-01-v2",
      "chapter": 10,
      "name": "Il segno che respira",
      "subtitle": "Una scrittura antica tiene aperte due soglie.",
      "artifact": "Runa del principio",
      "reward": "rune",
      "rarity": "common",
      "focus": "Segui i tratti della runa e verifica i raggi che uniscono le sue parti.",
      "lore": "Cambia significato ogni volta che qualcuno impara a leggerla.",
      "ending": "Il primo segno si accende nella sala dei mondi."
  }, [
    [-2,"D..D./RD.D./.D.FF/.F.RU/.B..R"],
    [-1,"D..B./BD.L./.B.FL/.F.BU/.L..B"],
    [0,"F..R./BB.L./.U.FR/.L.RD/.F..D"],
    [1,"D..L./BR.D./.F.LR/.R.RU/.U..U"],
  ]),
  // 42 pieces · 8 initial exits · 23 dependency layers.
  authoredLevel({
      "id": 47,
      "key": "cuore-02-v2",
      "chapter": 10,
      "name": "L’occhio dell’orizzonte",
      "subtitle": "Due palpebre circondano un piccolo cielo.",
      "artifact": "Occhio dei mondi lontani",
      "reward": "eye",
      "rarity": "uncommon",
      "focus": "Cerca i passaggi fra le palpebre e osserva il centro da più lati.",
      "lore": "Vede i mondi possibili senza dimenticare quello che abiti.",
      "ending": "Un orizzonte nuovo si apre nel cuore della sala."
  }, [
    [-2,"...../.BFD./F...L/.FUL./....."],
    [-1,".DFL./B...L/R.D.U/U...L/.LRU."],
    [0,".BLD./D...L/D...U/B...U/.FRB."],
    [1,"...../.DFF./D.R.B/.RUR./....."],
  ]),
  // 47 pieces · 8 initial exits · 20 dependency layers.
  authoredLevel({
      "id": 48,
      "key": "cuore-03-v2",
      "chapter": 10,
      "name": "La coppa delle origini",
      "subtitle": "Una vasca luminosa poggia su un solo stelo.",
      "artifact": "Calice della prima luce",
      "reward": "chalice",
      "rarity": "common",
      "focus": "Passa dal bordo allo stelo e controlla la profondità della coppa.",
      "lore": "Raccoglie la luce che avanza quando una notte finisce.",
      "ending": "La prima luce riempie il calice senza traboccare."
  }, [
    [-2,"D...B/R...F/.DLD./..B../.RRF."],
    [-1,"R...B/UL.LF/.RBU./..B../.BRF."],
    [0,"B...L/U...R/.L.U./..D../.BLF."],
    [1,"D...B/LB.BL/.BLR./..U../.BDU."],
  ]),
  // 58 pieces · 10 initial exits · 24 dependency layers.
  authoredLevel({
      "id": 49,
      "key": "cuore-04-v2",
      "chapter": 10,
      "name": "La strada che ritorna",
      "subtitle": "Due anelli si incontrano senza chiudere il viaggio.",
      "artifact": "Nodo dell’infinito",
      "reward": "infinity",
      "rarity": "uncommon",
      "focus": "Attraversa entrambi gli anelli e segui i raggi oltre il loro incontro.",
      "lore": "Ogni ritorno aggiunge una strada al disegno del viaggio.",
      "ending": "Le due strade si riconoscono e il viaggio continua."
  }, [
    [-2,".U.F./R.D.F/..D../R.F.U/.F.F."],
    [-1,".R.F./F.D.F/U...F/R.F.U/.R.U."],
    [0,".U.R./F.B.L/D...U/R.F.U/.D.D."],
    [1,".D.U./F.F.D/B...L/U.U.L/.R.U."],
    [2,".B.U./F.R.R/..D../B.D.B/.U.L."],
  ]),
  // 59 pieces · 10 initial exits · 24 dependency layers.
  authoredLevel({
      "id": 50,
      "key": "cuore-05-v2",
      "chapter": 10,
      "name": "Il cuore dei mondi",
      "subtitle": "Ogni spazio liberato accende una nuova possibilità.",
      "artifact": "Cuore di tutti i mondi",
      "reward": "heart",
      "rarity": "epic",
      "focus": "Riunisci ciò che hai imparato: leggi le sei direzioni attraverso ogni strato.",
      "lore": "Batte in ogni luogo in cui qualcuno fa spazio a una meraviglia.",
      "ending": "Hai aperto cinquanta meraviglie. Ora ogni mondo custodisce il tuo viaggio."
  }, [
    [-2,"...../.F.U./.ULU./..R../....."],
    [-1,".F.L./FFBBL/RUBFU/.UFL./..U.."],
    [0,".F.L./RFFBD/UB.UR/.RDF./..L.."],
    [1,".D.U./LDDBB/RFFUU/.RFU./..B.."],
    [2,"...../.R.R./.FLD./..U../....."],
  ]),
  { id: 0, key: 'tutorial-v1', chapter: 0, name: 'Primi passi',
    subtitle: 'Quattro cubi, una piccola scoperta.', artifact: 'La prima scintilla',
    focus: 'Ruota, osserva una freccia bloccata e trova una via libera.',
    reward: 'seed', rarity: 'common', lore: 'Ogni meraviglia comincia con un piccolo spazio.',
    ending: 'La prima scintilla è accesa. Il bosco ti aspetta.', pieces: [
      { id: 'intro-first', position: [0, -1, 1], direction: [1, 0, 0], color: 2 },
      { id: 'intro-blocked', position: [-1, 0, 1], direction: [1, 0, 0], color: 0 },
      { id: 'intro-blocker', position: [1, 0, 1], direction: [0, 1, 0], color: 1 },
      { id: 'intro-last', position: [0, 1, 0], direction: [0, 1, 0], color: 3 },
    ],
  },
];

export const TUTORIAL_INDEX = LEVELS.findIndex((level) => level.id === 0);
export const CAMPAIGN_INDEXES: readonly number[] = LEVELS.flatMap((level, index) => level.chapter > 0 ? [index] : []);
export const JOURNEY_INDEXES: readonly number[] = [TUTORIAL_INDEX, ...CAMPAIGN_INDEXES];
