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
  | 'key' | 'hourglass' | 'portal' | 'star' | 'world';
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
export const CATALOG_VERSION = 'fantasy-v1';

export const CHAPTERS = [
  { id: 1, name: 'Bosco dei sussurri', description: 'Piccoli sentieri custodiscono le prime meraviglie.' },
  { id: 2, name: 'Osservatorio perduto', description: 'Segui orbite dimenticate e ritrova la via delle stelle.' },
  { id: 3, name: 'Archivio dei mondi', description: 'Apri le soglie dove ogni oggetto conserva un universo.' },
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

export const TUTORIAL_INDEX = 15;
export const CAMPAIGN_INDEXES: readonly number[] = Array.from({ length: 15 }, (_, index) => index);
export const JOURNEY_INDEXES: readonly number[] = [TUTORIAL_INDEX, ...CAMPAIGN_INDEXES];
