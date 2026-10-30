import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS, TUTORIAL_INDEX, getExit, solve } from '../src/puzzle.ts';
import { createSaveState, parseSaveState } from '../src/save-state.ts';

const order = solve(LEVELS[0].pieces)!;
const encode = (value: object) => JSON.stringify({ ...createSaveState(), ...value });

test('corrupt, unsupported and oversized saves reset safely', () => {
  for (const raw of [null, '', '{', 'null', '[]', '{"version":2}', ' '.repeat(100_001)]) {
    assert.deepEqual(parseSaveState(raw), createSaveState());
  }
});

test('valid progress resumes with chronological undo history', () => {
  const state = parseSaveState(encode({ activeLevel: 1, levels: { '0': { removedIds: order.slice(0, 5) } } }));
  assert.equal(state.activeLevel, 1);
  assert.deepEqual(state.levels['0'].removedIds, order.slice(0, 5));
});

test('invalid indexes and duplicate completed entries are normalized', () => {
  const state = parseSaveState(encode({ activeLevel: -1, completed: [2, 0, 2, -1, 99, '1', 0.5], levels: { '-1': { removedIds: order }, '__proto__': {} } }));
  assert.equal(state.activeLevel, TUTORIAL_INDEX);
  assert.deepEqual(state.completed, [0, 2]);
  assert.deepEqual(state.levels, {});
});

test('unknown and repeated ids discard the invalid suffix', () => {
  for (const invalid of ['unknown', order[0], null]) {
    const state = parseSaveState(encode({ levels: { '0': { removedIds: [order[0], invalid, order[1]] } } }));
    assert.deepEqual(state.levels['0'].removedIds, [order[0]]);
  }
});

test('a blocked removal cannot be restored from storage', () => {
  const blocked = LEVELS[0].pieces.find((piece) => !getExit(piece, LEVELS[0].pieces).free)!;
  assert.ok(blocked);
  const state = parseSaveState(encode({ levels: { '0': { removedIds: [blocked.id, ...order] }, '1': { removedIds: [] } } }));
  assert.deepEqual(state.levels['0'].removedIds, []);
  assert.deepEqual(state.levels['1'].removedIds, []);
});

test('complete legal histories imply completion and survive reload', () => {
  const state = parseSaveState(encode({ levels: { '0': { removedIds: order } } }));
  assert.deepEqual(state.completed, [0]);
  assert.deepEqual(parseSaveState(JSON.stringify(state)), state);
});

test('defaults, parsed results and source levels are isolated', () => {
  const first = parseSaveState(encode({ levels: { '0': { removedIds: order.slice(0, 2) } } }));
  first.levels['0'].removedIds.push('bad');
  first.completed.push(2);
  assert.deepEqual(createSaveState(), { version: 1, activeLevel: TUTORIAL_INDEX, completed: [], levels: {}, tutorial: { rotated: false, blockedSeen: false } });
  assert.deepEqual(parseSaveState(encode({ levels: { '0': { removedIds: order.slice(0, 2) } } })).levels['0'].removedIds, order.slice(0, 2));
  assert.equal(LEVELS[0].pieces.length, 26);
});


test('old saves keep their original levels and tutorial progress is validated', () => {
  const old = parseSaveState(JSON.stringify({ version: 1, activeLevel: 0, completed: [1], levels: { '0': { removedIds: order.slice(0, 3) } } }));
  assert.equal(old.activeLevel, 0);
  assert.deepEqual(old.levels['0'].removedIds, order.slice(0, 3));
  assert.deepEqual(old.tutorial, { rotated: false, blockedSeen: false });
  const state = parseSaveState(encode({ activeLevel: TUTORIAL_INDEX, tutorial: { rotated: true, blockedSeen: 'true' } }));
  assert.deepEqual(state.tutorial, { rotated: true, blockedSeen: false });
  assert.deepEqual(parseSaveState(JSON.stringify(state)), state);
});
