import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { ACCOUNT_PREFIX, GUEST_KEY, type KeyValueStore } from './account-store.ts';

interface NativePreferences {
  keys(): Promise<{ keys: string[] }>;
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<unknown>;
}
interface PendingWrite { key: string; value: string | null; version: number; error?: unknown }
const ownedKey = (key: string): boolean => key === GUEST_KEY || key === 'svela-completed' || key === 'svela-oauth-pending' || key.startsWith(ACCOUNT_PREFIX) || key.startsWith('sb-');
// A durable deletion must also beat a stale/unavailable WebView cache next launch.
// Printable: Android SharedPreferences persists strings as XML.
const NATIVE_TOMBSTONE = '__svela_removed_v1__';

/** Synchronous account/auth cache backed by serialized native Preferences writes. */
export class AccountStorage implements KeyValueStore {
  private values = new Map<string, string | null>();
  private versions = new Map<string, number>();
  private failed = new Map<string, PendingWrite>();
  private queue: Promise<void> = Promise.resolve();
  private preparation: Promise<void> | null = null;
  private local: KeyValueStore;
  private native: NativePreferences | null;
  private localKeys: () => string[];
  constructor(local: KeyValueStore, native: NativePreferences | null = null, localKeys: () => string[] = () => []) {
    this.local = local; this.native = native; this.localKeys = localKeys;
  }
  getItem(key: string): string | null {
    if (this.native && this.values.has(key)) return this.values.get(key)!;
    try { return this.local.getItem(key); }
    catch (error) { if (this.native) return null; throw error; }
  }
  setItem(key: string, value: string): void {
    if (!this.native) { this.local.setItem(key, value); return; }
    this.values.set(key, value);
    try { this.local.setItem(key, value); } catch { /* Preferences also works when the WebView cache is full. */ }
    this.enqueue({ key, value, version: (this.versions.get(key) ?? 0) + 1 });
  }
  removeItem(key: string): void {
    if (!this.native) { this.local.removeItem(key); return; }
    this.values.set(key, null);
    try { this.local.removeItem(key); } catch { /* The in-memory tombstone prevents a stale cache read. */ }
    this.enqueue({ key, value: null, version: (this.versions.get(key) ?? 0) + 1 });
  }
  private enqueue(write: PendingWrite): void {
    this.versions.set(write.key, write.version);
    this.queue = this.queue.then(async () => {
      try {
        await this.native!.set({ key: write.key, value: write.value ?? NATIVE_TOMBSTONE });
        this.failed.delete(write.key);
      } catch (error) { this.failed.set(write.key, { ...write, error }); }
    });
  }
  prepare(): Promise<void> {
    if (!this.native) return Promise.resolve();
    return this.preparation ??= this.hydrate();
  }
  private async hydrate(): Promise<void> {
    let nativeKeys: string[] = [];
    let webKeys: string[] = [];
    try { nativeKeys = (await this.native!.keys()).keys; } catch { /* Still try the legacy guest and known cache keys. */ }
    try { webKeys = this.localKeys(); } catch { /* Local storage can be disabled independently of Preferences. */ }
    const keys = [...new Set([GUEST_KEY, 'svela-completed', ...nativeKeys, ...webKeys])].filter(ownedKey);
    await Promise.all(keys.map(async key => {
      const version = this.versions.get(key) ?? 0;
      try {
        const { value } = await this.native!.get({ key });
        // A save or logout occurring during hydration always wins over the old disk read.
        if ((this.versions.get(key) ?? 0) !== version || version !== 0) return;
        if (value !== null) {
          const removed = value === NATIVE_TOMBSTONE;
          this.values.set(key, removed ? null : value);
          try {
            if (removed) this.local.removeItem(key);
            else this.local.setItem(key, value);
          } catch { /* Reads can use the memory mirror. */ }
        } else {
          let cached: string | null = null;
          try { cached = this.local.getItem(key); } catch { /* No WebView fallback. */ }
          if (cached !== null) {
            this.values.set(key, cached);
            this.enqueue({ key, value: cached, version: 1 });
          }
        }
      } catch { /* Preserve the existing WebView fallback if a native read fails. */ }
    }));
  }
  /** Flush a checkpoint, retrying earlier failures without replaying superseded values. */
  async flush(): Promise<void> {
    for (const write of this.failed.values()) {
      if (this.versions.get(write.key) === write.version) this.enqueue(write);
    }
    await this.queue;
    const failure = this.failed.values().next().value as PendingWrite | undefined;
    if (failure) throw failure.error ?? new Error('Salvataggio nativo non disponibile.');
  }
}

const local: KeyValueStore = {
  getItem: key => globalThis.localStorage?.getItem(key) ?? null,
  setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  removeItem: key => globalThis.localStorage.removeItem(key),
};
export const accountStorage = new AccountStorage(local, Capacitor.isNativePlatform() ? Preferences : null, () => {
  const storage = globalThis.localStorage;
  return storage ? Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => key !== null) : [];
});
export const prepareAccountStorage = (): Promise<void> => accountStorage.prepare();
export const flushAccountStorage = (): Promise<void> => accountStorage.flush();
