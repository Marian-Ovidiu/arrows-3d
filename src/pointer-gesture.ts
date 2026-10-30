/** Minimal PointerEvent shape; coordinates and tolerances are CSS pixels. */
export interface PointerGestureSample {
  pointerId: number;
  clientX: number;
  clientY: number;
  pointerType: string;
  timeStamp: number;
}

interface TrackedPointer {
  x: number;
  y: number;
  startedAt: number;
  tolerance: number;
  moved: boolean;
}

/**
 * Feed canvas pointerdown and all subsequent move/up/cancel events, including
 * releases outside the canvas (pointer capture or window listeners). Forward
 * getCoalescedEvents() samples to move before the final event when available,
 * so travel out and back within one browser frame remains a drag.
 * Only an up result of 'tap' should select; 'drag' can advance orbit tutorials.
 * Call reset on lifecycle interruptions, and cancel(id) on pointercancel.
 */
export class PointerGestureTracker {
  private pointers = new Map<number, TrackedPointer>();
  private invalidated = false;

  down(event: PointerGestureSample): void {
    if (this.pointers.has(event.pointerId)) return;
    if (this.pointers.size > 0) this.invalidated = true;
    this.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startedAt: event.timeStamp,
      tolerance: event.pointerType === 'touch' ? 10 : 6,
      moved: false,
    });
  }

  move(event: PointerGestureSample): void {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (dx * dx + dy * dy > pointer.tolerance ** 2) pointer.moved = true;
  }

  up(event: PointerGestureSample): 'tap' | 'drag' | null {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return null;
    this.move(event);
    this.pointers.delete(event.pointerId);
    const invalidated = this.invalidated;
    if (this.pointers.size === 0) this.invalidated = false;
    if (invalidated) return null;
    if (pointer.moved) return 'drag';
    const elapsed = event.timeStamp - pointer.startedAt;
    return elapsed >= 0 && elapsed <= 500 ? 'tap' : null;
  }

  cancel(pointerId?: number): void {
    if (pointerId === undefined) {
      this.reset();
      return;
    }
    if (!this.pointers.delete(pointerId)) return;
    this.invalidated = this.pointers.size > 0;
  }

  reset(): void {
    this.pointers.clear();
    this.invalidated = false;
  }
}
