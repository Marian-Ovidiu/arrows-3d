import { currentAccountSave, initializeAccount, writeAccountSave } from './account.ts';
import { flushAccountStorage, prepareAccountStorage } from './account-storage.ts';
import { parseSaveState, type SaveState } from './save-state.ts';

export async function loadSave(): Promise<SaveState> {
  // Hydrate native guest, owner caches and auth before account selection can run.
  await prepareAccountStorage();
  // Auth may hydrate later and emits a replacement; startup never waits on a network indefinitely.
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([initializeAccount(), new Promise<void>((resolve) => { timeout = setTimeout(resolve, 1_500); })]);
  clearTimeout(timeout);
  return currentAccountSave();
}
/** Snapshot immediately; the account manager selects the owner on every platform. */
export function saveGame(state: SaveState): Promise<void> {
  const snapshot = parseSaveState(JSON.stringify(state));
  try { writeAccountSave(snapshot); return flushAccountStorage(); }
  catch (error) { return Promise.reject(error); }
}
