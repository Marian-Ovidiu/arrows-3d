import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { currentAccountSave, initializeAccount, writeAccountSave } from './account.ts';
import { GUEST_KEY, readGuest, type KeyValueStore } from './account-store.ts';
import { parseSaveState, type SaveState } from './save-state.ts';

let writeQueue: Promise<void> = Promise.resolve();
const store: KeyValueStore = {
  getItem: (key) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  removeItem: (key) => globalThis.localStorage.removeItem(key),
};
export async function loadSave(): Promise<SaveState> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { value } = await Preferences.get({ key: GUEST_KEY });
      if (value !== null) return parseSaveState(value);
    } catch { /* Native storage unavailable: fall back to the web cache. */ }
    return readGuest(store);
  }
  // Auth may hydrate later and emits a replacement; startup never waits on a network indefinitely.
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([initializeAccount(), new Promise<void>((resolve) => { timeout = setTimeout(resolve, 1_500); })]);
  clearTimeout(timeout);
  return currentAccountSave();
}
/** Snapshot immediately; serialize durable native writes in invocation order. */
export function saveGame(state: SaveState): Promise<void> {
  const snapshot = parseSaveState(JSON.stringify(state));
  if (!Capacitor.isNativePlatform()) {
    try { writeAccountSave(snapshot); return Promise.resolve(); } catch (error) { return Promise.reject(error); }
  }
  const value = JSON.stringify(snapshot);
  try { store.setItem(GUEST_KEY, value); } catch { /* Preferences remains the durable native store. */ }
  const write = writeQueue.then(() => Preferences.set({ key: GUEST_KEY, value }));
  writeQueue = write.catch(() => {});
  return write;
}
