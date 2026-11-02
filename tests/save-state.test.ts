import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS, TUTORIAL_INDEX, getExit, solve } from '../src/puzzle.ts';
import { createSaveState, parseSaveState, MAX_SAVE_BYTES, MAX_BEST_TIME_MS } from '../src/save-state.ts';
const first = LEVELS[0];
const other = LEVELS[1];
const tutorial = LEVELS[TUTORIAL_INDEX];
const order = solve(first.pieces)!;
const encode = (value: object) => JSON.stringify({ ...createSaveState(), ...value });

test('corrupt, unsupported and oversized saves reset safely', () => {
  for (const raw of [null, '', '{', 'null', '[]', '{"version":9}', ' '.repeat(MAX_SAVE_BYTES + 1)]) assert.deepEqual(parseSaveState(raw), createSaveState());
});
test('stable keys resume chronological undo history independently of catalog order', () => {
  const state = parseSaveState(encode({ activeLevel: other.key, levels: { [first.key]: { removedIds: order.slice(0, 5) } } }));
  assert.equal(state.activeLevel, other.key);
  assert.deepEqual(state.levels[first.key].removedIds, order.slice(0, 5));
  const a = LEVELS[0]; const b = LEVELS[1];
  try {
    LEVELS[0] = b; LEVELS[1] = a;
    assert.deepEqual(parseSaveState(JSON.stringify(state)), state);
  } finally { LEVELS[0] = a; LEVELS[1] = b; }
});
test('unknown keys and duplicate completed entries are normalized', () => {
  const state = parseSaveState(encode({ activeLevel: 'retired', completed: [other.key, first.key, other.key, -1, 'retired'], levels: { retired: { removedIds: order }, '__proto__': {} } }));
  assert.equal(state.activeLevel, tutorial.key);
  assert.deepEqual(state.completed, [first.key, other.key].sort());
  assert.deepEqual(state.levels, {});
});
test('unknown and repeated ids discard the invalid suffix', () => {
  for (const invalid of ['unknown', order[0], null]) {
    const state = parseSaveState(encode({ levels: { [first.key]: { removedIds: [order[0], invalid, order[1]] } } }));
    assert.deepEqual(state.levels[first.key].removedIds, [order[0]]);
  }
});
test('blocked removal cannot be restored from storage', () => {
  const blocked = first.pieces.find((piece) => !getExit(piece, first.pieces).free)!;
  assert.ok(blocked);
  const state = parseSaveState(encode({ levels: { [first.key]: { removedIds: [blocked.id, ...order] }, [other.key]: { removedIds: [] } } }));
  assert.deepEqual(state.levels[first.key].removedIds, []);
  assert.deepEqual(state.levels[other.key].removedIds, []);
});
test('complete histories imply permanent discovery; resetting histories preserves it', () => {
  const state = parseSaveState(encode({ levels: { [first.key]: { removedIds: order } } }));
  assert.deepEqual(state.completed, [first.key]);
  state.levels[first.key].removedIds = [];
  assert.deepEqual(parseSaveState(JSON.stringify(state)).completed, [first.key]);
});
test('defaults, parsed results and source levels are isolated', () => {
  const count = first.pieces.length;
  const state = parseSaveState(encode({ levels: { [first.key]: { removedIds: order.slice(0, 2) } } }));
  state.levels[first.key].removedIds.push('bad'); state.completed.push(other.key); state.bestTimes[first.key] = 1;
  assert.deepEqual(createSaveState(), { version: 2, activeLevel: tutorial.key, completed: [], levels: {}, bestTimes: {}, tutorial: { rotated: false, blockedSeen: false } });
  assert.deepEqual(parseSaveState(encode({ levels: { [first.key]: { removedIds: order.slice(0, 2) } } })).levels[first.key].removedIds, order.slice(0, 2));
  assert.equal(first.pieces.length, count);
});
test('version 1 migration keeps only tutorial history, completion and tutorial flags', () => {
  const tutorialOrder = solve(tutorial.pieces)!;
  const old = { version: 1, activeLevel: 3, completed: [0, 1, 2], levels: { '0': { removedIds: order }, '3': { removedIds: tutorialOrder.slice(0, 2) } }, tutorial: { rotated: true, blockedSeen: 'true' } };
  const state = parseSaveState(JSON.stringify(old));
  assert.equal(state.activeLevel, tutorial.key);
  assert.deepEqual(state.completed, []);
  assert.deepEqual(state.levels, { [tutorial.key]: { removedIds: tutorialOrder.slice(0, 2) } });
  assert.deepEqual(state.tutorial, { rotated: true, blockedSeen: false });
  const completed = parseSaveState(JSON.stringify({ ...old, completed: [3] }));
  assert.equal(completed.activeLevel, first.key);
  assert.deepEqual(completed.completed, [tutorial.key]);
  assert.equal(parseSaveState(JSON.stringify({ ...old, activeLevel: 1 })).activeLevel, first.key);
  const full = parseSaveState(JSON.stringify({ ...old, levels: { '3': { removedIds: tutorialOrder } } }));
  assert.equal(full.activeLevel, first.key);
  assert.deepEqual(full.completed, [tutorial.key]);
});
test('personal bests accept only finite positive bounded integer milliseconds and known keys', () => {
  for (const invalid of [0,-1,0.5,MAX_BEST_TIME_MS + 1,'100',null,Number.NaN,Infinity]) {
    assert.deepEqual(parseSaveState(encode({ bestTimes: { [first.key]: invalid } })).bestTimes, {});
  }
  assert.deepEqual(parseSaveState(encode({ bestTimes: { [first.key]: MAX_BEST_TIME_MS, retired: 10 } })).bestTimes, { [first.key]: MAX_BEST_TIME_MS });
});
test('oversized unknown histories are ignored without iterating their values', () => {
  const state = parseSaveState(encode({ levels: { retired: { removedIds: Array(10000).fill('unknown') }, [first.key]: { removedIds: order.slice(0,1) } } }));
  assert.deepEqual(state.levels, { [first.key]: { removedIds: order.slice(0,1) } });
});
test('full solution proof survives reset and incomplete or illegal proof is discarded', () => {
  const completed = parseSaveState(encode({ levels: { [first.key]: { removedIds: order } } }));
  assert.deepEqual(completed.levels[first.key].solutionIds, order);
  completed.levels[first.key].removedIds = [];
  assert.deepEqual(parseSaveState(JSON.stringify(completed)).levels[first.key].solutionIds, order);
  const fromProof = parseSaveState(encode({ levels: { [first.key]: { removedIds: [], solutionIds: order } } }));
  assert.deepEqual(fromProof.completed, [first.key]);
  for (const invalid of [order.slice(0,-1), [order[0], ...order.slice(0,-1)], ['unknown', ...order.slice(1)]]) {
    const state = parseSaveState(encode({ levels: { [first.key]: { removedIds: [], solutionIds: invalid } } }));
    assert.equal(state.levels[first.key].solutionIds, undefined);
    assert.deepEqual(state.completed, []);
  }
});

