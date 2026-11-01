import test from 'node:test';
import assert from 'node:assert/strict';
import { TimeTrial, formatTime } from '../src/time-trial.ts';

test('a completed uninterrupted attempt has a stable measured duration', () => {
  const trial = new TimeTrial();
  assert.equal(trial.finish(100), null);
  trial.start(1_000);
  assert.equal(trial.elapsed(2_234), 1_234);
  assert.equal(trial.finish(3_456), 2_456);
  assert.equal(trial.elapsed(9_000), 2_456);
  assert.equal(trial.finish(9_000), null);
});

test('assistance, pause and backgrounding disqualify the current attempt until a fresh start', () => {
  for (const reason of ['Suggerimento', 'Pausa', 'Annulla', 'Finestra inattiva']) {
    const trial = new TimeTrial();
    trial.start(1_000);
    trial.invalidate(reason);
    assert.equal(trial.running, false);
    assert.equal(trial.reason, reason);
    assert.equal(trial.finish(5_000), null);
    trial.start(6_000);
    assert.equal(trial.reason, '');
    assert.equal(trial.finish(7_500), 1_500);
  }
});

test('time formatting includes minutes and milliseconds', () => {
  assert.equal(formatTime(0), '00:00.000');
  assert.equal(formatTime(62_345), '01:02.345');
  assert.equal(formatTime(6_001_008), '100:01.008');
});
