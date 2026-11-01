/** An uninterrupted attempt. Discovery progress is deliberately independent. */
export class TimeTrial {
  private startedAt: number | null = null;
  private endedAt: number | null = null;
  private invalidReason = '';

  start(now: number): void {
    this.startedAt = now;
    this.endedAt = null;
    this.invalidReason = '';
  }
  get running(): boolean { return this.startedAt !== null && this.endedAt === null && !this.invalidReason; }
  get reason(): string { return this.invalidReason; }
  elapsed(now: number): number { return this.startedAt === null ? 0 : Math.max(1, Math.round((this.endedAt ?? now) - this.startedAt)); }
  invalidate(reason: string): void { if (this.running) this.invalidReason = reason; }
  finish(now: number): number | null {
    if (!this.running) return null;
    this.endedAt = now;
    return this.elapsed(now);
  }
}

export function formatTime(ms: number): string {
  const value = Math.max(0, Math.floor(ms));
  return `${String(Math.floor(value / 60_000)).padStart(2, '0')}:${String(Math.floor(value / 1_000) % 60).padStart(2, '0')}.${String(value % 1_000).padStart(3, '0')}`;
}
