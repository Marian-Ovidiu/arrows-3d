import assert from 'node:assert/strict';
import test from 'node:test';
import { PointerGestureTracker } from '../src/pointer-gesture.ts';

const sample = (pointerId = 1, clientX = 0, clientY = 0, timeStamp = 0, pointerType = 'touch') =>
  ({ pointerId, clientX, clientY, timeStamp, pointerType });

test('quick touch tap accepts jitter within ten CSS pixels', () => {
  const gestures = new PointerGestureTracker();
  gestures.down(sample());
  gestures.move(sample(1, 6, 8, 30));
  assert.equal(gestures.up(sample(1, 1, 2, 100)), 'tap');
});

test('drag stays a drag after travelling out and back', () => {
  const gestures = new PointerGestureTracker();
  gestures.down(sample());
  gestures.move(sample(1, 11, 0, 30));
  gestures.move(sample(1, 0, 0, 50));
  assert.equal(gestures.up(sample(1, 0, 0, 100)), 'drag');
});

test('release coordinates catch travel even when move events were omitted', () => {
  const gestures = new PointerGestureTracker();
  gestures.down(sample());
  assert.equal(gestures.up(sample(1, 8, 8, 100)), 'drag');
});

test('mouse has a smaller movement tolerance', () => {
  const gestures = new PointerGestureTracker();
  gestures.down(sample(1, 0, 0, 0, 'mouse'));
  assert.equal(gestures.up(sample(1, 7, 0, 100, 'mouse')), 'drag');
});

for (const releaseOrder of [[1, 2], [2, 1]]) {
  test(`pinch invalidates both releases in order ${releaseOrder.join(', ')}`, () => {
    const gestures = new PointerGestureTracker();
    gestures.down(sample(1));
    gestures.move(sample(1, 20, 0, 10));
    gestures.down(sample(2, 30, 0, 20));
    assert.equal(gestures.up(sample(releaseOrder[0], 20, 0, 50)), null);
    // The remaining finger may move, but never becomes a fresh tap or drag.
    gestures.move(sample(releaseOrder[1], 80, 0, 60));
    assert.equal(gestures.up(sample(releaseOrder[1], 0, 0, 70)), null);
    gestures.down(sample(3, 0, 0, 100));
    assert.equal(gestures.up(sample(3, 0, 0, 150)), 'tap');
  });
}

test('a third finger cannot restart a still-active multitouch sequence', () => {
  const gestures = new PointerGestureTracker();
  gestures.down(sample(1));
  gestures.down(sample(2));
  assert.equal(gestures.up(sample(1)), null);
  gestures.down(sample(3));
  assert.equal(gestures.up(sample(2)), null);
  assert.equal(gestures.up(sample(3)), null);
});

test('cancelled pointer cannot tap and a later sequence can', () => {
  const gestures = new PointerGestureTracker();
  gestures.down(sample());
  gestures.cancel(1);
  assert.equal(gestures.up(sample(1, 0, 0, 100)), null);
  gestures.down(sample(2, 0, 0, 200));
  assert.equal(gestures.up(sample(2, 0, 0, 250)), 'tap');
});

test('cancelling one pinch pointer keeps the other invalidated', () => {
  const gestures = new PointerGestureTracker();
  gestures.down(sample(1));
  gestures.down(sample(2));
  gestures.cancel(1);
  gestures.cancel(99);
  assert.equal(gestures.up(sample(2, 0, 0, 100)), null);
});

test('reset and cancel without an id discard all active state', () => {
  const gestures = new PointerGestureTracker();
  for (const clear of [() => gestures.reset(), () => gestures.cancel()]) {
    gestures.down(sample(1));
    gestures.down(sample(2));
    clear();
    assert.equal(gestures.up(sample(1)), null);
    gestures.down(sample(3));
    assert.equal(gestures.up(sample(3, 0, 0, 100)), 'tap');
  }
});

test('stationary long press is neither tap nor drag', () => {
  const gestures = new PointerGestureTracker();
  gestures.down(sample());
  assert.equal(gestures.up(sample(1, 0, 0, 501)), null);
  gestures.down(sample(2, 0, 0, 1000));
  assert.equal(gestures.up(sample(2, 0, 0, 1500)), 'tap');
});