test('expanded campaign histories and original fifteen-level saves round-trip without changing identities', () => {
  const last = LEVELS.find(level => level.id === 50)!;
  assert.ok(last);
  const finalOrder = solve(last.pieces)!;
  const previous = LEVELS.find(level => level.id === 15)!;
  const previousOrder = solve(previous.pieces)!;
  const raw = encode({ activeLevel: last.key, completed: [first.key, previous.key, tutorial.key], levels: {
    [previous.key]: { removedIds: previousOrder.slice(0, 4) },
    [last.key]: { removedIds: finalOrder.slice(0, 7), solutionIds: finalOrder },
  }, bestTimes: { [first.key]: 12345, [last.key]: 98765 }, tutorial: { rotated: true, blockedSeen: true } });
  const parsed = parseSaveState(raw);
  assert.equal(parsed.activeLevel, last.key);
  assert.deepEqual(parsed.levels[previous.key].removedIds, previousOrder.slice(0, 4));
  assert.deepEqual(parsed.levels[last.key], { removedIds: finalOrder.slice(0, 7), solutionIds: finalOrder });
  assert.ok(parsed.completed.includes(last.key));
  assert.deepEqual(parsed.bestTimes, { [first.key]: 12345, [last.key]: 98765 });
  assert.deepEqual(parseSaveState(JSON.stringify(parsed)), parsed);
});

test('attempts and earned rarity round-trip without changing the six-field version two envelope', () => {
  const attempt = { elapsedMs: 12_345, hintsUsed: 3, hintWaitMs: 8_000, eligible: true, finished: false };
  const state = parseSaveState(encode({ levels: { [first.key]: { removedIds: order.slice(0, 3), attempt, rarity: 'rare' } } }));
  assert.deepEqual(state.levels[first.key], { removedIds: order.slice(0, 3), attempt, rarity: 'rare' });
  assert.deepEqual(Object.keys(state), ['version', 'activeLevel', 'completed', 'levels', 'bestTimes', 'tutorial']);
  assert.deepEqual(parseSaveState(JSON.stringify(state)), state);
});

test('invalid optional counters and flags fail closed while unknown properties are removed', () => {
  const valid = { elapsedMs: 12_345, hintsUsed: 2, hintWaitMs: 8_000, eligible: true, finished: false };
  for (const invalid of [{ elapsedMs: -1 }, { elapsedMs: MAX_BEST_TIME_MS + 1 }, { hintsUsed: 0 }, { hintWaitMs: 30_001 }, { eligible: 'true' }, { finished: 'false' }]) {
    const state = parseSaveState(encode({ levels: { [first.key]: { removedIds: order.slice(0, 2), attempt: { ...valid, ...invalid }, rarity: 'legendary' } } }));
    assert.equal(state.levels[first.key].attempt?.eligible, false);
    assert.equal(state.levels[first.key].rarity, undefined);
  }
  const state = parseSaveState(encode({ levels: { [first.key]: { removedIds: [], attempt: { ...valid, extra: true }, rarity: 'common', extra: true } } }));
  assert.deepEqual(state.levels[first.key], { removedIds: [], attempt: valid, rarity: 'common' });
});

test('history truncation disqualifies its clock and a complete history cannot resume its clock', () => {
  const attempt = { elapsedMs: 10_000, hintsUsed: 0, hintWaitMs: 0, eligible: true, finished: false };
  const invalid = parseSaveState(encode({ levels: { [first.key]: { removedIds: [order[0], 'bad'], attempt } } }));
  assert.equal(invalid.levels[first.key].attempt?.eligible, false);
  const complete = parseSaveState(encode({ levels: { [first.key]: { removedIds: order, attempt } } }));
  assert.equal(complete.levels[first.key].attempt?.finished, true);
  complete.levels[first.key].removedIds.pop();
  assert.equal(parseSaveState(JSON.stringify(complete)).levels[first.key].attempt?.finished, true);
});
