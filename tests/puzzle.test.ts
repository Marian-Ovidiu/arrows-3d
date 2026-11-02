import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CATALOG_VERSION, CHAPTERS, CAMPAIGN_INDEXES, JOURNEY_INDEXES, LEVELS, TUTORIAL_INDEX, getExit, getAvailable, solve } from '../src/puzzle.ts';
import type { Piece, Vec3 } from '../src/puzzle.ts';

const axes: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const piece = (id: string, position: Vec3, direction: Vec3 = [1, 0, 0]): Piece => ({ id, position, direction, color: 0 });

function dependencyLayers(pieces: readonly Piece[]): number {
  let remaining = [...pieces];
  let layers = 0;
  while (remaining.length) {
    const free = new Set(getAvailable(remaining).map(p => p.id));
    assert.ok(free.size > 0, 'every layer must expose another exit');
    remaining = remaining.filter(p => !free.has(p.id));
    layers++;
  }
  return layers;
}

test('the catalog has fifty unique collection identities, ten chapters and a separate exact tutorial', () => {
  assert.equal(CATALOG_VERSION, 'fantasy-v2');
  assert.equal(LEVELS.length, 51);
  assert.equal(TUTORIAL_INDEX, LEVELS.findIndex(level => level.id === 0));
  assert.equal(TUTORIAL_INDEX, LEVELS.length - 1);
  assert.deepEqual(CAMPAIGN_INDEXES, LEVELS.flatMap((level, index) => level.chapter > 0 ? [index] : []));
  assert.deepEqual(JOURNEY_INDEXES, [TUTORIAL_INDEX, ...CAMPAIGN_INDEXES]);
  assert.deepEqual(CHAPTERS.map(chapter => chapter.name), ['Bosco dei sussurri', 'Osservatorio perduto', 'Archivio dei mondi', 'Giardini sospesi', 'Fucina degli echi', 'Cittadella degli specchi', 'Abissi di cristallo', 'Labirinto delle maree', 'Santuario dei venti', 'Cuore dei mondi']);
  assert.deepEqual(CHAPTERS.map(chapter => chapter.id), Array.from({ length: 10 }, (_, i) => i + 1));
  assert.equal(new Set(LEVELS.map(level => level.key)).size, 51);
  const campaign = CAMPAIGN_INDEXES.map(index => LEVELS[index]);
  assert.deepEqual(campaign.map(level => level.id), Array.from({ length: 50 }, (_, i) => i + 1));
  assert.equal(new Set(campaign.map(level => level.reward)).size, 50);
  assert.equal(new Set(campaign.map(level => level.artifact)).size, 50);
  assert.deepEqual(campaign.slice(0, 15).reduce<Record<string, number>>((counts, level) => {
    counts[level.rarity] = (counts[level.rarity] ?? 0) + 1;
    return counts;
  }, {}), { common: 8, uncommon: 4, rare: 2, epic: 1 });
  assert.equal(campaign.findIndex(level => level.rarity === 'uncommon'), 2);
  assert.deepEqual(campaign.slice(0, 15).filter(level => level.rarity === 'rare').map(level => level.id), [5, 10]);
  assert.equal(campaign[14].rarity, 'epic');
  for (const [index, level] of campaign.entries()) {
    assert.equal(level.chapter, Math.floor(index / 5) + 1);
    const slug = ['bosco', 'osservatorio', 'archivio', 'giardini', 'fucina', 'cittadella', 'abissi', 'maree', 'santuario', 'cuore'][level.chapter - 1];
    assert.equal(level.key, `${slug}-${String(index % 5 + 1).padStart(2, '0')}-v${index < 15 ? 1 : 2}`);
    for (const copy of [level.name, level.subtitle, level.artifact, level.focus, level.lore, level.ending]) assert.ok(copy.trim().length > 10);
    for (const p of level.pieces) assert.equal(p.id, `${level.key}:${p.position.join(',')}`);
  }
  for (const chapter of CHAPTERS) assert.equal(campaign.filter(level => level.chapter === chapter.id).length, 5);
  assert.deepEqual(campaign.slice(15).map(level => level.reward), [
    'bell', 'feather', 'flower', 'lantern', 'nest',
    'ember', 'hammer', 'anvil', 'gear', 'phoenix',
    'mirror', 'mask', 'crown', 'prism', 'castle',
    'pearl', 'coral', 'shell', 'jellyfish', 'leviathan',
    'anchor', 'wave', 'ship', 'conch', 'trident',
    'flute', 'kite', 'chime', 'fanfare', 'griffin',
    'rune', 'eye', 'chalice', 'infinity', 'heart',
  ]);
  const tutorial = LEVELS[TUTORIAL_INDEX];
  assert.equal(tutorial.key, 'tutorial-v1');
  assert.equal(tutorial.chapter, 0);
  assert.deepEqual(tutorial.pieces, [
    { id: 'intro-first', position: [0, -1, 1], direction: [1, 0, 0], color: 2 },
    { id: 'intro-blocked', position: [-1, 0, 1], direction: [1, 0, 0], color: 0 },
    { id: 'intro-blocker', position: [1, 0, 1], direction: [0, 1, 0], color: 1 },
    { id: 'intro-last', position: [0, 1, 0], direction: [0, 1, 0], color: 3 },
  ]);
});

