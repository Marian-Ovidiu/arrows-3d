import { createSaveState, type SaveState } from './save-state.ts';
import { accountKey, cleanSave, GUEST_KEY, readAccount, readGuest, sameSave, writeAccount, type AccountCache, type KeyValueStore } from './account-store.ts';

export type AccountUser = { id: string; email: string; name: string };
export interface AccountState {
  configured: boolean; nativeUnsupported: boolean; ready: boolean; user: AccountUser | null;
  status: 'guest' | 'loading' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict';
  message: string; guestImportAvailable: boolean;
}
export interface CloudProgress { save: SaveState; revision: number; updated_at?: string }
export interface ProgressBackend {
  read(): Promise<CloudProgress | null>;
  write(save: SaveState, revision: number): Promise<CloudProgress & { ok: boolean }>;
}
export class AccountRemoteError extends Error {
  kind: 'auth' | 'network' | 'server';
  constructor(kind: 'auth' | 'network' | 'server') { super(kind); this.kind = kind; }
}
const copy = (cache: AccountCache): AccountCache => ({ ...cache, save: cleanSave(cache.save) });
let sequence = 0;
const editId = (): string => `${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}`;

/** Owner-scoped durable outbox. No merging: undo and reset are complete snapshots. */
export class AccountSync {
  private stateValue: AccountState;
  private saveValue: SaveState;
  private cache: AccountCache | null = null;
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | null = null;
  private conflict: CloudProgress | null | undefined;
  private listeners = new Set<(state: AccountState) => void>();
  private saveListeners = new Set<(save: SaveState) => void>();
  private remoteAllowed = true;
  private store: KeyValueStore;
  private backend: ProgressBackend | null;
  private delay: number;
  constructor(store: KeyValueStore, backend: ProgressBackend | null, nativeUnsupported = false, delay = 500) {
    this.store = store; this.backend = backend; this.delay = delay;
    this.saveValue = readGuest(store);
    this.stateValue = { configured: !!backend, nativeUnsupported, ready: true, user: null, status: 'guest', message: '', guestImportAvailable: false };
  }
  get save(): SaveState { return cleanSave(this.saveValue); }
  get state(): AccountState { return { ...this.stateValue, user: this.stateValue.user ? { ...this.stateValue.user } : null }; }
  subscribe(listener: (state: AccountState) => void): () => void { this.listeners.add(listener); listener(this.state); return () => { this.listeners.delete(listener); }; }
  onSave(listener: (save: SaveState) => void): () => void { this.saveListeners.add(listener); return () => { this.saveListeners.delete(listener); }; }
  private emit(): void { for (const listener of this.listeners) listener(this.state); }
  private replacement(save: SaveState): void { this.saveValue = cleanSave(save); for (const listener of this.saveListeners) listener(this.save); }
  private patch(patch: Partial<AccountState>): void { Object.assign(this.stateValue, patch); this.emit(); }
  message(message: string, status: AccountState['status'] = 'error'): void { this.patch({ message, status }); }
  private persist(): void { if (this.stateValue.user && this.cache) writeAccount(this.store, this.stateValue.user.id, this.cache); }
  private later(): void {
    clearTimeout(this.timer);
    if (this.backend && this.stateValue.user && this.remoteAllowed && this.conflict === undefined) {
      this.timer = setTimeout(() => { void this.sync(); }, this.delay);
    }
  }
  async setUser(user: AccountUser | null, message = ''): Promise<void> {
    if (user?.id === this.stateValue.user?.id) {
      if (user) { this.remoteAllowed = true; this.patch({ user }); await this.sync(); }
      return;
    }
    ++this.generation;
    clearTimeout(this.timer);
    this.running = null;
    this.conflict = undefined;
    this.remoteAllowed = true;
    this.cache = user ? readAccount(this.store, user.id) : null;
    const save = user ? this.cache?.save ?? createSaveState() : readGuest(this.store);
    if (user && !this.cache) this.cache = { save, revision: 0, dirty: false, editId: editId() };
    const guest = readGuest(this.store);
    this.patch({ user, status: user ? 'loading' : 'guest', message, guestImportAvailable: !!user && !sameSave(guest, createSaveState()) });
    this.replacement(save);
    if (user) await this.sync();
  }
  /** Writes only to the current owner. Local changes never fire the reload callback. */
  saveLocal(save: SaveState): void {
    const snapshot = cleanSave(save);
    if (sameSave(this.saveValue, snapshot)) return;
    this.saveValue = snapshot;
    if (!this.stateValue.user) { this.store.setItem(GUEST_KEY, JSON.stringify(this.saveValue)); return; }
    this.cache = { ...this.cache!, save: this.saveValue, dirty: true, editId: editId() };
    try { this.persist(); } catch { this.patch({ status: 'error', message: 'Spazio locale non disponibile. Non chiudere il gioco prima della sincronizzazione.' }); throw new Error('Salvataggio locale non disponibile.'); }
    if (this.conflict === undefined) this.patch({ status: 'syncing', message: 'Progressi salvati sul dispositivo. Sincronizzazione in corso.' });
    this.later();
  }
  private failure(error: unknown): void {
    if (error instanceof AccountRemoteError && error.kind === 'auth') {
      this.remoteAllowed = false;
      this.patch({ status: 'error', message: 'Sessione scaduta. Esci e accedi nuovamente; i progressi restano su questo dispositivo.' });
    } else this.patch({ status: error instanceof AccountRemoteError && error.kind === 'server' ? 'error' : 'offline', message: 'Sincronizzazione non riuscita. I progressi restano su questo dispositivo. Riprova quando sei online.' });
  }
  sync(): Promise<void> {
    clearTimeout(this.timer);
    if (this.running) return this.running;
    if (!this.backend || !this.stateValue.user || !this.cache || !this.remoteAllowed || this.conflict !== undefined) return Promise.resolve();
    const generation = this.generation;
    const valid = (): boolean => generation === this.generation;
    const work = async (): Promise<void> => {
      this.patch({ status: 'syncing', message: 'Sincronizzazione in corso…' });
      try {
        const remote = await this.backend!.read();
        if (!valid() || this.conflict !== undefined) return;
        if (this.cache!.dirty) {
          if ((remote?.revision ?? 0) !== this.cache!.revision) { this.setConflict(remote); return; }
        } else if (remote) {
          this.cache = { save: cleanSave(remote.save), revision: remote.revision, dirty: false, editId: editId() };
          this.persist();
          if (!sameSave(this.saveValue, remote.save)) this.replacement(remote.save);
        } else if (this.cache!.revision !== 0) { this.setConflict(null); return; }
        while (valid() && this.cache!.dirty && this.conflict === undefined) {
          const snapshot = copy(this.cache!);
          const result = await this.backend!.write(snapshot.save, snapshot.revision);
          if (!valid() || this.conflict !== undefined) return;
          if (!result.ok) { this.setConflict(result); return; }
          // An edit made during the upload still belongs to the new server revision.
          const newer = this.cache!.editId !== snapshot.editId;
          this.cache = { save: newer ? this.saveValue : cleanSave(result.save), revision: result.revision, dirty: newer, editId: newer ? this.cache!.editId : editId() };
          this.persist();
          if (!newer && !sameSave(this.saveValue, result.save)) this.replacement(result.save);
        }
        if (valid() && this.conflict === undefined) this.patch({ status: 'synced', message: 'Progressi sincronizzati.' });
      } catch (error) { if (valid()) this.failure(error); }
    };
    const promise = work().finally(() => { if (valid() && this.running === promise) this.running = null; });
    this.running = promise;
    return promise;
  }
  private setConflict(remote: CloudProgress | null): void {
    this.conflict = remote;
    this.patch({ status: 'conflict', message: 'Ci sono progressi diversi nel cloud o in un’altra scheda. Scegli quale versione conservare.' });
  }
  async resolve(choice: 'local' | 'cloud'): Promise<void> {
    if (this.conflict === undefined || !this.stateValue.user || !this.backend) return;
    const generation = this.generation;
    try {
      // Re-read immediately before resolving; even an explicit overwrite uses CAS.
      const latest = await this.backend.read();
      if (generation !== this.generation) return;
      if (choice === 'cloud') {
        const save = latest?.save ?? createSaveState();
        this.cache = { save: cleanSave(save), revision: latest?.revision ?? 0, dirty: false, editId: editId() };
        this.persist();
        this.conflict = undefined;
        this.replacement(save);
        this.patch({ status: 'synced', message: 'Versione cloud caricata.' });
      } else {
        this.cache = { save: this.save, revision: latest?.revision ?? 0, dirty: true, editId: editId() };
        this.persist();
        this.conflict = undefined;
        await this.sync();
      }
    } catch (error) { if (generation === this.generation) { this.failure(error); this.patch({ status: 'conflict' }); } }
  }
  async importGuest(): Promise<void> {
    if (!this.stateValue.user) return;
    this.saveLocal(readGuest(this.store));
    this.replacement(this.saveValue);
    await this.sync();
  }
  /** A storage event signals concurrent writers; never blindly replace an open game. */
  externalChange(key: string | null): void {
    if (this.stateValue.user && (key === null || key === accountKey(this.stateValue.user.id))) {
      const other = readAccount(this.store, this.stateValue.user.id);
      if (!other || other.editId !== this.cache?.editId) this.setConflict(other ? { save: other.save, revision: other.revision } : null);
    } else if (!this.stateValue.user && (key === null || key === GUEST_KEY)) {
      const guest = readGuest(this.store);
      if (!sameSave(this.saveValue, guest)) this.replacement(guest);
    }
  }
  async clearDeletedUser(): Promise<void> {
    const id = this.stateValue.user?.id;
    if (!id) return;
    ++this.generation;
    clearTimeout(this.timer);
    this.store.removeItem(accountKey(id));
    await this.setUser(null, 'Account eliminato.');
  }
  suspend(): void { ++this.generation; clearTimeout(this.timer); this.running = null; this.remoteAllowed = false; }
  resume(): void { this.remoteAllowed = true; }
}
