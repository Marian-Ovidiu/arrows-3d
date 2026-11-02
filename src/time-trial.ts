/** Persisted active play only: wall-clock dates never enter an attempt. */
export interface AttemptState {
  elapsedMs: number;
  hintsUsed: number;
  hintWaitMs: number;
  eligible: boolean;
  finished: boolean;
}

export const MAX_ATTEMPT_MS = 86_400_000;
export const MAX_HINT_WAIT_MS = 30_000;
const hintDelay = (count: number): number => Math.min(count, 6) * 5_000;

/** Invalid storage cannot turn an old attempt into a fresh, record-eligible one. */
export function parseAttemptState(value: unknown): AttemptState | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const saved = value as Record<string, unknown>;
  if (typeof saved.elapsedMs !== 'number' || !Number.isInteger(saved.elapsedMs) || saved.elapsedMs < 0 || saved.elapsedMs > MAX_ATTEMPT_MS
    || typeof saved.hintsUsed !== 'number' || !Number.isSafeInteger(saved.hintsUsed) || saved.hintsUsed < 0
    || typeof saved.hintWaitMs !== 'number' || !Number.isInteger(saved.hintWaitMs) || saved.hintWaitMs < 0 || saved.hintWaitMs > hintDelay(saved.hintsUsed)
    || typeof saved.eligible !== 'boolean' || typeof saved.finished !== 'boolean') return undefined;
  return { elapsedMs: saved.elapsedMs, hintsUsed: saved.hintsUsed, hintWaitMs: saved.hintWaitMs, eligible: saved.eligible, finished: saved.finished };
}

/** A resumable ordinary-play attempt; pauses also freeze the assistance cooldown. */
export class PlaySession {
  private state: AttemptState;
  private anchor: number | null = null;
  private lastNow = 0;

  constructor(snapshot?: AttemptState, eligible = true) {
    this.state = snapshot === undefined
      ? { elapsedMs: 0, hintsUsed: 0, hintWaitMs: 0, eligible, finished: false }
      : parseAttemptState(snapshot) ?? { elapsedMs: MAX_ATTEMPT_MS, hintsUsed: 0, hintWaitMs: 0, eligible: false, finished: false };
    this.state.eligible = this.state.eligible && eligible;
  }
  get running(): boolean { return this.anchor !== null && !this.state.finished; }

  resume(now: number): void {
    if (this.running || this.state.finished || !Number.isFinite(now)) return;
    // A reload gets a new monotonic clock, so no old anchor is persisted.
    this.anchor = now;
    this.lastNow = now;
  }
  private settle(now: number): void {
    if (this.anchor === null || !Number.isFinite(now)) return;
    const next = Math.max(this.lastNow, now);
    const delta = next - this.anchor;
    const total = this.state.elapsedMs + delta;
    if (total > MAX_ATTEMPT_MS) this.state.eligible = false;
    this.state.elapsedMs = Math.min(MAX_ATTEMPT_MS, total);
    this.state.hintWaitMs = Math.max(0, this.state.hintWaitMs - delta);
    this.anchor = next;
    this.lastNow = next;
  }
  pause(now: number): void { this.settle(now); this.anchor = null; }
  elapsed(now: number): number { this.settle(now); return Math.round(this.state.elapsedMs); }
  snapshot(now: number): AttemptState {
    this.settle(now);
    return { ...this.state, elapsedMs: Math.round(this.state.elapsedMs), hintWaitMs: Math.ceil(this.state.hintWaitMs) };
  }
  hintRemaining(now: number): number { this.settle(now); return Math.ceil(this.state.hintWaitMs); }
  useHint(now: number): boolean {
    this.settle(now);
    if (!this.running || this.state.hintWaitMs > 0) return false;
    this.state.hintsUsed = Math.min(Number.MAX_SAFE_INTEGER, this.state.hintsUsed + 1);
    this.state.hintWaitMs = hintDelay(this.state.hintsUsed);
    return true;
  }
  finish(now: number): number | null {
    if (this.state.finished) return null;
    this.pause(now);
    this.state.finished = true;
    return this.state.eligible ? Math.max(1, Math.round(this.state.elapsedMs)) : null;
  }
}

export function formatTime(ms: number): string {
  const value = Math.max(0, Math.floor(ms));
  return `${String(Math.floor(value / 60_000)).padStart(2, '0')}:${String(Math.floor(value / 1_000) % 60).padStart(2, '0')}.${String(value % 1_000).padStart(3, '0')}`;
}