test('the original fifteen published levels and tutorial retain their complete data', () => {
  // Baseline hashes include every metadata field, ID, position, arrow and color.
  // Changing formatting is harmless; changing any published content is detected.
  const baseline = [
    '15a65062d8d21442bde1abaa0de9118d03c3ce5d00347f37b2eaf8fa9ed62b36',
    '11825ba82110ed9a087a81978baca46c3335f094e2e836630000560f14084b9f',
    '9858d18070a48365f446c3fa3547efa1437689a559979997796ecd74c2a66933',
    'f491f3dad23a9763574d55ebc8803e744592e1cea1848266a286df79d0e40181',
    '156d5f0ed52a1622d09c1246db4da7397019f2e85a8989a8d4182d8a94c7e5b4',
    'cf954af42de096f1edf11846ec67a09c5dd7aaeef859562a7b59fb083de6d514',
    '3f955d0afb680151b7c0cbd57ff9fa42a9e4ce5c9f52a8b470d1062cf65181fb',
    '4b9054c310debdb6b7512a35d84a80cc9bd07e90ebc813b471108e8775980f37',
    '5bbf8a4c33d550959797a9a80159dbd402216cabb3b5c405c464fce99e8101db',
    'b02c64a7455d36ed07d03513137440abc6cc4dbe0f09a615fcf7243784eeea00',
    '3aa910d6e7c4e1ced4160a5315efd6e6661fe021eda8d4f279669a7421823df8',
    'da00bad3cb0145f404cbec2e177c235e81ced4c416906ba7381157936dbc1a4e',
    '591c5ce6c80cfdf714b67e18a671e1c33247496c70211f88bd1353ccbd40b255',
    'b94dfd0d2d94c316f5bdb8b8c3a2fffeafe5ea157b77949cd4d064a640a18369',
    '3812c950792799066060d96995157c3949103e945d88ccf3eb36210738e1edad',
    'bbcc66e555a1e3d056ee97f655e15b038ca1e16c6b1c5ef85f3abc0fe55f67b0',
  ];
  const retained = [...LEVELS.slice(0, 15), LEVELS[TUTORIAL_INDEX]];
  assert.deepEqual(retained.map(level => createHash('sha256').update(JSON.stringify(level)).digest('hex')), baseline);
});

