import test from 'node:test';
import assert from 'node:assert/strict';
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

test('the catalog has fifteen stable collection identities and a separate exact tutorial', () => {
  assert.equal(CATALOG_VERSION, 'fantasy-v1');
  assert.equal(LEVELS.length, 16);
  assert.equal(TUTORIAL_INDEX, 15);
  assert.deepEqual(CAMPAIGN_INDEXES, Array.from({ length: 15 }, (_, i) => i));
  assert.deepEqual(JOURNEY_INDEXES, [15, ...CAMPAIGN_INDEXES]);
  assert.deepEqual(CHAPTERS.map(chapter => chapter.name), ['Bosco dei sussurri', 'Osservatorio perduto', 'Archivio dei mondi']);
  assert.equal(new Set(LEVELS.map(level => level.key)).size, 16);
  const campaign = CAMPAIGN_INDEXES.map(index => LEVELS[index]);
  assert.deepEqual(campaign.map(level => level.id), Array.from({ length: 15 }, (_, i) => i + 1));
  assert.equal(new Set(campaign.map(level => level.reward)).size, 15);
  assert.equal(new Set(campaign.map(level => level.artifact)).size, 15);
  assert.deepEqual(campaign.reduce<Record<string, number>>((counts, level) => {
    counts[level.rarity] = (counts[level.rarity] ?? 0) + 1;
    return counts;
  }, {}), { common: 8, uncommon: 4, rare: 2, epic: 1 });
  assert.equal(campaign.findIndex(level => level.rarity === 'uncommon'), 2);
  assert.deepEqual(campaign.filter(level => level.rarity === 'rare').map(level => level.id), [5, 10]);
  assert.equal(campaign[14].rarity, 'epic');
  for (const [index, level] of campaign.entries()) {
    assert.equal(level.chapter, Math.floor(index / 5) + 1);
    assert.equal(level.key, `${['bosco', 'osservatorio', 'archivio'][level.chapter - 1]}-${String(index % 5 + 1).padStart(2, '0')}-v1`);
    for (const copy of [level.name, level.subtitle, level.artifact, level.focus, level.lore, level.ending]) assert.ok(copy.trim().length > 10);
    for (const p of level.pieces) assert.equal(p.id, `${level.key}:${p.position.join(',')}`);
  }
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

test('authored progression balances gentle entry, branching exits and longer dependency chains', () => {
  // [pieces, initially free, simultaneous removal layers]. These are measured
  // constraints on actual fixed diagrams, not labels inferred from level order.
  const expected = [
    [8, 3, 3], [10, 3, 4], [12, 3, 4], [16, 7, 4], [18, 3, 6],
    [24, 9, 8], [28, 5, 9], [32, 6, 9], [30, 5, 10], [36, 6, 11],
    [44, 8, 13], [36, 6, 12], [48, 8, 15], [56, 10, 16], [64, 12, 18],
  ];
  const campaign = CAMPAIGN_INDEXES.map(index => LEVELS[index]);
  const measured = campaign.map(level => [level.pieces.length, getAvailable(level.pieces).length, dependencyLayers(level.pieces)]);
  assert.deepEqual(measured, expected);
  assert.ok(measured.slice(0, 3).every(([pieces, free, depth]) => pieces <= 12 && free >= 3 && depth <= 4));
  assert.ok(measured.slice(0, 5).every(([pieces, , depth]) => pieces <= 18 && depth <= 6));
  assert.ok(measured.slice(10).every(([pieces, , depth]) => pieces >= 36 && pieces <= 65 && depth >= 12));
  for (let chapter = 1; chapter < 3; chapter++) {
    const average = (start: number) => measured.slice(start, start + 5).reduce((sum, metric) => sum + metric[2], 0) / 5;
    assert.ok(average(chapter * 5) > average((chapter - 1) * 5) + 3);
  }
  // Smaller silhouettes can still require deeper reading; progression is not
  // fifteen increasingly large copies of the same solid cube.
  assert.ok(measured.filter(([pieces], i) => i > 0 && pieces < measured[i - 1][0]).length >= 2);
  assert.equal(new Set(campaign.map(level => level.pieces.map(p => p.position.join(',')).sort().join(';'))).size, 15);
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
      assert.ok(axes.some((axis) => axis.join() === p.direction.join()));
      assert.ok(Number.isInteger(p.color) && p.color >= 0 && p.color <= 4);
      assert.equal(getExit(p, [p]).free, true, `${level.name}: permanent core trap`);
    }
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
