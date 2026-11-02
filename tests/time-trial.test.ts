import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaySession, MAX_ATTEMPT_MS, formatTime, parseAttemptState } from '../src/time-trial.ts';

test('active play excludes pauses, idle visits and time between reloads', () => {
  const session = new PlaySession();
  session.resume(1_000);
  assert.equal(session.elapsed(2_234), 1_234);
  session.pause(3_000);
  assert.equal(session.elapsed(99_000), 2_000);
  session.resume(100_000);
  session.resume(100_050);
  const restored = new PlaySession(session.snapshot(101_000));
  assert.equal(restored.running, false);
  assert.equal(restored.elapsed(9_000_000), 3_000);
  restored.resume(20);
  assert.equal(restored.finish(1_020), 4_000);
  assert.equal(restored.elapsed(80_000), 4_000);
});

test('finish is permanent across undo, resume and reload', () => {
  const session = new PlaySession();
  session.resume(0);
  assert.equal(session.finish(2_456), 2_456);
  session.resume(8_000);
  assert.equal(session.running, false);
  assert.equal(session.finish(9_000), null);
  const restored = new PlaySession(session.snapshot(10_000));
  restored.resume(0);
  assert.equal(restored.running, false);
  assert.equal(restored.finish(2), null);
  assert.equal(restored.elapsed(9), 2_456);
});

test('assistance is allowed and cooldown grows from five seconds to a thirty second cap', () => {
  const session = new PlaySession();
  assert.equal(session.useHint(0), false);
  session.resume(0);
  let now = 0;
  for (const delay of [5_000, 10_000, 15_000, 20_000, 25_000, 30_000, 30_000]) {
    assert.equal(session.useHint(now), true);
    assert.equal(session.hintRemaining(now), delay);
    assert.equal(session.useHint(now + delay - 1), false);
    now += delay;
  }
  assert.equal(session.snapshot(now).hintsUsed, 7);
  assert.equal(session.finish(now), now);
  assert.equal(session.useHint(now), false);
});

test('cooldown and escalation survive a paused reload without consuming wall time', () => {
  const session = new PlaySession();
  session.resume(0);
  session.useHint(0);
  session.pause(2_000);
  const restored = new PlaySession(session.snapshot(100_000));
  assert.equal(restored.hintRemaining(1_000_000), 3_000);
  restored.resume(0);
  assert.equal(restored.useHint(2_999), false);
  assert.equal(restored.useHint(3_000), true);
  assert.equal(restored.hintRemaining(3_000), 10_000);
  assert.equal(restored.finish(4_000), 6_000);
});

test('legacy partial progress cannot qualify until a new session is created', () => {
  const session = new PlaySession(undefined, false);
  session.resume(0);
  session.useHint(0);
  assert.equal(session.finish(1_000), null);
  assert.equal(session.snapshot(1_000).finished, true);
  const fresh = new PlaySession();
  fresh.resume(0);
  assert.equal(fresh.finish(1_000), 1_000);
});

test('regressing clock values cannot subtract elapsed time or extend cooldown', () => {
  const session = new PlaySession();
  session.resume(1_000);
  session.useHint(1_000);
  assert.equal(session.elapsed(2_000), 1_000);
  assert.equal(session.elapsed(500), 1_000);
  assert.equal(session.hintRemaining(1_000), 4_000);
  assert.equal(session.finish(3_000), 2_000);
});

test('overlong or invalid snapshots cannot create a fast record', () => {
  const session = new PlaySession();
  session.resume(0);
  assert.equal(session.elapsed(MAX_ATTEMPT_MS + 1), MAX_ATTEMPT_MS);
  const restored = new PlaySession(session.snapshot(MAX_ATTEMPT_MS + 2));
  restored.resume(0);
  assert.equal(restored.finish(1), null);
  for (const invalid of [NaN, Infinity, -1, MAX_ATTEMPT_MS + 1]) {
    const bad = new PlaySession({ elapsedMs: invalid, hintsUsed: 0, hintWaitMs: 0, eligible: true, finished: false });
    bad.resume(0);
    assert.equal(bad.finish(1), null);
  }
  const maximum = new PlaySession({ elapsedMs: MAX_ATTEMPT_MS, hintsUsed: 0, hintWaitMs: 0, eligible: true, finished: false });
  assert.equal(maximum.finish(0), MAX_ATTEMPT_MS);
});

test('snapshot parsing validates counters, cooldown and flags and returns an isolated copy', () => {
  const valid = { elapsedMs: 200, hintsUsed: 1, hintWaitMs: 2_000, eligible: true, finished: false };
  for (const invalid of [{ hintsUsed: 0 }, { hintsUsed: -1 }, { hintsUsed: 1.5 }, { hintWaitMs: 5_001 }, { hintWaitMs: -1 }, { eligible: 'true' }, { finished: 1 }]) {
    assert.equal(parseAttemptState({ ...valid, ...invalid }), undefined);
  }
  const parsed = parseAttemptState({ ...valid, unknown: true })!;
  assert.deepEqual(parsed, valid);
  parsed.elapsedMs = 1;
  assert.equal(valid.elapsedMs, 200);
});

test('time formatting includes minutes and milliseconds', () => {
  assert.equal(formatTime(0), '00:00.000');
  assert.equal(formatTime(62_345), '01:02.345');
  assert.equal(formatTime(6_001_008), '100:01.008');
});