test('authored progression balances gentle entry, branching exits and longer dependency chains', () => {
  // [pieces, initially free, simultaneous removal layers]. These are measured
  // constraints on actual fixed diagrams, not labels inferred from level order.
  const expected = [
    [8, 3, 3], [10, 3, 4], [12, 3, 4], [16, 7, 4], [18, 3, 6],
    [24, 9, 8], [28, 5, 9], [32, 6, 9], [30, 5, 10], [36, 6, 11],
    [44, 8, 13], [36, 6, 12], [48, 8, 15], [56, 10, 16], [64, 12, 18],
    [39, 7, 12], [37, 7, 14], [48, 9, 13], [36, 6, 16], [47, 8, 17],
    [41, 7, 14], [38, 7, 18], [55, 10, 16], [48, 9, 19], [50, 9, 20],
    [49, 9, 15], [36, 6, 19], [47, 8, 17], [47, 8, 21], [53, 10, 22],
    [42, 8, 16], [48, 9, 20], [45, 8, 18], [56, 10, 22], [42, 8, 23],
    [44, 8, 17], [49, 9, 21], [41, 7, 19], [43, 8, 23], [59, 11, 24],
    [46, 8, 18], [42, 8, 22], [46, 8, 20], [46, 8, 23], [53, 10, 24],
    [52, 9, 19], [42, 8, 23], [47, 8, 20], [58, 10, 24], [59, 10, 24],
  ];
  const campaign = CAMPAIGN_INDEXES.map(index => LEVELS[index]);
  const measured = campaign.map(level => [level.pieces.length, getAvailable(level.pieces).length, dependencyLayers(level.pieces)]);
  assert.deepEqual(measured, expected);
  assert.ok(measured.slice(0, 3).every(([pieces, free, depth]) => pieces <= 12 && free >= 3 && depth <= 4));
  assert.ok(measured.slice(0, 5).every(([pieces, , depth]) => pieces <= 18 && depth <= 6));
  assert.ok(measured.slice(10).every(([pieces, , depth]) => pieces >= 36 && pieces <= 64 && depth >= 12 && depth <= 24));
  for (let chapter = 1; chapter < 3; chapter++) {
    const average = (start: number) => measured.slice(start, start + 5).reduce((sum, metric) => sum + metric[2], 0) / 5;
    assert.ok(average(chapter * 5) > average((chapter - 1) * 5) + 3);
  }
  // New chapters breathe after their finale and alternate challenge with a
  // shorter reading. Shape size alone does not define puzzle difficulty.
  assert.ok(measured[15][0] < measured[14][0]);
  assert.ok(measured[15][2] < measured[14][2]);
  for (let start = 15; start < 50; start += 5) {
    const chapter = measured.slice(start, start + 5);
    assert.ok(chapter[2][2] < chapter[1][2], `chapter ${start / 5 + 1} needs a breathing level`);
    assert.ok(chapter[4][2] > chapter[0][2], `chapter ${start / 5 + 1} needs a deeper finale`);
    if (start > 15) assert.ok(chapter[0][2] < measured[start - 1][2]);
  }
  assert.ok(measured.filter(([pieces], i) => i > 0 && pieces < measured[i - 1][0]).length >= 2);
  assert.equal(new Set(campaign.map(level => level.pieces.map(p => p.position.join(',')).sort().join(';'))).size, 50);
});

test('all fifty sculptures are distinct even under the twenty-four cube rotations', () => {
  const permutations = [[0,1,2], [0,2,1], [1,0,2], [1,2,0], [2,0,1], [2,1,0]];
  const rotations: ((p: Vec3) => Vec3)[] = [];
  for (const permutation of permutations) {
    const inversions = permutation.reduce((n, value, i) => n + permutation.slice(i + 1).filter(v => v < value).length, 0);
    for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) {
      if (a * b * c * (-1) ** inversions !== 1) continue;
      rotations.push(p => [p[permutation[0]] * a, p[permutation[1]] * b, p[permutation[2]] * c]);
    }
  }
  assert.equal(rotations.length, 24);
  const canonical = (pieces: Piece[]) => rotations.map(rotate => pieces.map(p => rotate(p.position).join(',')).sort().join(';')).sort()[0];
  const seen = new Map<string, string>();
  for (const index of CAMPAIGN_INDEXES) {
    const level = LEVELS[index];
    const shape = canonical(level.pieces);
    assert.equal(seen.get(shape), undefined, `${level.key} repeats the geometry of ${seen.get(shape)}`);
    seen.set(shape, level.key);
  }
});

