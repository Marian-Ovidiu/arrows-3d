import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, TUTORIAL_INDEX, getExit, getAvailable, solve } from '../src/puzzle.ts';
import type { Piece, Vec3 } from '../src/puzzle.ts';

const axes: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const piece = (id: string, position: Vec3, direction: Vec3 = [1, 0, 0]): Piece => ({ id, position, direction, color: 0 });

test('levels have unique cells, valid arrows and a substantial blocked population', () => {
  assert.equal(LEVELS[0].pieces.length, 26);
  assert.ok(LEVELS[1].pieces.length >= 32 && LEVELS[1].pieces.length <= 56);
  assert.ok(LEVELS[2].pieces.length >= 56 && LEVELS[2].pieces.length <= 80);
  for (const level of LEVELS) {
    assert.equal(new Set(level.pieces.map((p) => p.position.join(','))).size, level.pieces.length);
    assert.equal(new Set(level.pieces.map((p) => p.id)).size, level.pieces.length);
    if (level.id !== 0) {
      assert.equal(new Set(level.pieces.map((p) => p.direction.join(','))).size, 6);
      assert.ok(getAvailable(level.pieces).length <= level.pieces.length / 2, `${level.name}: too many clear arrows`);
    }
    for (const p of level.pieces) {
      assert.notDeepEqual(p.position, [0, 0, 0]);
      assert.ok(p.position.every(Number.isInteger));
      assert.ok(axes.some((axis) => axis.join() === p.direction.join()));
      assert.ok(Number.isInteger(p.color) && p.color >= 0 && p.color <= 4);
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
