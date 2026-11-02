import { createSaveState, parseSaveState, type SaveState, MAX_SAVE_BYTES } from './save-state.ts';

export const GUEST_KEY = 'svela-save-v1';
export const ACCOUNT_PREFIX = 'svela-account-v1:';
export interface KeyValueStore { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface AccountCache { save: SaveState; revision: number; dirty: boolean; editId: string }
export const cleanSave = (save: SaveState): SaveState => parseSaveState(JSON.stringify(save));
/** Key order is not meaning: Postgres jsonb returns objects re-sorted. Array order still counts. */
const canonical = (value: unknown): string => JSON.stringify(value, (_, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : item);
export const sameSave = (a: SaveState, b: SaveState): boolean => canonical(a) === canonical(b);
export const accountKey = (id: string): string => ACCOUNT_PREFIX + encodeURIComponent(id);
export function readGuest(store: KeyValueStore): SaveState {
  try {
    const raw = store.getItem(GUEST_KEY);
    if (raw !== null) return parseSaveState(raw);
    const completed: unknown = JSON.parse(store.getItem('svela-completed') ?? '[]');
    return parseSaveState(JSON.stringify({ version: 1, activeLevel: 3, completed, levels: {}, tutorial: {} }));
  } catch { return createSaveState(); }
}
export function readAccount(store: KeyValueStore, id: string): AccountCache | null {
  try {
    const raw = store.getItem(accountKey(id));
    if (!raw || raw.length > MAX_SAVE_BYTES + 10_000) return null;
    const value = JSON.parse(raw);
    if (!value || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.dirty !== 'boolean') return null;
    return { save: cleanSave(value.save), revision: value.revision, dirty: value.dirty, editId: typeof value.editId === 'string' ? value.editId : '' };
  } catch { return null; }
}
export function writeAccount(store: KeyValueStore, id: string, cache: AccountCache): void {
  store.setItem(accountKey(id), JSON.stringify(cache));
}
