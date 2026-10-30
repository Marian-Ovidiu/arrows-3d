import assert from 'node:assert/strict';
import test from 'node:test';
import { getTutorialStep } from '../src/tutorial.ts';

const all = ['intro-first', 'intro-blocked', 'intro-blocker', 'intro-last'];
const initial = { rotated: false, blockedSeen: false };
const rotated = { rotated: true, blockedSeen: false };
const experienced = { rotated: true, blockedSeen: true };

test('tutorial progresses through rotation, selection, extraction and blocking', () => {
  assert.equal(getTutorialStep(all, null, initial).id, 'rotate');
  assert.equal(getTutorialStep(all, null, initial).targetId, null);
  assert.equal(getTutorialStep(all, null, rotated).id, 'select');
  assert.equal(getTutorialStep(all, 'intro-last', rotated).targetId, 'intro-first');
  assert.equal(getTutorialStep(all, 'intro-first', rotated).id, 'extract');
  const afterFirst = all.filter((id) => id !== 'intro-first');
  assert.equal(getTutorialStep(afterFirst, null, rotated).id, 'blocked');
  assert.equal(getTutorialStep(afterFirst, null, rotated).targetId, 'intro-blocked');
  assert.equal(getTutorialStep(afterFirst, 'intro-blocked', experienced).id, 'unblock');
  assert.equal(getTutorialStep(afterFirst, null, experienced).targetId, 'intro-blocker');
});

test('finish targets terracotta before blue and completion has no target', () => {
  const step = getTutorialStep(['intro-blocked', 'intro-last'], null, experienced);
  assert.equal(step.id, 'finish');
  assert.equal(step.targetId, 'intro-blocked');
  assert.equal(getTutorialStep(['intro-last'], null, experienced).targetId, 'intro-last');
  const done = getTutorialStep([], 'intro-last', initial);
  assert.equal(done.id, 'done');
  assert.equal(done.targetId, null);
  assert.equal(done.number, 4);
});

test('undo derives the earlier instruction while keeping learned progress', () => {
  assert.equal(getTutorialStep(['intro-last'], null, experienced).id, 'finish');
  assert.equal(getTutorialStep(all.slice(1), null, experienced).id, 'unblock');
  assert.equal(getTutorialStep(all, null, experienced).id, 'select');
  assert.equal(getTutorialStep(all, 'intro-first', experienced).id, 'extract');
});

test('reload can derive a resumed step without transient selection or rotation', () => {
  const persisted = JSON.parse(JSON.stringify({ ids: all.slice(1), progress: initial }));
  assert.equal(getTutorialStep(persisted.ids, null, persisted.progress).id, 'blocked');
  persisted.progress.blockedSeen = true;
  assert.equal(getTutorialStep(persisted.ids, null, persisted.progress).id, 'unblock');
  assert.equal(getTutorialStep(['intro-blocked', 'intro-last'], null, initial).id, 'finish');
});

test('instructions are pure and contain mobile copy and ordered step numbers', () => {
  const ids = Object.freeze([...all]);
  const progress = Object.freeze({ ...rotated });
  const steps = [
    getTutorialStep(ids, null, initial),
    getTutorialStep(ids, null, progress),
    getTutorialStep(ids, 'intro-first', progress),
    getTutorialStep(ids.slice(1), null, progress),
    getTutorialStep(ids.slice(1), null, experienced),
    getTutorialStep(['intro-last'], null, experienced),
    getTutorialStep([], null, experienced),
  ];
  assert.deepEqual(steps.map((step) => step.number), [1, 2, 2, 3, 3, 4, 4]);
  for (const step of steps) {
    assert.ok(step.title.length > 0 && step.title.length < 40);
    assert.ok(step.description.length > 0 && step.description.length < 110);
  }
  assert.deepEqual(ids, all);
  assert.deepEqual(progress, rotated);
});