test('levels have unique cells, valid arrows and a substantial blocked population', () => {
  for (const level of LEVELS) {
    assert.equal(new Set(level.pieces.map((p) => p.position.join(','))).size, level.pieces.length);
    assert.equal(new Set(level.pieces.map((p) => p.id)).size, level.pieces.length);
    if (level.id !== 0) {
      assert.equal(new Set(level.pieces.map((p) => p.direction.join(','))).size, 6);
      assert.ok(getAvailable(level.pieces).length <= level.pieces.length / 2, `${level.name}: too many clear arrows`);
      assert.ok(getAvailable(level.pieces).length >= 3, `${level.name}: needs several entry points`);
    }
    for (const p of level.pieces) {
      assert.notDeepEqual(p.position, [0, 0, 0]);
      assert.ok(p.position.every(Number.isInteger));
      assert.ok(p.position.every(coordinate => coordinate >= -2 && coordinate <= 2));
      assert.ok(axes.some((axis) => axis.join() === p.direction.join()));
      assert.ok(Number.isInteger(p.color) && p.color >= 0 && p.color <= 4);
      assert.equal(getExit(p, [p]).free, true, `${level.name}: permanent core trap`);
    }
    assert.ok(level.pieces.length <= 64);
  }
});

test('the infinite exit ray finds the nearest blocker in all six directions', () => {
  for (const direction of axes) {
    const origin: Vec3 = [10, 10, 10];
    const at = (distance: number): Vec3 => origin.map((v, index) => v + distance * direction[index]) as Vec3;
    const selected = piece('selected', origin, direction);
    const near = piece('near', at(2));
    const far = piece('far', at(25));
    const behind = piece('behind', at(-1));
    const offRay = piece('off', [11, 12, 13]);
    assert.deepEqual(getExit(selected, [far, selected, near, behind, offRay]), { free: false, blockerId: 'near', distance: 2 });
    assert.deepEqual(getExit(selected, [selected, behind, offRay]), { free: true, blockerId: null, distance: Infinity });
  }
});

test('the central core remains solid even after every piece is removed', () => {
  for (const direction of axes) {
    const selected = piece('selected', direction.map((v) => -v * 3) as Vec3, direction);
    const near = piece('near', direction.map((v) => -v) as Vec3);
    assert.deepEqual(getExit(selected, [selected]), { free: false, blockerId: 'core', distance: 3 });
    assert.deepEqual(getExit(selected, [selected, near]), { free: false, blockerId: 'near', distance: 2 });
  }
});

test('solver orders are legal, complete and do not mutate levels', () => {
  for (const level of LEVELS) {
    const snapshot = JSON.stringify(level);
    const order = solve(level.pieces);
    assert.ok(order);
    let remaining = [...level.pieces];
    for (const id of order) {
      const selected = remaining.find((p) => p.id === id);
      assert.ok(selected);
      assert.equal(getExit(selected, remaining).free, true);
      remaining = remaining.filter((p) => p.id !== id);
    }
    assert.equal(remaining.length, 0);
    assert.equal(JSON.stringify(level), snapshot);
  }
  assert.deepEqual(solve([]), []);
  assert.equal(solve([piece('core-bound', [-1, 0, 0])]), null);
});

test('many deterministic random legal removal orders never deadlock', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 40; seed++) {
      let state = seed;
      let remaining = [...level.pieces];
      while (remaining.length) {
        const available = getAvailable(remaining);
        assert.ok(available.length > 0, `${level.name}, seed ${seed}`);
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        const selected = available[state % available.length];
        remaining = remaining.filter((p) => p.id !== selected.id);
      }
    }
  }
});


test('tutorial starts with a clear exit and one visible two-cell blocking corridor', () => {
  const pieces = LEVELS[TUTORIAL_INDEX].pieces;
  assert.equal(pieces.length, 4);
  const first = pieces.find(p => p.id === 'intro-first')!;
  const blocked = pieces.find(p => p.id === 'intro-blocked')!;
  assert.equal(getExit(first, pieces).free, true);
  assert.deepEqual(getExit(blocked, pieces), { free: false, blockerId: 'intro-blocker', distance: 2 });
  assert.equal(getExit(blocked, pieces.filter(p => p.id !== 'intro-blocker')).free, true);
});
